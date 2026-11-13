// R-10 (offline): score on apply, score-again, `/api/analyze` removed
// (REBUILD/DECISIONS.md §4.1, §5, §7; Y1 and its condition).
//
// Nothing leaves loopback and no model is loaded. Core's real routers are mounted
// in process; its Supabase client points at a local stub (PostgREST tables in
// memory + Storage) through BACKEND_ENV_FILE; nlp-engine is a stub that replays the
// R-05 snapshots for the fixture whose bytes it receives; github-evidence is a
// stub that answers with the synthetic fixture or an R-06 "inactive" body.
//
//   node --test tests/backend/score-on-apply.test.mjs
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_DIR, TESTS_DIR } from './lib/env.mjs';
import { startStub, json, raw } from './lib/stub-server.mjs';

const backendUrl = (...parts) =>
  new URL(`file:///${join(REPO_DIR, 'backend', ...parts).replace(/\\/g, '/')}`);
const express = createRequire(join(REPO_DIR, 'backend', 'package.json'))('express');

const FIXTURES = join(TESTS_DIR, 'fixtures');
const SNAPSHOTS = join(TESTS_DIR, 'nlp', 'snapshots', 'current');
const F1 = readFileSync(join(FIXTURES, 'f1_dev_github.pdf'));
const F3 = readFileSync(join(FIXTURES, 'f3_support_nogithub.pdf'));
const SNAP = {
  f1: JSON.parse(readFileSync(join(SNAPSHOTS, 'f1_dev_github.json'), 'utf8')),
  f3: JSON.parse(readFileSync(join(SNAPSHOTS, 'f3_support_nogithub.json'), 'utf8')),
};
const GH_FIXTURE = JSON.parse(readFileSync(join(TESTS_DIR, 'backend', 'fixtures', 'github-evidence-example-mokafor.json'), 'utf8'));
const NLP_LEAK = 'LEAKY-NLP-TRACEBACK File "/srv/app/main.py", line 99';

// R-06's answer for an account with repositories and no commits in the window
// (github-evidence/README.md "No recent activity"), as in explainability.test.mjs.
const off = (reason) => ({ value: null, weight: 0, available: false, reason });
const GH_INACTIVE = {
  ...GH_FIXTURE,
  commit_activity: { available: true, window_days: 365, authored_commits: 0, active_weeks: 0, weeks: 52, weekly: Array(52).fill(0) },
  repositories: { ...GH_FIXTURE.repositories, with_authored_commits: 0 },
  sub_score: {
    available: false, value: null, reason_code: 'no_recent_public_activity', weights_source: 'default', partial: false,
    components: ['activity', 'consistency', 'ownership', 'corroboration'].map((key) => ({ key, ...off('no_recent_public_activity') })),
  },
};

const P = 'parsing_semantic_alignment';
const G = 'github_evidence';
const A = 'assessment_results';
const RECRUITER_A = '22222222-2222-4222-8222-00000000000a';
const RECRUITER_B = '22222222-2222-4222-8222-00000000000b';
const ADMIN = '33333333-3333-4333-8333-000000000001';
let candidateSeq = 0;
const newCandidate = () => `11111111-1111-4111-8111-${String(++candidateSeq).padStart(12, '0')}`;

// ---- Supabase stub: an in-memory PostgREST (eq / in filters, order, limit, one embed) + Storage ----
const tables = { jobs: [], applications: [], resumes: [], scores: [], assessments: [] };
const store = new Map(); // object path -> { bytes, contentType, updated_at }
let supaMode = {};       // { listError, assessmentError, scoreInsertError, applicationInsertError }
let clock = Date.parse('2026-11-14T10:00:00Z');
const stamp = () => new Date(clock += 1000).toISOString();

const filterRows = (rows, params) => {
  let out = rows;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns'].includes(k) || k.includes('.')) continue;
    if (v.startsWith('eq.')) out = out.filter((r) => String(r[k]) === v.slice(3));
    else if (v.startsWith('in.(')) {
      const set = new Set(v.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')));
      out = out.filter((r) => set.has(String(r[k])));
    } else throw new Error(`stub: unsupported filter ${k}=${v}`);
  }
  const order = params.get('order');
  if (order) {
    const [col, dir] = order.split('.');
    out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === 'desc' ? -1 : 1));
  }
  const limit = Number(params.get('limit'));
  if (limit) out = out.slice(0, limit);
  return out;
};

const answer = (req, res, rows, status = 200) => {
  if (/vnd\.pgrst\.object/.test(req.headers.accept || '')) {
    if (rows.length !== 1) return json(res, 406, { code: 'PGRST116', message: 'stub: not exactly one row' });
    return json(res, status, rows[0]);
  }
  return json(res, status, rows);
};

const dbError = (res) => json(res, 400, { code: '42P01', message: 'LEAKY-STUB database failure' });

const supabaseHandler = (req, res, rec) => {
  const url = new URL(req.url, 'http://stub');
  const p = decodeURIComponent(url.pathname);
  const params = url.searchParams;

  // Storage
  if (req.method === 'POST' && p === '/storage/v1/object/list/resumes') {
    if (supaMode.listError) return json(res, 500, { statusCode: '500', error: 'stub_error', message: 'LEAKY-STUB storage failure' });
    const prefix = `${rec.body?.prefix || ''}/`;
    const items = [...store.entries()]
      .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
      .map(([k, v]) => ({ name: k.slice(prefix.length), id: k, updated_at: v.updated_at, created_at: v.updated_at, metadata: {} }));
    return json(res, 200, items);
  }
  if (req.method === 'GET' && p.startsWith('/storage/v1/object/resumes/')) {
    const obj = store.get(p.slice('/storage/v1/object/resumes/'.length));
    if (!obj) return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    res.writeHead(200, { 'content-type': obj.contentType || 'application/octet-stream' });
    return res.end(obj.bytes);
  }

  // PostgREST
  const m = p.match(/^\/rest\/v1\/(\w+)$/);
  if (!m) return json(res, 404, { message: `stub: no route ${req.method} ${p}` });
  const table = m[1];

  if (table === 'profiles' && req.method === 'GET') return answer(req, res, [{ is_suspended: false }]);

  if (req.method === 'POST') {
    if (table === 'scores' && supaMode.scoreInsertError) return dbError(res);
    if (table === 'applications' && supaMode.applicationInsertError) return dbError(res);
    if (table === 'applications'
      && tables.applications.some((a) => a.candidate_id === rec.body.candidate_id && a.job_id === rec.body.job_id)) {
      return json(res, 409, { code: '23505', message: 'LEAKY-STUB duplicate key' });
    }
    const row = { id: randomUUID(), created_at: stamp(), ...rec.body };
    if (table === 'applications') row.submitted_at = row.created_at;
    tables[table].push(row);
    return answer(req, res, [row], 201);
  }
  if (req.method === 'GET') {
    if (table === 'assessments' && supaMode.assessmentError) return dbError(res);
    let rows = filterRows(tables[table], params);
    if (table === 'applications' && /job:jobs/.test(params.get('select') || '')) {
      rows = rows.map((a) => ({ ...a, job: tables.jobs.find((j) => j.id === a.job_id) || null }));
    }
    return answer(req, res, rows);
  }
  return json(res, 405, { message: `stub: ${req.method} ${p} is not expected (scores are never updated in place)` });
};

// ---- nlp-engine stub ----
let nlpMode = 'replay'; // 'replay' | 'nosim' | 'nolink' | 'crash'
const nlpHandler = (req, res, rec) => {
  if (nlpMode === 'crash') return raw(res, 500, `Internal Server Error\n${NLP_LEAK}`, 'text/plain');
  const body = rec.rawBody;
  const hasJd = body.includes(Buffer.from('name="jd"'));
  const snap = body.includes(F1) ? SNAP.f1 : body.includes(F3) ? SNAP.f3 : null;
  if (!snap) return json(res, 422, { error: 'unreadable_document', reason: 'corrupt', message: 'stub: unknown file' });
  let out = { ...snap, semantic_analysis: hasJd ? snap.semantic_analysis : null };
  if (nlpMode === 'nosim') out = { ...out, semantic_analysis: null };
  if (nlpMode === 'nolink') out = { ...out, entities: { ...out.entities, github: null } };
  return json(res, 200, out);
};

// ---- github-evidence stub ----
let ghBody = GH_FIXTURE;
const ghHandler = (req, res) => json(res, 200, ghBody);

let supa;
let nlp;
let gh;
let envDir;
let mods;
let server;
let base;
let nlpUrl;

const fakeServiceKey = () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'service_role' })}.sig`;
};

const closedPortUrl = async (suffix = '') => {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return `http://127.0.0.1:${port}${suffix}`;
};

before(async () => {
  supa = await startStub({ handler: supabaseHandler });
  nlp = await startStub({ handler: nlpHandler });
  gh = await startStub({ handler: ghHandler });
  nlpUrl = `${nlp.url}/parse`;

  envDir = mkdtempSync(join(tmpdir(), 'patina-r10-'));
  const envFile = join(envDir, 'backend.env');
  writeFileSync(envFile, [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${fakeServiceKey()}`,
    'SUPABASE_ANON_KEY=stub-anon-key',
    'SESSION_SECRET=r10-offline-test-secret-r10-offline',
    'SUPABASE_TIMEOUT_MS=3000',
    `NLP_PARSE_URL=${nlpUrl}`,
    `GITHUB_EVIDENCE_URL=${gh.url}`,
  ].join('\n'));
  process.env.BACKEND_ENV_FILE = envFile;
  delete process.env.CREDIBILITY_WEIGHTS;
  // R-11: apply now starts assessment preparation in the background. Point it at a
  // closed loopback port (never :8002, never an LLM) with no retries.
  process.env.ASSESSMENT_SERVICE_URL = await closedPortUrl();
  process.env.ASSESSMENT_PREPARE_RETRIES = '0';

  mods = {
    errors: await import(backendUrl('Middlewares', 'errorHandler.js')),
    requestId: await import(backendUrl('Middlewares', 'requestId.js')),
    jobsRoutes: (await import(backendUrl('Routes', 'jobs.routes.js'))).default,
    analysisRoutes: (await import(backendUrl('Routes', 'analysis.routes.js'))).default,
    scoring: await import(backendUrl('Services', 'scoringPipeline.js')),
    x: await import(backendUrl('Services', 'explainability.js')),
  };
  assert.equal(process.env.SUPABASE_URL, supa.url, 'Supabase client is not pointed at the local stub');

  const app = express();
  app.use(mods.requestId.requestIdMiddleware);
  app.use(mods.errors.errorContract);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: req.get('X-Test-User'), role: req.get('X-Test-Role') || 'CANDIDATE' };
    next();
  });
  // Mounted as backend/index.js mounts them.
  app.use('/api/jobs', mods.jobsRoutes);
  app.use('/api', mods.analysisRoutes);
  app.use(mods.errors.notFoundHandler);
  app.use(mods.errors.errorHandler);
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
  await gh?.close();
  if (envDir) rmSync(envDir, { recursive: true, force: true });
});

beforeEach(() => {
  supaMode = {};
  nlpMode = 'replay';
  ghBody = GH_FIXTURE;
  process.env.NLP_PARSE_URL = nlpUrl;
  process.env.GITHUB_EVIDENCE_URL = gh.url;
});

// ---- helpers ----
const seedJob = ({ recruiterId = RECRUITER_A, status = 'published' } = {}) => {
  const job = {
    id: randomUUID(),
    recruiter_id: recruiterId,
    title: '[R-10 TEST] Backend engineer',
    description: 'Backend engineer: Python, SQL, PostgreSQL, Docker, REST APIs.',
    required_skills: ['python', 'sql', 'postgresql', 'docker', 'git', 'rest api'],
    preferred_skills: ['react', 'redis', 'aws', 'kubernetes'],
    experience_level: 'mid',
    location: 'Remote',
    status,
    created_at: stamp(),
  };
  tables.jobs.push(job);
  return job;
};
const seedResume = (candidateId, bytes = F1) =>
  store.set(`candidates/${candidateId}/resume.pdf`, { bytes, contentType: 'application/pdf', updated_at: stamp() });

const call = async (method, path, { user, role = 'CANDIDATE', requestId } = {}) => {
  const headers = { 'X-Test-User': user || '', 'X-Test-Role': role };
  if (requestId) headers['X-Request-ID'] = requestId;
  const res = await fetch(`${base}${path}`, { method, headers });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { res, text, body };
};
const apply = (candidateId, jobId, opts = {}) => call('POST', `/api/jobs/${jobId}/apply`, { user: candidateId, ...opts });
const scoreAgain = (applicationId, user, role) => call('POST', `/api/applications/${applicationId}/score`, { user, role });
const scoresFor = (candidateId, jobId) => tables.scores.filter((s) => s.candidate_id === candidateId && s.job_id === jobId);
const applicationOf = (candidateId, jobId) => tables.applications.find((a) => a.candidate_id === candidateId && a.job_id === jobId);
const weightSum = (w) => Object.values(w).reduce((s, n) => s + n, 0);

const assertNoLeak = (text) => {
  for (const s of ['LEAKY', 'Traceback', '/srv/app', '42P01', supa.url, nlp.url, gh.url]) {
    assert.ok(!text.includes(s), `response leaked ${JSON.stringify(s)}: ${text}`);
  }
};

const ready = (resumeBytes = F1) => {
  const candidateId = newCandidate();
  seedResume(candidateId, resumeBytes);
  return { candidateId, job: seedJob() };
};

// ---- tests ----
test('apply with scoring OK -> 201 scored; one inserted score row; weights sum to 1; band and ownership note present', async () => {
  const { candidateId, job } = ready();
  const { res, body, text } = await apply(candidateId, job.id, { requestId: 'r10-req-0001' });
  assert.equal(res.status, 201, text);
  assert.deepEqual(body.scoring, { status: 'scored', reason: null });
  assert.equal(body.candidate_id, candidateId);
  assert.equal(body.job_id, job.id);
  assert.equal(body.status, 'submitted');
  assert.ok(applicationOf(candidateId, job.id), 'application row saved');

  const rows = scoresFor(candidateId, job.id);
  assert.equal(rows.length, 1, 'exactly one scores row');
  const row = rows[0];
  assert.ok(Math.abs(weightSum(row.weights) - 1) < 1e-3, `weights sum to ${weightSum(row.weights)}`);
  assert.equal(row.subscores[P].available, true);
  assert.equal(row.subscores[G].available, true, 'GitHub fixture is active');
  assert.equal(row.subscores[A].available, false);
  assert.equal(row.evidence_limited, true);
  assert.equal(row.explanation.band, mods.x.scoreBand(row.composite_score));
  assert.ok(['high', 'medium', 'low'].includes(row.explanation.band));
  assert.deepEqual(row.explanation.band_thresholds.high, 80);
  assert.equal(row.explanation.github_account.ownership_verified, false);
  assert.match(row.explanation.github_account.note, /taken from the link on the résumé/);
  assert.match(row.explanation.github_account.note, /not verified/);
  assert.equal(row.subscores[G].components.ownership_verified, false);

  // The resumes row it points at: parsed against this job, parser version from the service.
  const resume = tables.resumes.find((r) => r.id === row.resume_id);
  assert.equal(resume.job_id, job.id);
  assert.equal(resume.parser_version, SNAP.f1.parser_version);
  assert.ok(!('raw_text' in resume));
  const nlpCall = nlp.requests.at(-1);
  assert.ok(nlpCall.rawBody.includes(Buffer.from('name="jd"')), 'the job description was sent for similarity');
  assert.equal(nlpCall.headers['x-request-id'], 'r10-req-0001');
  assert.equal(gh.requests.at(-1).headers['x-request-id'], 'r10-req-0001');

  // The candidate's list reads `scored`.
  const mine = await call('GET', '/api/jobs/my-applications', { user: candidateId });
  assert.equal(mine.res.status, 200);
  assert.deepEqual(mine.body.find((a) => a.job_id === job.id).scoring, { state: 'scored' });

  // The candidate's analysis carries the same band.
  const analysis = await call('GET', '/api/candidate-analysis', { user: candidateId });
  assert.equal(analysis.res.status, 200, analysis.text);
  assert.equal(analysis.body.band, row.explanation.band);
});

test('apply with the parser down -> 201 failed parser_unavailable; application exists; no score row; lists as pending; retry scores it', async () => {
  const { candidateId, job } = ready();
  process.env.NLP_PARSE_URL = await closedPortUrl('/parse');
  const { res, body, text } = await apply(candidateId, job.id);
  assert.equal(res.status, 201, text);
  assert.deepEqual(body.scoring, { status: 'failed', reason: 'parser_unavailable' });
  assert.ok(applicationOf(candidateId, job.id), 'the application row must exist');
  assert.equal(body.id, applicationOf(candidateId, job.id).id);
  assert.equal(scoresFor(candidateId, job.id).length, 0, 'no score row');
  assertNoLeak(text);
  assert.ok(!/ECONNREFUSED|fetch failed|127\.0\.0\.1/.test(text), text);

  const mine = await call('GET', '/api/jobs/my-applications', { user: candidateId });
  assert.deepEqual(mine.body.find((a) => a.job_id === job.id).scoring, { state: 'pending' });

  // Applying again is a conflict, not a second application.
  process.env.NLP_PARSE_URL = nlpUrl;
  assert.equal((await apply(candidateId, job.id)).res.status, 409);
  assert.equal(tables.applications.filter((a) => a.candidate_id === candidateId).length, 1);

  // Parser back: score-again as the candidate succeeds and the list reads `scored`.
  const appId = applicationOf(candidateId, job.id).id;
  const again = await scoreAgain(appId, candidateId, 'CANDIDATE');
  assert.equal(again.res.status, 200, again.text);
  assert.deepEqual(again.body, { applicationId: appId, scoring: { status: 'scored', reason: null } });
  assert.equal(scoresFor(candidateId, job.id).length, 1);
  const after = await call('GET', '/api/jobs/my-applications', { user: candidateId });
  assert.deepEqual(after.body.find((a) => a.job_id === job.id).scoring, { state: 'scored' });
});

test('score-again: owning candidate and owning recruiter -> 200 and a NEW row each; other recruiter, other candidate, admin -> 403', async () => {
  const { candidateId, job } = ready();
  assert.equal((await apply(candidateId, job.id)).res.status, 201);
  const appId = applicationOf(candidateId, job.id).id;
  const first = scoresFor(candidateId, job.id)[0];
  const firstCopy = JSON.parse(JSON.stringify(first));

  let r = await scoreAgain(appId, candidateId, 'CANDIDATE');
  assert.equal(r.res.status, 200, r.text);
  assert.equal(r.body.scoring.status, 'scored');
  r = await scoreAgain(appId, RECRUITER_A, 'RECRUITER');
  assert.equal(r.res.status, 200, r.text);
  assert.deepEqual(r.body.scoring, { status: 'scored', reason: null });
  assert.equal(scoresFor(candidateId, job.id).length, 3, 'each score-again inserts a row');
  assert.deepEqual(scoresFor(candidateId, job.id)[0], firstCopy, 'the first row is unchanged');

  for (const [user, role] of [[RECRUITER_B, 'RECRUITER'], [newCandidate(), 'CANDIDATE'], [ADMIN, 'ADMIN']]) {
    r = await scoreAgain(appId, user, role);
    assert.equal(r.res.status, 403, `${role}: ${r.text}`);
    assert.equal(r.body.error, 'forbidden');
  }
  assert.equal(scoresFor(candidateId, job.id).length, 3, 'a refused call scored nothing');

  r = await scoreAgain(randomUUID(), candidateId, 'CANDIDATE');
  assert.equal(r.res.status, 404);
  r = await scoreAgain('not-a-uuid', candidateId, 'CANDIDATE');
  assert.equal(r.res.status, 400);
});

test('missing similarity -> parsing UNAVAILABLE with a reason, weights redistributed (never an available 0)', async () => {
  const { candidateId, job } = ready();
  nlpMode = 'nosim';
  const { res, body, text } = await apply(candidateId, job.id);
  assert.equal(res.status, 201, text);
  assert.deepEqual(body.scoring, { status: 'scored', reason: null });
  const [row] = scoresFor(candidateId, job.id);
  const parsing = row.subscores[P];
  assert.equal(parsing.available, false);
  assert.equal(parsing.value, null);
  assert.equal(parsing.weight, 0);
  assert.equal(parsing.components.reason_code, 'no_similarity');
  assert.match(parsing.reason, /not scored/);
  assert.equal(row.weights[G], 1, 'all weight moves to the evidence that exists');
  assert.equal(Number(row.composite_score), row.subscores[G].value);
});

test('no evidence at all (no similarity, no GitHub link, no assessment) -> failed no_evidence, application kept, no score row', async () => {
  const { candidateId, job } = ready(F3);
  nlpMode = 'nosim';
  const { res, body, text } = await apply(candidateId, job.id);
  assert.equal(res.status, 201, text);
  assert.deepEqual(body.scoring, { status: 'failed', reason: 'no_evidence' });
  assert.ok(applicationOf(candidateId, job.id));
  assert.equal(scoresFor(candidateId, job.id).length, 0);
});

test('R-06 through core: an inactive GitHub account gives the same composite as no account; reason no_recent_public_activity', async () => {
  const inactive = ready();
  ghBody = GH_INACTIVE;
  assert.equal((await apply(inactive.candidateId, inactive.job.id)).body.scoring.status, 'scored');
  const [a] = scoresFor(inactive.candidateId, inactive.job.id);

  const none = ready();
  nlpMode = 'nolink'; // same parse, no GitHub link on the resume
  const ghCalls = gh.requests.length;
  assert.equal((await apply(none.candidateId, none.job.id)).body.scoring.status, 'scored');
  assert.equal(gh.requests.length, ghCalls, 'no link -> no github-evidence call');
  const [b] = scoresFor(none.candidateId, none.job.id);

  assert.equal(a.subscores[G].components.reason_code, 'no_recent_public_activity');
  assert.equal(a.subscores[G].reason, mods.x.GITHUB_REASONS.no_recent_public_activity);
  assert.equal(b.subscores[G].components.reason_code, 'no_github_link');
  assert.deepEqual(a.weights, b.weights);
  assert.equal(Number(a.composite_score), Number(b.composite_score));
});

test('GitHub down degrades the score (evidence-limited), it does not fail scoring', async () => {
  const { candidateId, job } = ready();
  process.env.GITHUB_EVIDENCE_URL = await closedPortUrl();
  const { res, body } = await apply(candidateId, job.id);
  assert.equal(res.status, 201);
  assert.deepEqual(body.scoring, { status: 'scored', reason: null });
  const [row] = scoresFor(candidateId, job.id);
  assert.equal(row.subscores[G].components.reason_code, 'service_unavailable');
  assert.equal(row.weights[P], 1);
  assert.equal(row.evidence_limited, true);
});

test('assessment: a completed attempt is folded in; a lookup error fails scoring (B7) and never reads as "no assessment"', async () => {
  const { candidateId, job } = ready();
  tables.assessments.push({
    id: randomUUID(), candidate_id: candidateId, job_id: job.id, status: 'completed', completed_at: stamp(),
    evaluation: { score: 62.5, points_earned: 2.5, points_possible: 4, short_answer_graded: true, results: [
      { question_type: 'mcq', points: 1, max_points: 1 }, { question_type: 'mcq', points: 0, max_points: 1 },
      { question_type: 'mcq', points: 1, max_points: 1 }, { question_type: 'short_answer', points: 0.5, max_points: 1 }] },
  });
  assert.equal((await apply(candidateId, job.id)).body.scoring.status, 'scored');
  const [row] = scoresFor(candidateId, job.id);
  assert.equal(row.subscores[A].available, true);
  assert.equal(row.subscores[A].value, 62.5);
  assert.equal(row.evidence_limited, false);
  assert.ok(Math.abs(weightSum(row.weights) - 1) < 1e-3);

  const other = ready();
  supaMode = { assessmentError: true };
  const { res, body, text } = await apply(other.candidateId, other.job.id);
  assert.equal(res.status, 201, text);
  assert.deepEqual(body.scoring, { status: 'failed', reason: 'assessment_lookup_failed' });
  assert.ok(applicationOf(other.candidateId, other.job.id));
  assert.equal(scoresFor(other.candidateId, other.job.id).length, 0);
  assertNoLeak(text);
});

test('parser crash -> failed parser_failed; the NLP error body is never echoed (O1, moved from analyze)', async () => {
  const { candidateId, job } = ready();
  nlpMode = 'crash';
  const { res, body, text } = await apply(candidateId, job.id);
  assert.equal(res.status, 201, text);
  assert.deepEqual(body.scoring, { status: 'failed', reason: 'parser_failed' });
  assertNoLeak(text);
});

test('a score insert error -> 201 failed score_insert_failed; the application stays', async () => {
  const { candidateId, job } = ready();
  supaMode = { scoreInsertError: true };
  const { res, body, text } = await apply(candidateId, job.id);
  assert.equal(res.status, 201, text);
  assert.deepEqual(body.scoring, { status: 'failed', reason: 'score_insert_failed' });
  assert.ok(applicationOf(candidateId, job.id));
  assertNoLeak(text);
});

test('apply gates: no resume -> 400; storage error -> 500 (not "no resume"); insert error -> 500; bad or closed job -> 404; nothing is scored', async () => {
  const job = seedJob();
  const noResume = newCandidate();
  let r = await apply(noResume, job.id);
  assert.equal(r.res.status, 400);
  assert.equal(r.body.code, 'RESUME_REQUIRED');

  const c = newCandidate();
  seedResume(c);
  supaMode = { listError: true };
  r = await apply(c, job.id);
  assert.equal(r.res.status, 500);
  assert.equal(r.body.error, 'storage_error');
  assertNoLeak(r.text);
  assert.equal(applicationOf(c, job.id), undefined);

  supaMode = { applicationInsertError: true };
  r = await apply(c, job.id);
  assert.equal(r.res.status, 500);
  assertNoLeak(r.text);
  assert.equal(scoresFor(c, job.id).length, 0, 'no scoring without a saved application');

  r = await apply(c, 'not-a-uuid');
  assert.equal(r.res.status, 404);
  const closed = seedJob({ status: 'closed' });
  r = await apply(c, closed.id);
  assert.equal(r.res.status, 404);
});

test('POST /api/analyze is gone -> 404 (Y1)', async () => {
  const c = newCandidate();
  const { res, body } = await call('POST', '/api/analyze', { user: c });
  assert.equal(res.status, 404);
  assert.equal(body.error, 'not_found');
  const src = readFileSync(join(REPO_DIR, 'backend', 'Routes', 'analysis.routes.js'), 'utf8');
  assert.ok(!/['"]\/analyze['"]/.test(src), 'the /analyze route is still declared');
  const ctl = readFileSync(join(REPO_DIR, 'backend', 'Controllers', 'analysis.controller.js'), 'utf8');
  assert.ok(!/analyzeResume|PARSER_VERSION/.test(ctl), 'the analyze handler or a hardcoded parser version remains');
});

test('scoreApplication contract: reasons are stable codes; never throws; job loaded by id', async () => {
  const { scoreApplication, SCORING_FAILURE_REASONS, scoringSummary } = mods.scoring;
  assert.deepEqual(await scoreApplication({}), { status: 'failed', reason: 'internal_error' });
  assert.deepEqual(await scoreApplication({ candidateId: newCandidate(), jobId: randomUUID() }), { status: 'failed', reason: 'job_not_found' });
  const noResume = await scoreApplication({ candidateId: newCandidate(), jobId: seedJob().id });
  assert.deepEqual(noResume, { status: 'failed', reason: 'no_resume' });
  for (const code of SCORING_FAILURE_REASONS) assert.match(code, /^[a-z][a-z_]*$/);
  assert.deepEqual(scoringSummary({ status: 'failed', reason: 'parser_failed' }), { status: 'failed', reason: 'parser_failed' });

  const { candidateId, job } = ready();
  const out = await scoreApplication({ candidateId, jobId: job.id, requestId: 'r10-direct' });
  assert.equal(out.status, 'scored');
  assert.equal(out.reason, null);
  assert.equal(out.score.id, scoresFor(candidateId, job.id)[0].id);
  assert.equal(out.score.band, mods.x.scoreBand(out.score.composite));
  assert.equal(out.parserVersion, SNAP.f1.parser_version);
});
