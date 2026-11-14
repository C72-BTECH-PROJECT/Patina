// R-09 (offline): one resume pipeline; parsing on upload (REBUILD/DECISIONS.md §3, §4.1).
//
// Nothing leaves loopback and no model is loaded. Core's Supabase client is pointed
// at a local stub (PostgREST + Storage, an in-memory object store) through
// BACKEND_ENV_FILE, and nlp-engine is a stub that replays the R-05 snapshots
// (tests/nlp/snapshots/current/) for the fixture whose bytes it receives.
//
//   node --test tests/backend/resume-pipeline.test.mjs
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_DIR, TESTS_DIR } from './lib/env.mjs';
import { startStub, json, raw, hang } from './lib/stub-server.mjs';

const backendUrl = (...parts) =>
  new URL(`file:///${join(REPO_DIR, 'backend', ...parts).replace(/\\/g, '/')}`);
const express = createRequire(join(REPO_DIR, 'backend', 'package.json'))('express');

const FIXTURES = join(TESTS_DIR, 'fixtures');
const SNAPSHOTS = join(TESTS_DIR, 'nlp', 'snapshots', 'current');
const F1 = readFileSync(join(FIXTURES, 'f1_dev_github.pdf'));
const F2 = readFileSync(join(FIXTURES, 'f2_dev_github.docx'));
const F6 = readFileSync(join(FIXTURES, 'f6_image_only.pdf'));
const F7 = readFileSync(join(FIXTURES, 'f7_realworld_links.pdf'));
const SNAP = {
  f1: JSON.parse(readFileSync(join(SNAPSHOTS, 'f1_dev_github.json'), 'utf8')),
  f2: JSON.parse(readFileSync(join(SNAPSHOTS, 'f2_dev_github.json'), 'utf8')),
  f6: JSON.parse(readFileSync(join(SNAPSHOTS, 'f6_image_only.json'), 'utf8')),
  f7: JSON.parse(readFileSync(join(SNAPSHOTS, 'f7_realworld_links.json'), 'utf8')),
};
const NLP_LEAK = 'LEAKY-NLP-TRACEBACK File "/srv/app/main.py", line 99';
const PARSER_DOWN_MESSAGE = 'Your resume was saved, but it could not be read right now because the resume parser is unavailable. Please try again later.';

let candidateSeq = 0;
const newCandidate = () => `11111111-1111-4111-8111-${String(++candidateSeq).padStart(12, '0')}`;

// ---- Supabase stub: Storage (in-memory store) + PostgREST `resumes` inserts ----
const store = new Map(); // object path -> { bytes, contentType, updated_at }
const inserts = [];      // bodies of POST /rest/v1/resumes
const signedFor = [];    // object paths a signed URL was requested for
const RECRUITER_ID = '22222222-2222-4222-8222-222222222222';
let supaMode = {};       // { listError, uploadError, removeError, insertError }
let clock = Date.parse('2026-11-13T10:00:00Z');

const storageError = (res, status = 400) =>
  json(res, status, { statusCode: String(status), error: 'stub_error', message: 'LEAKY-STUB storage failure' });

const supabaseHandler = (req, res, rec) => {
  const url = new URL(req.url, 'http://stub');
  const p = decodeURIComponent(url.pathname);
  if (req.method === 'POST' && p === '/storage/v1/object/list/resumes') {
    if (supaMode.listError) return storageError(res, 500);
    const prefix = `${rec.body?.prefix || ''}/`;
    const items = [...store.entries()]
      .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
      .map(([k, v]) => ({ name: k.slice(prefix.length), id: k, updated_at: v.updated_at, created_at: v.updated_at, metadata: {} }));
    return json(res, 200, items);
  }
  if (req.method === 'POST' && p.startsWith('/storage/v1/object/resumes/')) {
    if (supaMode.uploadError) return storageError(res, 500);
    const key = p.slice('/storage/v1/object/resumes/'.length);
    if (store.has(key) && req.headers['x-upsert'] !== 'true') return storageError(res, 409);
    clock += 1000;
    store.set(key, { bytes: rec.rawBody, contentType: req.headers['content-type'], updated_at: new Date(clock).toISOString() });
    return json(res, 200, { Id: key, Key: `resumes/${key}` });
  }
  if (req.method === 'GET' && p.startsWith('/storage/v1/object/resumes/')) {
    const obj = store.get(p.slice('/storage/v1/object/resumes/'.length));
    if (!obj) return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    res.writeHead(200, { 'content-type': obj.contentType || 'application/octet-stream' });
    return res.end(obj.bytes);
  }
  if (req.method === 'DELETE' && p === '/storage/v1/object/resumes') {
    if (supaMode.removeError) return storageError(res, 500);
    const removed = [];
    for (const k of rec.body?.prefixes || []) if (store.delete(k)) removed.push({ name: k });
    return json(res, 200, removed);
  }
  if (req.method === 'POST' && p.startsWith('/storage/v1/object/sign/resumes/')) {
    signedFor.push(p.slice('/storage/v1/object/sign/resumes/'.length));
    return json(res, 200, { signedURL: `/object/sign/resumes/x?token=stub` });
  }
  if (req.method === 'GET' && p === '/rest/v1/applications') {
    // The recruiter applied-check: always one matching application in this stub.
    return json(res, 200, [{ id: 'app-1', job: { recruiter_id: RECRUITER_ID } }]);
  }
  if (req.method === 'POST' && p === '/rest/v1/resumes') {
    if (supaMode.insertError) return json(res, 400, { code: '23502', message: 'LEAKY-STUB insert failure' });
    inserts.push(rec.body);
    const row = { id: `00000000-0000-4000-8000-${String(inserts.length).padStart(12, '0')}`, created_at: new Date(clock).toISOString(), ...rec.body };
    return /vnd\.pgrst\.object/.test(req.headers.accept || '') ? json(res, 200, row) : json(res, 201, [row]);
  }
  return json(res, 404, { message: `stub: no route ${req.method} ${p}` });
};

// ---- nlp-engine stub: replays the R-05 snapshot of whichever fixture it receives ----
let nlpMode = 'replay'; // 'replay' | 'replay-2.0' | 'hang' | 'crash' | 'unavailable'
// R-30 follow-up: the shape a parser before 2.1.0 sent for f1: no `links`, education as strings.
const preLinksBody = (snap) => {
  const { links: _links, ...entities } = snap.entities;
  return {
    ...snap,
    parser_version: 'nlp-engine@2.0.0',
    entities: { ...entities, education: entities.education.map((e) => e.text) },
  };
};
const nlpHandler = (req, res, rec) => {
  if (nlpMode === 'hang') return hang();
  if (nlpMode === 'crash') return raw(res, 500, `Internal Server Error\n${NLP_LEAK}`, 'text/plain');
  if (nlpMode === 'unavailable') return json(res, 503, { error: 'model_loading', message: NLP_LEAK });
  const body = rec.rawBody;
  const hasJd = body.includes(Buffer.from('name="jd"'));
  const withJd = (snap) => ({ ...snap, semantic_analysis: hasJd ? snap.semantic_analysis : null });
  if (nlpMode === 'replay-2.0' && body.includes(F1)) return json(res, 200, withJd(preLinksBody(SNAP.f1)));
  if (body.includes(F1)) return json(res, 200, withJd(SNAP.f1));
  if (body.includes(F2)) return json(res, 200, withJd(SNAP.f2));
  if (body.includes(F7)) return json(res, 200, withJd(SNAP.f7));
  if (body.includes(F6)) return json(res, SNAP.f6._http_status, SNAP.f6._body);
  return json(res, 422, { error: 'unreadable_document', reason: 'corrupt', message: 'stub: unknown file' });
};

let supa;
let nlp;
let envDir;
let mods;
let server;
let base;
let nlpUrl;

const fakeServiceKey = () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'service_role' })}.sig`;
};

const closedPortUrl = async () => {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return `http://127.0.0.1:${port}/parse`;
};

before(async () => {
  supa = await startStub({ handler: supabaseHandler });
  nlp = await startStub({ handler: nlpHandler });
  nlpUrl = `${nlp.url}/parse`;

  envDir = mkdtempSync(join(tmpdir(), 'patina-r09-'));
  const envFile = join(envDir, 'backend.env');
  writeFileSync(envFile, [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${fakeServiceKey()}`,
    'SUPABASE_ANON_KEY=stub-anon-key',
    'SESSION_SECRET=r09-offline-test-secret-r09-offline',
    'SUPABASE_TIMEOUT_MS=3000',
    `NLP_PARSE_URL=${nlpUrl}`,
  ].join('\n'));
  process.env.BACKEND_ENV_FILE = envFile;

  mods = {
    errors: await import(backendUrl('Middlewares', 'errorHandler.js')),
    requestId: await import(backendUrl('Middlewares', 'requestId.js')),
    analysis: await import(backendUrl('Controllers', 'analysis.controller.js')),
    pipeline: await import(backendUrl('Services', 'resumePipeline.js')),
  };
  // Guard: the client must be talking to the stub, never the real project.
  assert.equal(process.env.SUPABASE_URL, supa.url, 'Supabase client is not pointed at the local stub');

  const app = express();
  app.use(mods.requestId.requestIdMiddleware);
  app.use(mods.errors.errorContract);
  app.use((req, _res, next) => {
    req.session = { userId: req.get('X-Test-User'), role: req.get('X-Test-Role') || 'CANDIDATE' };
    next();
  });
  app.post('/t/resume/upload', ...mods.analysis.uploadResume);
  app.get('/t/resume/status', mods.analysis.getMyResumeStatus);
  app.get('/t/resume/candidate/:candidateId', mods.analysis.getCandidateResume);
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
  if (envDir) rmSync(envDir, { recursive: true, force: true });
});

beforeEach(() => {
  supaMode = {};
  nlpMode = 'replay';
  process.env.NLP_PARSE_URL = nlpUrl;
  delete process.env.NLP_PARSE_TIMEOUT_MS;
});

const upload = async (candidateId, { bytes, name, type = 'application/pdf', requestId } = {}) => {
  const form = new FormData();
  form.append('resume', new Blob([bytes], { type }), name);
  const headers = { 'X-Test-User': candidateId };
  if (requestId) headers['X-Request-ID'] = requestId;
  const res = await fetch(`${base}/t/resume/upload`, { method: 'POST', body: form, headers });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { res, text, body };
};

const objectsOf = (candidateId) =>
  [...store.keys()].filter((k) => k.startsWith(`candidates/${candidateId}/`) || k.startsWith(`${candidateId}/`));
// R-38: every upload is stored under its own key, `candidates/<id>/resume-<UTC stamp>-<8 hex>.<ext>`.
const uploadKeyRe = (candidateId, ext) =>
  new RegExp(`^candidates/${candidateId}/resume-\\d{8}T\\d{9}Z-[0-9a-f]{8}\\.${ext}$`);
/** The candidate's objects; asserts there are `n` and that each is an upload key of `ext`. */
const uploadKeys = (candidateId, ext, n = 1) => {
  const keys = objectsOf(candidateId);
  assert.equal(keys.length, n, `objects: ${JSON.stringify(keys)}`);
  for (const k of keys) assert.match(k, uploadKeyRe(candidateId, ext));
  return keys;
};

const assertContract = (res, body, status, error) => {
  assert.equal(res.status, status, JSON.stringify(body));
  assert.equal(body.error, error);
  assert.equal(typeof body.message, 'string');
  assert.ok(body.message.length > 0);
  assert.equal(body.requestId, res.headers.get('x-request-id'));
};

const assertNoLeak = (text) => {
  for (const s of ['LEAKY', 'Traceback', '/srv/app', supa.url, nlp.url, String(nlp.port)]) {
    assert.ok(!text.includes(s), `response leaked ${JSON.stringify(s)}: ${text}`);
  }
};

const nlpCalls = () => nlp.requests.length;

test('f1 upload -> 201 with skills; stored at a new key candidates/<id>/resume-<stamp>-<rand>.pdf; row persisted without full text', async () => {
  const id = newCandidate();
  const insertsBefore = inserts.length;
  const nlpBefore = nlpCalls();
  const { res, body, text } = await upload(id, { bytes: F1, name: 'Maya Okafor CV.pdf', requestId: 'r09-req-0001' });
  assert.equal(res.status, 201, text);
  assert.deepEqual(body.parsed.skills, SNAP.f1.entities.skills);
  assert.ok(body.parsed.skills.length > 0);
  assert.equal(body.parsed.parserVersion, SNAP.f1.parser_version);
  assert.equal(body.parsed.contact.email, SNAP.f1.entities.email);
  assert.equal(body.fileName, 'Maya Okafor CV.pdf');
  assert.equal(body.size, F1.length);
  assert.ok(!('raw_text' in body) && !('rawText' in body.parsed), 'full text must not be sent back by upload');

  // One object, under its own upload key (R-38), the exact bytes, written without upsert.
  const [key] = uploadKeys(id, 'pdf');
  const obj = store.get(key);
  const write = supa.requests.filter((q) => q.method === 'POST' && q.path.includes(`/storage/v1/object/resumes/candidates/${id}/`)).at(-1);
  assert.notEqual(write.headers['x-upsert'], 'true', 'an upload must never overwrite an object');
  assert.ok(obj.bytes.equals(F1));
  assert.equal(obj.contentType, 'application/pdf');

  // The parser got the bytes, the request id, and no job description.
  assert.equal(nlpCalls() - nlpBefore, 1);
  const call = nlp.requests.at(-1);
  assert.equal(call.headers['x-request-id'], 'r09-req-0001');
  assert.ok(!call.rawBody.includes(Buffer.from('name="jd"')), 'upload must parse without a jd');

  // One resumes row: file_ref is the upload key, the service's parser version, no job, no full text.
  assert.equal(inserts.length - insertsBefore, 1);
  const row = inserts.at(-1);
  assert.equal(row.candidate_id, id);
  assert.equal(row.job_id, null);
  assert.equal(row.file_ref, key);
  assert.equal(row.parser_version, 'nlp-engine@2.2.0');
  assert.deepEqual(row.skills, SNAP.f1.entities.skills);
  assert.ok(!('raw_text' in row), 'the full text must never be persisted');
  assert.ok(row.raw_text_preview.length <= 300);
  assert.equal(body.parsed.resumeId, `00000000-0000-4000-8000-${String(inserts.length).padStart(12, '0')}`);

  const status = await fetch(`${base}/t/resume/status`, { headers: { 'X-Test-User': id } }).then((r) => r.json());
  assert.equal(status.hasResume, true);
  assert.equal(status.fileName, key.split('/').pop());
});

// ---- R-30 follow-up: links and education objects from nlp-engine 2.1.0 ----

test('R-30 follow-up: every web link is stored in project_links and sent back by upload; GitHub and LinkedIn first, no duplicates', async () => {
  const id = newCandidate();
  const { res, body, text } = await upload(id, { bytes: F7, name: 'cv.pdf' });
  assert.equal(res.status, 201, text);
  const expected = [
    'https://github.com/example-plinkwell',
    'https://www.linkedin.com/in/example-priya-linkwell',
    'https://plinkwell.example.com/portfolio',
  ];
  // The fixture's parse lists the LinkedIn link with a trailing slash; it is the same link.
  assert.deepEqual(SNAP.f7.entities.links, [
    'https://www.linkedin.com/in/example-priya-linkwell/',
    'https://github.com/example-plinkwell',
    'https://plinkwell.example.com/portfolio',
  ]);
  const row = inserts.at(-1);
  assert.deepEqual(row.project_links, expected);
  assert.deepEqual(body.parsed.links, expected);
  // The GitHub account used for evidence is still the parser's github field alone.
  assert.equal(row.contact.github, SNAP.f7.entities.github);
  assert.equal(body.parsed.contact.github, SNAP.f7.entities.github);
  assert.ok(!('links' in row.contact), 'links are not added to the contact object');
});

test('R-30 follow-up: education objects are stored and sent back as the parser gave them', async () => {
  const id = newCandidate();
  const { res, body, text } = await upload(id, { bytes: F7, name: 'cv.pdf' });
  assert.equal(res.status, 201, text);
  assert.equal(SNAP.f7.entities.education.length, 2);
  assert.equal(SNAP.f7.entities.education[0].institution, 'Example Institute of Technology, Pune');
  assert.deepEqual(inserts.at(-1).education, SNAP.f7.entities.education);
  assert.deepEqual(body.parsed.education, SNAP.f7.entities.education);
});

test('R-30 follow-up: a parser before 2.1.0 (no links, education as strings) keeps GitHub and LinkedIn only and the strings as they are', async () => {
  nlpMode = 'replay-2.0';
  const id = newCandidate();
  const { res, body, text } = await upload(id, { bytes: F1, name: 'cv.pdf' });
  assert.equal(res.status, 201, text);
  const row = inserts.at(-1);
  assert.equal(row.parser_version, 'nlp-engine@2.0.0');
  assert.deepEqual(row.project_links, [SNAP.f1.entities.github, SNAP.f1.entities.linkedin]);
  assert.deepEqual(body.parsed.links, [SNAP.f1.entities.github, SNAP.f1.entities.linkedin]);
  assert.deepEqual(row.education, [SNAP.f1.entities.education[0].text]);
  assert.equal(typeof body.parsed.education[0], 'string');
});

test('R-30 follow-up: collectProjectLinks drops blanks and non-strings and treats scheme, www, case and a trailing slash as one link', () => {
  const { collectProjectLinks } = mods.pipeline;
  assert.deepEqual(collectProjectLinks({ github: null, linkedin: null }, undefined), []);
  assert.deepEqual(collectProjectLinks({}, null), []);
  assert.deepEqual(
    collectProjectLinks(
      { github: 'github.com/example-a', linkedin: null },
      ['https://www.GitHub.com/example-a/', '  ', 42, null, { url: 'x.com' }, 'example.dev/me', 'https://example.dev/me/', 'github.com/example-a/repo'],
    ),
    ['github.com/example-a', 'example.dev/me', 'github.com/example-a/repo'],
  );
});

const storageWrites = () => supa.requests.filter((r) => r.method === 'POST' && r.path.startsWith('/storage/v1/object/resumes/')).length;

test('f6 (image-only) -> 422 unreadable_document, plain message, nothing stored, no row', async () => {
  const id = newCandidate();
  const insertsBefore = inserts.length;
  const writesBefore = storageWrites();
  const { res, body, text } = await upload(id, { bytes: F6, name: 'scan.pdf' });
  assertContract(res, body, 422, 'unreadable_document');
  assert.equal(body.reason, 'no_text_layer');
  assert.match(body.message, /can't read this file/i);
  assert.equal(body.stored, false);
  assert.deepEqual(objectsOf(id), [], 'an object was left in the store');
  assert.equal(storageWrites(), writesBefore, 'the unreadable file was written to storage');
  assert.equal(inserts.length, insertsBefore);
  assertNoLeak(text);
});

test('unreadable re-upload over an existing readable resume -> 422; the earlier object and its bytes are untouched', async () => {
  // Same extension: the earlier PDF (f1) must survive an unreadable PDF (f6).
  const id = newCandidate();
  assert.equal((await upload(id, { bytes: F1, name: 'cv.pdf' })).res.status, 201);
  const [pdfKey] = uploadKeys(id, 'pdf');
  const before = store.get(pdfKey);
  const r = await upload(id, { bytes: F6, name: 'scan.pdf' });
  assertContract(r.res, r.body, 422, 'unreadable_document');
  assert.equal(r.body.stored, false);
  assert.deepEqual(objectsOf(id), [pdfKey]);
  const after = store.get(pdfKey);
  assert.ok(after.bytes.equals(F1), 'the earlier resume bytes changed');
  assert.equal(after.updated_at, before.updated_at, 'the earlier resume was rewritten');

  // Other extension: the earlier resume.docx survives an unreadable PDF.
  const id2 = newCandidate();
  assert.equal((await upload(id2, { bytes: F2, name: 'cv.docx', type: 'application/octet-stream' })).res.status, 201);
  const [docxKey] = uploadKeys(id2, 'docx');
  const r2 = await upload(id2, { bytes: F6, name: 'scan.pdf' });
  assert.equal(r2.res.status, 422);
  assert.deepEqual(objectsOf(id2), [docxKey]);
  assert.ok(store.get(docxKey).bytes.equals(F2));
});

test('a .pdf whose bytes are not PDF -> 400; a .docx that is not a ZIP -> 400; nothing stored or parsed', async () => {
  const id = newCandidate();
  const nlpBefore = nlpCalls();
  for (const [bytes, name] of [
    [Buffer.from('Jane Doe\nSkills: Python, SQL\n'), 'resume.pdf'],
    [Buffer.alloc(0), 'empty.pdf'],
    [F1, 'renamed.docx'],
    [Buffer.from('PK\x05\x06 not a docx'), 'x.docx'],
  ]) {
    const { res, body, text } = await upload(id, { bytes, name });
    assertContract(res, body, 400, 'file_content_mismatch');
    assertNoLeak(text);
  }
  const { res, body } = await upload(id, { bytes: Buffer.from('hello'), name: 'resume.txt', type: 'text/plain' });
  assertContract(res, body, 400, 'unsupported_file_type');
  assert.equal(body.message, 'Only PDF or DOCX resumes are supported.');
  assert.equal(nlpCalls(), nlpBefore, 'the parser was called for a rejected file');
  assert.deepEqual(objectsOf(id), []);
});

test('PDF header within the first 1024 bytes is accepted (what PDF readers accept)', async () => {
  const id = newCandidate();
  const padded = Buffer.concat([Buffer.from('\r\n\r\n'), F1]);
  const { res, text } = await upload(id, { bytes: padded, name: 'cv.pdf' });
  // The stub only knows the exact fixture bytes, which `padded` contains, so it replays f1.
  assert.equal(res.status, 201, text);
});

test('NLP down (connection refused) -> 503 fixed message, file kept for a later parse, no row', async () => {
  const id = newCandidate();
  const insertsBefore = inserts.length;
  process.env.NLP_PARSE_URL = await closedPortUrl();
  const { res, body, text } = await upload(id, { bytes: F1, name: 'cv.pdf' });
  assertContract(res, body, 503, 'parser_unavailable');
  assert.equal(body.message, PARSER_DOWN_MESSAGE);
  assert.equal(body.fileKept, true);
  const [key] = uploadKeys(id, 'pdf');
  assert.ok(store.get(key).bytes.equals(F1));
  assert.equal(inserts.length, insertsBefore);
  assertNoLeak(text);
  assert.ok(!/ECONNREFUSED|fetch failed|127\.0\.0\.1/.test(text), text);

  // The kept file is parsed later by the same pipeline once the parser is back.
  process.env.NLP_PARSE_URL = nlpUrl;
  const later = await mods.pipeline.runResumePipeline({ candidateId: id });
  assert.deepEqual(later.resume.skills, SNAP.f1.entities.skills);
  assert.equal(later.storagePath, key);
});

test('NLP timeout and NLP 503 -> the same 503 and fixed message; file kept', async () => {
  process.env.NLP_PARSE_TIMEOUT_MS = '300';
  for (const mode of ['hang', 'unavailable']) {
    nlpMode = mode;
    const id = newCandidate();
    const t0 = Date.now();
    const { res, body, text } = await upload(id, { bytes: F1, name: 'cv.pdf' });
    const elapsed = Date.now() - t0;
    assertContract(res, body, 503, 'parser_unavailable');
    assert.equal(body.message, PARSER_DOWN_MESSAGE);
    uploadKeys(id, 'pdf');
    assertNoLeak(text);
    if (mode === 'hang') assert.ok(elapsed < 3000, `timeout took ${elapsed} ms`);
  }
});

test('NLP down: the upload is stored under a new key and becomes the current resume (the one documented case); the earlier object is not overwritten; storing fails -> 500', async () => {
  const id = newCandidate();
  const legacy = `candidates/${id}/resume.pdf`;
  store.set(legacy, { bytes: F6, contentType: 'application/pdf', updated_at: new Date(++clock).toISOString() });
  process.env.NLP_PARSE_URL = await closedPortUrl();
  let r = await upload(id, { bytes: F1, name: 'cv.pdf' });
  assertContract(r.res, r.body, 503, 'parser_unavailable');
  assert.ok(store.get(legacy).bytes.equals(F6), 'R-38: the earlier object is never overwritten');
  const current = await mods.pipeline.findStoredResume(id);
  assert.match(current.path, uploadKeyRe(id, 'pdf'));
  assert.ok(store.get(current.path).bytes.equals(F1), 'the new upload is the current resume');

  const id2 = newCandidate();
  supaMode = { uploadError: true };
  r = await upload(id2, { bytes: F1, name: 'cv.pdf' });
  assertContract(r.res, r.body, 500, 'storage_error');
  assert.equal(r.body.fileKept, undefined);
  assert.deepEqual(objectsOf(id2), []);
});

test('NLP crash (500 with a traceback) -> 502 parser_failed, nothing echoed, nothing stored, earlier resume untouched', async () => {
  const id = newCandidate();
  assert.equal((await upload(id, { bytes: F2, name: 'cv.docx', type: 'application/octet-stream' })).res.status, 201);
  nlpMode = 'crash';
  const { res, body, text } = await upload(id, { bytes: F1, name: 'cv.pdf' });
  assertContract(res, body, 502, 'parser_failed');
  assert.equal(body.stored, false);
  assertNoLeak(text);
  const [docxKey] = uploadKeys(id, 'docx');
  assert.ok(store.get(docxKey).bytes.equals(F2));
});

test('storage failure after a successful parse -> 500 storage_error and no resumes insert', async () => {
  const id = newCandidate();
  const insertsBefore = inserts.length;
  const nlpBefore = nlpCalls();
  supaMode = { uploadError: true };
  const { res, body, text } = await upload(id, { bytes: F1, name: 'cv.pdf' });
  assertContract(res, body, 500, 'storage_error');
  assert.equal(nlpCalls() - nlpBefore, 1, 'the file was not parsed first');
  assert.equal(inserts.length, insertsBefore, 'a resumes row was inserted without a stored file');
  assert.deepEqual(objectsOf(id), []);
  assertNoLeak(text);
});

test('row insert failure after storing -> 500 database_error, file kept', async () => {
  const id = newCandidate();
  supaMode = { insertError: true };
  const { res, body, text } = await upload(id, { bytes: F1, name: 'cv.pdf' });
  assertContract(res, body, 500, 'database_error');
  assert.equal(body.fileKept, true);
  uploadKeys(id, 'pdf');
  assertNoLeak(text);
});

test('re-upload (another extension, then the same one): each upload gets its own key, the newest is the current resume, earlier files are kept (R-38)', async () => {
  const id = newCandidate();
  assert.equal((await upload(id, { bytes: F1, name: 'a.pdf' })).res.status, 201);
  const [pdfKey] = uploadKeys(id, 'pdf');
  const r = await upload(id, { bytes: F2, name: 'b.DOCX', type: 'application/octet-stream' });
  assert.equal(r.res.status, 201, r.text);
  assert.deepEqual(r.body.parsed.skills, SNAP.f2.entities.skills);
  const docxKey = objectsOf(id).find((k) => k !== pdfKey);
  assert.match(docxKey, uploadKeyRe(id, 'docx'));
  assert.equal(store.get(docxKey).contentType,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.ok(store.get(pdfKey).bytes.equals(F1), 'the earlier file is kept, unchanged');
  assert.equal((await mods.pipeline.findStoredResume(id)).path, docxKey, 'the newest upload is the current resume');

  // Same extension again: a third key, never the earlier PDF's.
  assert.equal((await upload(id, { bytes: F1, name: 'c.pdf' })).res.status, 201);
  const keys = objectsOf(id);
  assert.equal(keys.length, 3);
  const third = keys.find((k) => k !== pdfKey && k !== docxKey);
  assert.match(third, uploadKeyRe(id, 'pdf'));
  assert.equal((await mods.pipeline.findStoredResume(id)).path, third);
});

test('storage errors are errors, not "no resume" (B9): status, recruiter link, upload, pipeline', async () => {
  const id = newCandidate();
  supaMode = { listError: true };
  let r = await fetch(`${base}/t/resume/status`, { headers: { 'X-Test-User': id } });
  let body = await r.json();
  assertContract(r, body, 500, 'storage_error');
  assert.equal(body.hasResume, undefined);
  assertNoLeak(JSON.stringify(body));

  await assert.rejects(mods.pipeline.runResumePipeline({ candidateId: id }),
    (err) => err.code === 'storage_error' && err.status === 500 && !/LEAKY/.test(err.message));

  supaMode = { uploadError: true };
  const up2 = await upload(id, { bytes: F1, name: 'cv.pdf' });
  assertContract(up2.res, up2.body, 500, 'storage_error');
  assert.deepEqual(objectsOf(id), []);
});

test('recruiter resume link (B9): a storage-list error is 500, not 404; no file is 404; a file gets a link', async () => {
  const id = newCandidate();
  const asRecruiter = { 'X-Test-User': RECRUITER_ID, 'X-Test-Role': 'RECRUITER' };
  supaMode = { listError: true };
  let r = await fetch(`${base}/t/resume/candidate/${id}`, { headers: asRecruiter });
  let body = await r.json();
  assertContract(r, body, 500, 'storage_error');
  assertNoLeak(JSON.stringify(body));

  supaMode = {};
  r = await fetch(`${base}/t/resume/candidate/${id}`, { headers: asRecruiter });
  body = await r.json();
  assertContract(r, body, 404, 'not_found');

  store.set(`candidates/${id}/resume.pdf`, { bytes: F1, contentType: 'application/pdf', updated_at: new Date(++clock).toISOString() });
  r = await fetch(`${base}/t/resume/candidate/${id}`, { headers: asRecruiter });
  body = await r.json();
  assert.equal(r.status, 200, JSON.stringify(body));
  // R-38: a pre-R-38 object with no upload row to name it: the neutral label, never the key.
  assert.equal(body.fileName, 'résumé.pdf');
  assert.equal(body.source, 'latest');
  assert.ok(body.note, 'falling back to the newest file is said, not silent');
  assert.equal(signedFor.at(-1), `candidates/${id}/resume.pdf`);
});

test('runResumePipeline with a job: downloads the stored file, sends jd and skill lists, returns the R-10 shape', async () => {
  const id = newCandidate();
  assert.equal((await upload(id, { bytes: F1, name: 'cv.pdf' })).res.status, 201);
  const job = {
    id: '44444444-4444-4444-8444-444444444444',
    description: 'Backend engineer, Python and Django.',
    required_skills: ['python', 'django'],
    preferred_skills: ['docker'],
  };
  const insertsBefore = inserts.length;
  const [key] = uploadKeys(id, 'pdf');
  const out = await mods.pipeline.runResumePipeline({ candidateId: id, job, requestId: 'r09-req-0002' });

  const call = nlp.requests.at(-1);
  assert.equal(call.headers['x-request-id'], 'r09-req-0002');
  assert.ok(call.rawBody.includes(F1), 'the stored bytes were not sent');
  assert.ok(call.rawBody.includes(Buffer.from('name="jd"')));
  assert.ok(call.rawBody.includes(Buffer.from('["python","django"]')));
  assert.ok(call.rawBody.includes(Buffer.from('filename="resume.pdf"')));

  assert.deepEqual(Object.keys(out).sort(),
    ['contact', 'entities', 'parserVersion', 'rawText', 'rawTextTruncated', 'resume', 'semanticAnalysis', 'storagePath']);
  assert.equal(out.rawText, SNAP.f1.raw_text);
  assert.equal(out.rawTextTruncated, false);
  assert.equal(out.parserVersion, 'nlp-engine@2.2.0');
  assert.deepEqual(out.semanticAnalysis, SNAP.f1.semantic_analysis);
  assert.equal(out.contact.email, SNAP.f1.entities.email);
  assert.equal(out.contact.github, SNAP.f1.entities.github);
  assert.deepEqual(out.entities, SNAP.f1.entities);
  assert.equal(out.resume.job_id, job.id);
  assert.equal(out.resume.file_ref, key);
  assert.equal(inserts.length - insertsBefore, 1);
  assert.ok(!('raw_text' in inserts.at(-1)));
});

test('runResumePipeline errors: no stored resume -> no_resume 404; unreadable stored file -> 422 with reason; insert error -> database_error', async () => {
  const { ResumePipelineError, runResumePipeline } = mods.pipeline;
  await assert.rejects(runResumePipeline({ candidateId: newCandidate() }),
    (err) => err instanceof ResumePipelineError && err.code === 'no_resume' && err.status === 404);

  const id = newCandidate();
  store.set(`candidates/${id}/resume.pdf`, { bytes: F6, contentType: 'application/pdf', updated_at: new Date(++clock).toISOString() });
  await assert.rejects(runResumePipeline({ candidateId: id }),
    (err) => err.code === 'unreadable_document' && err.status === 422 && err.reason === 'no_text_layer');
  assert.ok(store.has(`candidates/${id}/resume.pdf`), 'the pipeline itself never deletes a stored file');

  const id2 = newCandidate();
  store.set(`candidates/${id2}/resume.pdf`, { bytes: F1, contentType: 'application/pdf', updated_at: new Date(++clock).toISOString() });
  supaMode = { insertError: true };
  await assert.rejects(runResumePipeline({ candidateId: id2 }),
    (err) => err.code === 'database_error' && err.status === 500 && !/LEAKY/.test(err.message));
});

test('reads the newest resume object, including an older upper-case extension; ignores other path forms', async () => {
  const { findStoredResume } = mods.pipeline;
  const id = newCandidate();
  store.set(`${id}/aaaaaaaa-0000-4000-8000-000000000000.pdf`, { bytes: F1, contentType: 'application/pdf', updated_at: new Date(++clock).toISOString() });
  assert.equal(await findStoredResume(id), null, 'the analyze path form is not the candidate resume');
  store.set(`candidates/${id}/resume.PDF`, { bytes: F1, contentType: 'application/pdf', updated_at: new Date(++clock).toISOString() });
  assert.equal((await findStoredResume(id)).path, `candidates/${id}/resume.PDF`);
  store.set(`candidates/${id}/resume.docx`, { bytes: F2, contentType: 'x', updated_at: new Date(++clock).toISOString() });
  assert.equal((await findStoredResume(id)).path, `candidates/${id}/resume.docx`);
  store.set(`candidates/${id}/notes.pdf`, { bytes: F1, contentType: 'x', updated_at: new Date(++clock).toISOString() });
  assert.equal((await findStoredResume(id)).path, `candidates/${id}/resume.docx`);
  // R-38: an upload key newer than the pre-R-38 file is the current one; a look-alike name is not a resume.
  const key = `candidates/${id}/resume-20261114T101500123Z-0a1b2c3d.pdf`;
  store.set(key, { bytes: F1, contentType: 'application/pdf', updated_at: new Date(++clock).toISOString() });
  assert.equal((await findStoredResume(id)).path, key);
  store.set(`candidates/${id}/resume-copy.pdf`, { bytes: F1, contentType: 'x', updated_at: new Date(++clock).toISOString() });
  assert.equal((await findStoredResume(id)).path, key);
});

test('R-38: newResumePath gives a fresh key in the candidate folder each time; only pdf and docx', () => {
  const { newResumePath } = mods.pipeline;
  const id = newCandidate();
  const at = new Date('2026-11-14T02:30:07.417Z');
  const a = newResumePath(id, '.pdf', at);
  const b = newResumePath(id, '.PDF', at);
  assert.match(a, /^candidates\/[0-9a-f-]+\/resume-20261114T023007417Z-[0-9a-f]{8}\.pdf$/);
  assert.ok(a.startsWith(`candidates/${id}/`));
  assert.notEqual(a, b, 'two uploads in the same millisecond still get different keys');
  assert.match(newResumePath(id, '.docx'), uploadKeyRe(id, 'docx'));
  assert.throws(() => newResumePath(id, '.txt'));
});

test('the NLP call goes through the shared internal HTTP module with a 30 s default timeout', () => {
  const src = readFileSync(join(REPO_DIR, 'backend', 'Services', 'resumePipeline.js'), 'utf8');
  assert.match(src, /from '\.\/internalHttp\.js'/);
  assert.equal(mods.pipeline.NLP_TIMEOUT_MS_DEFAULT, 30000);
  assert.ok(!/from 'node-fetch'/.test(src));
});
