// R-38 (offline): apply scores the résumé the candidate uploaded LAST.
//
// Seen live (batch-7 pass, 2026-11-14): a candidate uploaded résumé A, applied, uploaded
// résumé B, applied again 1 s later, and the second application was scored against A.
// Cause (read-only probe, see backend/Services/resumePipeline.js downloadStored): the
// re-upload overwrote the same object key, and Supabase serves downloads through a CDN
// whose cache is keyed by the path alone; the edge kept answering with the previous
// bytes for about 50 s (R-38 live verification). The fix: every upload is written to a
// new key (resumePipeline.js newResumePath), so no key is ever overwritten; the MD5
// check on download stays as a safety net for objects written at the old fixed key.
//
// This file models that CDN in front of the in-memory store: a download is cached at
// the "edge" by object key; an overwrite does not purge the edge copy at once, it is
// served `cdn.staleServes` more times first (configurable per test; Infinity = the purge
// never lands within the test, longer than any retry budget). The storage list (a
// database read) always describes the current object (eTag = MD5, size), as Supabase's does.
//
// Nothing leaves loopback and no model is loaded; nlp-engine is a stub that replays the
// R-05 snapshots of whichever fixture it receives.
//
//   node --test tests/backend/resume-current-on-apply.test.mjs
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_DIR, TESTS_DIR } from './lib/env.mjs';
import { startStub, json } from './lib/stub-server.mjs';
import { createSupabaseStub, fakeServiceKey } from './lib/supabase-stub.mjs';

const backendUrl = (...parts) =>
  new URL(`file:///${join(REPO_DIR, 'backend', ...parts).replace(/\\/g, '/')}`);
const express = createRequire(join(REPO_DIR, 'backend', 'package.json'))('express');

const FIXTURES = join(TESTS_DIR, 'fixtures');
const SNAPSHOTS = join(TESTS_DIR, 'nlp', 'snapshots', 'current');
// A: the developer résumé (f1). B: the support résumé (f3). Both PDFs (before R-38 both
// were written to the same key, candidates/<id>/resume.pdf).
const RESUME_A = readFileSync(join(FIXTURES, 'f1_dev_github.pdf'));
const RESUME_B = readFileSync(join(FIXTURES, 'f3_support_nogithub.pdf'));
const SNAP_A = JSON.parse(readFileSync(join(SNAPSHOTS, 'f1_dev_github.json'), 'utf8'));
const SNAP_B = JSON.parse(readFileSync(join(SNAPSHOTS, 'f3_support_nogithub.json'), 'utf8'));
const md5 = (buf) => createHash('md5').update(buf).digest('hex');

// ---- Supabase stub: PostgREST from lib/supabase-stub.mjs; Storage here, behind a CDN model ----
const db = createSupabaseStub();
const cdn = { edge: new Map(), staleServes: 1, staleServed: 0, deletes: 0 };
const signedFor = []; // object keys a signed URL was requested for
let clock = Date.parse('2026-11-14T12:00:00Z');

const storageHandler = (req, res, rec) => {
  const p = decodeURIComponent(new URL(req.url, 'http://stub').pathname);
  const OBJECT = '/storage/v1/object/resumes/';

  if (req.method === 'POST' && p === '/storage/v1/object/list/resumes') {
    const prefix = `${rec.body?.prefix || ''}/`;
    const items = [...db.store.entries()]
      .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
      .map(([k, v]) => ({
        name: k.slice(prefix.length), id: k, updated_at: v.updated_at, created_at: v.updated_at,
        metadata: { eTag: `"${md5(v.bytes)}"`, size: v.bytes.length, mimetype: v.contentType, cacheControl: 'max-age=3600' },
      }));
    return json(res, 200, items);
  }
  if (req.method === 'POST' && p.startsWith(OBJECT)) {
    const key = p.slice(OBJECT.length);
    if (db.store.has(key) && req.headers['x-upsert'] !== 'true') return json(res, 400, { statusCode: '409', error: 'Duplicate', message: 'exists' });
    clock += 1000;
    db.store.set(key, { bytes: Buffer.from(rec.rawBody), contentType: req.headers['content-type'], updated_at: new Date(clock).toISOString() });
    // The overwrite does not purge the edge copy at once.
    const cached = cdn.edge.get(key);
    if (cached) Object.assign(cached, { stale: true, staleLeft: cdn.staleServes });
    return json(res, 200, { Id: key, Key: `resumes/${key}` });
  }
  if (req.method === 'GET' && p.startsWith(OBJECT)) {
    const key = p.slice(OBJECT.length);
    const cached = cdn.edge.get(key);
    if (cached && cached.stale && cached.staleLeft > 0) {
      cached.staleLeft -= 1;
      cdn.staleServed += 1;
      res.writeHead(200, { 'content-type': 'application/pdf', 'cf-cache-status': 'HIT' });
      return res.end(cached.bytes);
    }
    if (cached && !cached.stale) {
      res.writeHead(200, { 'content-type': 'application/pdf', 'cf-cache-status': 'HIT' });
      return res.end(cached.bytes);
    }
    const obj = db.store.get(key);
    if (!obj) return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    cdn.edge.set(key, { bytes: obj.bytes, stale: false, staleLeft: 0 });
    res.writeHead(200, { 'content-type': obj.contentType || 'application/octet-stream', 'cf-cache-status': 'MISS' });
    return res.end(obj.bytes);
  }
  // The recruiter résumé link (R-38 follow-up): which key is signed is recorded.
  if (req.method === 'POST' && p.startsWith('/storage/v1/object/sign/resumes/')) {
    const key = p.slice('/storage/v1/object/sign/resumes/'.length);
    signedFor.push(key);
    if (!db.store.has(key)) return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    return json(res, 200, { signedURL: `/object/sign/resumes/${key}?token=stub` });
  }
  // PostgREST's `job:jobs!inner(...)` with `job.recruiter_id=eq.X` drops applications
  // whose job is not X's; the shared stub ignores dotted filters, so it is applied here
  // (the recruiter résumé link's ownership check depends on it).
  const params = new URL(req.url, 'http://stub').searchParams;
  if (req.method === 'GET' && p === '/rest/v1/applications' && params.has('job.recruiter_id')) {
    const want = params.get('job.recruiter_id').replace(/^eq\./, '');
    let rows = db.tables.applications
      .filter((a) => [...params].every(([k, v]) => ['select', 'limit', 'order', 'job.recruiter_id'].includes(k)
        || (v.startsWith('eq.') && String(a[k]) === v.slice(3))))
      .map((a) => ({ ...a, job: db.tables.jobs.find((j) => j.id === a.job_id) || null }))
      .filter((a) => a.job && a.job.recruiter_id === want);
    if (Number(params.get('limit'))) rows = rows.slice(0, Number(params.get('limit')));
    if (/vnd\.pgrst\.object/.test(req.headers.accept || '')) {
      return rows.length === 1 ? json(res, 200, rows[0]) : json(res, 406, { code: 'PGRST116', message: 'stub: not exactly one row' });
    }
    return json(res, 200, rows);
  }
  if (req.method === 'DELETE' && p === '/storage/v1/object/resumes') {
    cdn.deletes += 1;
    const removed = [];
    for (const k of rec.body?.prefixes || []) if (db.store.delete(k)) removed.push({ name: k });
    return json(res, 200, removed);
  }
  return db.handler(req, res, rec);
};

// ---- nlp-engine stub: the snapshot of the fixture whose bytes it receives ----
const parses = []; // { resume: 'A' | 'B', withJd }
const nlpHandler = (req, res, rec) => {
  const body = rec.rawBody;
  const withJd = body.includes(Buffer.from('name="jd"'));
  const which = body.includes(RESUME_A) ? 'A' : body.includes(RESUME_B) ? 'B' : null;
  if (!which) return json(res, 422, { error: 'unreadable_document', reason: 'corrupt', message: 'stub: unknown file' });
  parses.push({ resume: which, withJd });
  const snap = which === 'A' ? SNAP_A : SNAP_B;
  return json(res, 200, { ...snap, semantic_analysis: withJd ? snap.semantic_analysis : null });
};

let supa;
let nlp;
let envDir;
let server;
let base;

const closedPortUrl = async () => {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return `http://127.0.0.1:${port}`;
};

before(async () => {
  supa = await startStub({ handler: storageHandler });
  nlp = await startStub({ handler: nlpHandler });
  envDir = mkdtempSync(join(tmpdir(), 'patina-r38-'));
  const envFile = join(envDir, 'backend.env');
  writeFileSync(envFile, [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${fakeServiceKey()}`,
    'SUPABASE_ANON_KEY=stub-anon-key',
    'SESSION_SECRET=r38-offline-test-secret-r38-offline',
    'SUPABASE_TIMEOUT_MS=3000',
    `NLP_PARSE_URL=${nlp.url}/parse`,
    'GITHUB_EVIDENCE_URL=',
  ].join('\n'));
  process.env.BACKEND_ENV_FILE = envFile;
  delete process.env.CREDIBILITY_WEIGHTS;
  // No background assessment preparation: its own download would change what the
  // edge serves to the apply under test.
  process.env.ASSESSMENT_PREPARE_ON_APPLY = 'false';
  process.env.ASSESSMENT_SERVICE_URL = await closedPortUrl();

  const errors = await import(backendUrl('Middlewares', 'errorHandler.js'));
  const requestId = await import(backendUrl('Middlewares', 'requestId.js'));
  const jobsRoutes = (await import(backendUrl('Routes', 'jobs.routes.js'))).default;
  const analysisRoutes = (await import(backendUrl('Routes', 'analysis.routes.js'))).default;
  assert.equal(process.env.SUPABASE_URL, supa.url, 'Supabase client is not pointed at the local stub');

  const app = express();
  app.use(requestId.requestIdMiddleware);
  app.use(errors.errorContract);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: req.get('X-Test-User'), role: req.get('X-Test-Role') || 'CANDIDATE' };
    next();
  });
  // Mounted as backend/index.js mounts them.
  app.use('/api/jobs', jobsRoutes);
  app.use('/api', analysisRoutes);
  app.use(errors.notFoundHandler);
  app.use(errors.errorHandler);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  await supa?.close();
  await nlp?.close();
  if (envDir) rmSync(envDir, { recursive: true, force: true });
  delete process.env.ASSESSMENT_PREPARE_ON_APPLY;
});

beforeEach(() => {
  cdn.edge.clear();
  cdn.staleServes = 1;
  cdn.staleServed = 0;
  cdn.deletes = 0;
  parses.length = 0;
  signedFor.length = 0;
});

// ---- helpers ----
let seq = 0;
const newCandidate = () => `11111111-1111-4111-8111-${String(380000 + ++seq).padStart(12, '0')}`;
const seedJob = () => {
  const job = {
    id: randomUUID(),
    recruiter_id: randomUUID(),
    title: '[R-38 TEST] IT support analyst',
    description: 'IT support analyst: ServiceNow, Jira, ITIL, Active Directory, Windows Server, Linux, SQL.',
    required_skills: ['servicenow', 'jira', 'itil', 'active directory', 'windows server', 'linux'],
    preferred_skills: ['sql', 'bash', 'python', 'react'],
    experience_level: 'mid',
    location: 'Remote',
    status: 'published',
    created_at: db.stamp(),
  };
  db.tables.jobs.push(job);
  return job;
};
const readBody = async (res) => {
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { res, text, body };
};
const upload = async (candidateId, bytes, name = 'cv.pdf') => {
  const form = new FormData();
  form.append('resume', new Blob([bytes], { type: 'application/pdf' }), name);
  return readBody(await fetch(`${base}/api/resume/upload`, { method: 'POST', body: form, headers: { 'X-Test-User': candidateId } }));
};
const apply = async (candidateId, jobId) =>
  readBody(await fetch(`${base}/api/jobs/${jobId}/apply`, { method: 'POST', headers: { 'X-Test-User': candidateId } }));
const scoreAgain = async (candidateId, applicationId) =>
  readBody(await fetch(`${base}/api/applications/${applicationId}/score`, { method: 'POST', headers: { 'X-Test-User': candidateId } }));
const newestScore = (candidateId, jobId) =>
  db.tables.scores.filter((s) => s.candidate_id === candidateId && s.job_id === jobId).at(-1) || null;
const resumeRow = (id) => db.tables.resumes.find((r) => r.id === id);

// ---- tests ----
const KEY_RE = /^resume-\d{8}T\d{9}Z-[0-9a-f]{8}\.pdf$/;
const keysOf = (c) => [...db.store.keys()].filter((k) => k.startsWith(`candidates/${c}/`));
const getObject = async (key) => {
  const res = await fetch(`${supa.url}/storage/v1/object/resumes/${key}`);
  await res.arrayBuffer();
  assert.equal(res.status, 200);
};
// What the upload did before R-38: write the fixed key `resume.pdf` with upsert (an overwrite).
const legacyUpload = async (c, bytes) => {
  const res = await fetch(`${supa.url}/storage/v1/object/resumes/candidates/${c}/resume.pdf`, {
    method: 'POST', body: bytes, headers: { 'content-type': 'application/pdf', 'x-upsert': 'true' },
  });
  await res.arrayBuffer();
  assert.equal(res.status, 200);
};
const assertScoredOn = (c, jobId, snap) => {
  const score = newestScore(c, jobId);
  assert.ok(score, 'a score row exists');
  assert.deepEqual(resumeRow(score.resume_id).skills, snap.entities.skills);
};

test('upload A, apply, upload B, apply at once, CDN purge never lands -> the second application is scored on B; each upload has its own key; nothing deleted', async () => {
  cdn.staleServes = Number.POSITIVE_INFINITY;
  const c = newCandidate();
  const jobA = seedJob();
  const jobB = seedJob();

  assert.equal((await upload(c, RESUME_A)).res.status, 201);
  const first = await apply(c, jobA.id);
  assert.deepEqual(first.body.scoring, { status: 'scored', reason: null }, first.text);
  const [keyA] = keysOf(c);
  assert.ok(cdn.edge.has(keyA), 'the first apply put A at the edge');

  const up = await upload(c, RESUME_B);
  assert.equal(up.res.status, 201, up.text);
  const keyB = keysOf(c).find((k) => k !== keyA);
  assert.ok(keyB, 'B was written to a new key');
  for (const k of [keyA, keyB]) assert.match(k.split('/').pop(), KEY_RE);
  assert.ok(db.store.get(keyA).bytes.equals(RESUME_A), 'A is kept, never overwritten');

  parses.length = 0;
  const second = await apply(c, jobB.id);
  assert.equal(second.res.status, 201, second.text);
  assert.deepEqual(second.body.scoring, { status: 'scored', reason: null }, second.text);
  assert.equal(cdn.staleServed, 0, 'no stale copy was ever served: B\'s key was never cached');
  assertScoredOn(c, jobB.id, SNAP_B);
  const scored = resumeRow(newestScore(c, jobB.id).resume_id);
  assert.equal(scored.file_ref, keyB, 'the score\'s résumé row names the key that was parsed');
  const withJd = parses.filter((x) => x.withJd);
  assert.ok(withJd.length >= 1 && withJd.every((x) => x.resume === 'B'), JSON.stringify(withJd));
  assert.equal(cdn.deletes, 0, 'R-38: no stored résumé is deleted');
});

test('the card sequence: upload A, A is read once, upload B, apply -> B is scored, with a purge that never lands', async () => {
  cdn.staleServes = Number.POSITIVE_INFINITY;
  const c = newCandidate();
  const job = seedJob();
  assert.equal((await upload(c, RESUME_A)).res.status, 201);
  await getObject(keysOf(c)[0]); // something read A (a score-again, an assessment preparation)
  assert.equal((await upload(c, RESUME_B)).res.status, 201);

  const r = await apply(c, job.id);
  assert.deepEqual(r.body.scoring, { status: 'scored', reason: null }, r.text);
  assert.equal(cdn.staleServed, 0);
  assertScoredOn(c, job.id, SNAP_B);
});

test('OLD design (fixed key overwritten in place) with a purge that never lands: the checksum safety net refuses A (storage_error, no score); the NEW design in the same conditions scores B', async () => {
  // Old design: what a pre-R-38 upload left behind, overwritten in place.
  cdn.staleServes = Number.POSITIVE_INFINITY;
  const old = newCandidate();
  const job = seedJob();
  await legacyUpload(old, RESUME_A);
  await getObject(`candidates/${old}/resume.pdf`);
  await legacyUpload(old, RESUME_B);
  parses.length = 0;
  const r = await apply(old, job.id);
  assert.equal(r.res.status, 201, r.text);
  assert.deepEqual(r.body.scoring, { status: 'failed', reason: 'storage_error' }, r.text);
  assert.equal(newestScore(old, job.id), null, 'nothing was scored from bytes that are not the current résumé');
  assert.equal(parses.length, 0, 'the stale bytes were never sent to the parser');
  assert.ok(cdn.staleServed >= 2, 'it was fetched again before giving up');

  // The candidate uploads B again through the app (new design): scored on B at once.
  assert.equal((await upload(old, RESUME_B)).res.status, 201);
  const app = db.tables.applications.find((a) => a.candidate_id === old && a.job_id === job.id);
  const again = await scoreAgain(old, app.id);
  assert.deepEqual(again.body.scoring, { status: 'scored', reason: null }, again.text);
  assertScoredOn(old, job.id, SNAP_B);

  // New design from the start, same never-landing purge: B at once.
  const fresh = newCandidate();
  const job2 = seedJob();
  assert.equal((await upload(fresh, RESUME_A)).res.status, 201);
  await getObject(keysOf(fresh)[0]);
  assert.equal((await upload(fresh, RESUME_B)).res.status, 201);
  const ok = await apply(fresh, job2.id);
  assert.deepEqual(ok.body.scoring, { status: 'scored', reason: null }, ok.text);
  assertScoredOn(fresh, job2.id, SNAP_B);
});

test('OLD design, short purge (1 stale serve): the safety net fetches again and scores B', async () => {
  cdn.staleServes = 1;
  const c = newCandidate();
  const job = seedJob();
  await legacyUpload(c, RESUME_A);
  await getObject(`candidates/${c}/resume.pdf`);
  await legacyUpload(c, RESUME_B);
  const r = await apply(c, job.id);
  assert.deepEqual(r.body.scoring, { status: 'scored', reason: null }, r.text);
  assert.equal(cdn.staleServed, 1);
  assertScoredOn(c, job.id, SNAP_B);
});

test('matchesStoredObject: MD5 first, then size; null when the list gave nothing to check', async () => {
  const { matchesStoredObject } = await import(backendUrl('Services', 'resumePipeline.js'));
  assert.equal(matchesStoredObject(RESUME_B, { md5: md5(RESUME_B), size: RESUME_B.length }), true);
  assert.equal(matchesStoredObject(RESUME_A, { md5: md5(RESUME_B), size: RESUME_A.length }), false, 'the MD5 decides when present');
  assert.equal(matchesStoredObject(RESUME_A, { md5: null, size: RESUME_B.length }), false);
  assert.equal(matchesStoredObject(RESUME_A, { md5: null, size: RESUME_A.length }), true);
  assert.equal(matchesStoredObject(RESUME_A, {}), null);
});

// ---- R-38 follow-ups: the recruiter link opens the scored file; names are the uploaded ones ----
const resumeLink = async (recruiterId, candidateId, applicationId) => {
  const q = applicationId === undefined ? '' : `?applicationId=${encodeURIComponent(applicationId)}`;
  return readBody(await fetch(`${base}/api/resume/candidate/${candidateId}${q}`, {
    headers: { 'X-Test-User': recruiterId, 'X-Test-Role': 'RECRUITER' },
  }));
};
const applicationOf = (c, jobId) => db.tables.applications.find((a) => a.candidate_id === c && a.job_id === jobId);
const LATEST_NOTE = "Showing the candidate's latest résumé; the scored file is not available.";

// Two applications to ONE recruiter's jobs, résumé A uploaded before the first, B before the second.
const twoApplications = async () => {
  const c = newCandidate();
  const jobA = seedJob();
  const jobB = seedJob();
  jobB.recruiter_id = jobA.recruiter_id;
  assert.equal((await upload(c, RESUME_A, 'Alpha Résumé 2026.pdf')).res.status, 201);
  assert.deepEqual((await apply(c, jobA.id)).body.scoring, { status: 'scored', reason: null });
  const [keyA] = keysOf(c);
  assert.equal((await upload(c, RESUME_B, 'beta-cv.pdf')).res.status, 201);
  assert.deepEqual((await apply(c, jobB.id)).body.scoring, { status: 'scored', reason: null });
  const keyB = keysOf(c).find((k) => k !== keyA);
  return { c, jobA, jobB, keyA, keyB, recruiter: jobA.recruiter_id, appA: applicationOf(c, jobA.id), appB: applicationOf(c, jobB.id) };
};

test('recruiter link with applicationId signs the file THAT application was scored on (A for the first, B for the second), with the uploaded name; no applicationId -> newest, with a note', async () => {
  const { c, keyA, keyB, recruiter, appA, appB } = await twoApplications();

  const a = await resumeLink(recruiter, c, appA.id);
  assert.equal(a.res.status, 200, a.text);
  assert.equal(signedFor.at(-1), keyA, 'the first application opens résumé A, not the newest file');
  assert.deepEqual({ fileName: a.body.fileName, source: a.body.source, note: a.body.note },
    { fileName: 'Alpha Résumé 2026.pdf', source: 'scored', note: null });
  assert.match(a.body.url, /token=stub/);

  const b = await resumeLink(recruiter, c, appB.id);
  assert.equal(b.res.status, 200, b.text);
  assert.equal(signedFor.at(-1), keyB);
  assert.deepEqual({ fileName: b.body.fileName, source: b.body.source, note: b.body.note },
    { fileName: 'beta-cv.pdf', source: 'scored', note: null });

  const latest = await resumeLink(recruiter, c);
  assert.equal(latest.res.status, 200, latest.text);
  assert.equal(signedFor.at(-1), keyB);
  assert.equal(latest.body.source, 'latest');
  assert.match(latest.body.note, /latest résumé/);
  assert.equal(latest.body.fileName, 'beta-cv.pdf');
  for (const k of signedFor) assert.ok(k.startsWith(`candidates/${c}/`), k);
});

test('recruiter link falls back to the newest file, SAYING so, when the scored file is gone or its row has no file_ref, and never signs a key outside the candidate folder', async () => {
  const { c, keyA, keyB, recruiter, appA, jobA } = await twoApplications();
  const scoredRow = resumeRow(newestScore(c, jobA.id).resume_id);

  // The scored object no longer exists (removed from the in-memory store only).
  const kept = db.store.get(keyA);
  db.store.delete(keyA);
  try {
    const gone = await resumeLink(recruiter, c, appA.id);
    assert.equal(gone.res.status, 200, gone.text);
    assert.equal(signedFor.at(-1), keyB);
    assert.deepEqual({ source: gone.body.source, note: gone.body.note }, { source: 'latest', note: LATEST_NOTE });
    assert.equal(gone.body.fileName, 'beta-cv.pdf');
  } finally {
    db.store.set(keyA, kept);
  }

  // A row from before R-38 with no key.
  const ref = scoredRow.file_ref;
  scoredRow.file_ref = null;
  const noRef = await resumeLink(recruiter, c, appA.id);
  assert.deepEqual({ status: noRef.res.status, source: noRef.body.source, note: noRef.body.note, signed: signedFor.at(-1) },
    { status: 200, source: 'latest', note: LATEST_NOTE, signed: keyB });

  // A row naming another candidate's object (tampered): never signed.
  const other = newCandidate();
  assert.equal((await upload(other, RESUME_A, 'other.pdf')).res.status, 201);
  const [otherKey] = keysOf(other);
  scoredRow.file_ref = otherKey;
  const foreign = await resumeLink(recruiter, c, appA.id);
  assert.deepEqual({ status: foreign.res.status, source: foreign.body.source, signed: signedFor.at(-1) },
    { status: 200, source: 'latest', signed: keyB });
  assert.ok(!signedFor.includes(otherKey), 'another candidate\'s key is never signed');
  scoredRow.file_ref = ref;
});

test('recruiter link authorisation is unchanged: another recruiter gets 404; an application of another candidate gets 404; a bad applicationId gets 400', async () => {
  const { c, recruiter, appA } = await twoApplications();
  const stranger = randomUUID();
  for (const r of [await resumeLink(stranger, c), await resumeLink(stranger, c, appA.id)]) {
    assert.equal(r.res.status, 404, r.text);
    assert.equal(r.body.error, 'not_found');
  }
  const second = await twoApplications();
  // The same recruiter's job, but another candidate's application.
  for (const j of db.tables.jobs) if (j.recruiter_id === second.recruiter) j.recruiter_id = recruiter;
  const crossed = await resumeLink(recruiter, c, second.appA.id);
  assert.equal(crossed.res.status, 404, crossed.text);
  const bad = await resumeLink(recruiter, c, 'not-a-uuid');
  assert.equal(bad.res.status, 400, bad.text);
  assert.equal(bad.body.error, 'invalid_application_id');
  assert.equal(signedFor.length, 0, JSON.stringify(signedFor));
});

test('the parse row apply writes keeps the uploaded file name, and results show it, never the storage key', async () => {
  const { c, jobA, jobB, appA } = await twoApplications();
  assert.equal(resumeRow(newestScore(c, jobA.id).resume_id).file_name, 'Alpha Résumé 2026.pdf');
  assert.equal(resumeRow(newestScore(c, jobB.id).resume_id).file_name, 'beta-cv.pdf');
  const r = await readBody(await fetch(`${base}/api/applications/${appA.id}/result`, { headers: { 'X-Test-User': c } }));
  assert.equal(r.res.status, 200, r.text);
  assert.equal(r.body.score.resumeFileName, 'Alpha Résumé 2026.pdf');

  // A row that recorded only the storage key (written before this fix): a neutral label.
  const row = resumeRow(newestScore(c, jobA.id).resume_id);
  const before = row.file_name;
  row.file_name = row.file_ref.split('/').pop();
  const neutral = await readBody(await fetch(`${base}/api/applications/${appA.id}/result`, { headers: { 'X-Test-User': c } }));
  assert.equal(neutral.body.score.resumeFileName, 'résumé.pdf');
  assert.ok(!/resume-\d{8}T/.test(neutral.text), 'no storage key in the result');
  row.file_name = before;
});

test('displayFileName: the uploaded name, cleaned; a storage key, an empty name or a wrong extension -> résumé.<ext>', async () => {
  const { displayFileName } = await import(backendUrl('Services', 'resumePipeline.js'));
  assert.equal(displayFileName('My CV.pdf', '.pdf'), 'My CV.pdf');
  assert.equal(displayFileName('resume-20261114T033449220Z-8198e018.pdf', '.pdf'), 'résumé.pdf');
  assert.equal(displayFileName('resume.PDF', '.pdf'), 'résumé.pdf');
  assert.equal(displayFileName('../../etc\\evil\\Jane Doe.docx', '.docx'), 'Jane Doe.docx');
  assert.equal(displayFileName('a\u0000b‮\n  c.pdf', '.pdf'), 'ab c.pdf');
  assert.equal(displayFileName('photo.png', '.pdf'), 'résumé.pdf');
  assert.equal(displayFileName('', '.docx'), 'résumé.docx');
  assert.equal(displayFileName(null, '.pdf'), 'résumé.pdf');
  assert.equal(displayFileName(`${'x'.repeat(300)}.pdf`, '.pdf'), `${'x'.repeat(100)}.pdf`);
  assert.equal(displayFileName('cv.pdf', '.exe'), 'résumé');
});
