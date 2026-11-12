// R-03 (offline): core's JSON error contract, the Supabase timeout and the health
// check (REBUILD/DECISIONS.md §9).
//
// Nothing leaves loopback. Core's Supabase client is pointed at a local PostgREST
// stub through BACKEND_ENV_FILE (backend/Config/supabase.js), so the real project
// is never contacted; the test asserts that before anything runs. Only modules
// that never load backend/.env themselves are imported (no supabaseAuth.js).
//
//   node --test tests/backend/error-contract.test.mjs
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';
import { startStub, json, raw, hang } from './lib/stub-server.mjs';

const backendUrl = (...parts) =>
  new URL(`file:///${join(REPO_DIR, 'backend', ...parts).replace(/\\/g, '/')}`);
const express = createRequire(join(REPO_DIR, 'backend', 'package.json'))('express');

// Text that must never reach a client.
const LEAK = 'LEAKY-STUB-MESSAGE relation "secret_table" on db.example-project.supabase.co';
const LEAK_DETAILS = 'LEAKY-STUB-DETAILS';
const LEAK_HINT = 'LEAKY-STUB-HINT';
const NLP_LEAK = 'LEAKY-NLP-TRACEBACK File "/srv/app/main.py", line 99';
const SUPABASE_TIMEOUT_MS = 400;
const CANDIDATE_ID = '11111111-1111-4111-8111-111111111111';
const RECRUITER_ID = '22222222-2222-4222-8222-222222222222';

let mode = 'error'; // what the Supabase stub does: 'error' | 'hang' | 'ok' | 'unavailable'
let supa;
let nlp;
let envDir;
let mods;
let server;
let base;

const fakeServiceKey = () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'service_role' })}.sig`;
};

const supabaseHandler = (req, res) => {
  if (mode === 'hang') return hang();
  // PostgREST "schema cache not loaded" / Cloudflare 520: postgrest-js would retry these.
  if (mode === 'unavailable') return json(res, 503, { message: LEAK }, { 'Retry-After': '5' });
  if (mode === 'ok') {
    if (req.method === 'HEAD') { res.writeHead(200); return res.end(); }
    if (req.url.startsWith('/rest/v1/jobs')) {
      const job = { id: 'job-1', title: 'T', description: 'd', required_skills: [], preferred_skills: [], location: 'x' };
      return /vnd\.pgrst\.object/.test(req.headers.accept || '') ? json(res, 200, job) : json(res, 200, [job]);
    }
    return json(res, 200, []);
  }
  // mode === 'error': a PostgREST / Storage error carrying text that must stay server-side.
  if (req.method === 'HEAD') { res.writeHead(500); return res.end(); }
  return json(res, 400, { code: '42P01', message: LEAK, details: LEAK_DETAILS, hint: LEAK_HINT, error: LEAK, statusCode: '400' });
};

const assertNoLeak = (text) => {
  for (const s of [LEAK, 'LEAKY-STUB', LEAK_DETAILS, LEAK_HINT, NLP_LEAK, 'secret_table', 'example-project', '42P01']) {
    assert.ok(!text.includes(s), `response leaked ${JSON.stringify(s)}: ${text}`);
  }
  assert.ok(!/"stack"/.test(text), `response has a stack: ${text}`);
  assert.ok(!/\bat [\w.<>]+ \(/.test(text) && !/\n\s+at /.test(text), `response has a stack frame: ${text}`);
};

const assertContract = (body, res, { status, error } = {}) => {
  if (status) assert.equal(res.status, status);
  assert.match(res.headers.get('content-type') || '', /application\/json/);
  assert.equal(typeof body.error, 'string');
  assert.match(body.error, /^[a-z][a-z0-9_]*$/);
  if (error) assert.equal(body.error, error);
  assert.equal(typeof body.message, 'string');
  assert.ok(body.message.length > 0);
  assert.equal(body.requestId, res.headers.get('x-request-id'));
};

before(async () => {
  supa = await startStub({ handler: supabaseHandler });
  nlp = await startStub({ handler: (req, res) => raw(res, 500, `Internal Server Error\n${NLP_LEAK}`, 'text/plain') });

  envDir = mkdtempSync(join(tmpdir(), 'patina-r03-'));
  const envFile = join(envDir, 'backend.env');
  writeFileSync(envFile, [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${fakeServiceKey()}`,
    'SUPABASE_ANON_KEY=stub-anon-key',
    'SESSION_SECRET=r03-offline-test-secret-r03-offline',
    `SUPABASE_TIMEOUT_MS=${SUPABASE_TIMEOUT_MS}`,
    `NLP_PARSE_URL=${nlp.url}/parse`,
  ].join('\n'));
  process.env.BACKEND_ENV_FILE = envFile;
  process.env.NLP_PARSE_URL = `${nlp.url}/parse`;

  mods = {
    errors: await import(backendUrl('Middlewares', 'errorHandler.js')),
    requestId: await import(backendUrl('Middlewares', 'requestId.js')),
    supabase: await import(backendUrl('Config', 'supabase.js')),
    jobs: await import(backendUrl('Controllers', 'jobs.controller.js')),
    analysis: await import(backendUrl('Controllers', 'analysis.controller.js')),
  };
  // Guard: the client must be talking to the stub, never the real project.
  assert.equal(process.env.SUPABASE_URL, supa.url, 'Supabase client is not pointed at the local stub');

  const { errorContract, notFoundHandler, errorHandler, createHealthHandler } = mods.errors;
  const app = express();
  app.disable('x-powered-by');
  app.use(mods.requestId.requestIdMiddleware);
  app.use(errorContract);
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.get('X-Test-Role') || 'CANDIDATE';
    req.session = { userId: role === 'RECRUITER' ? RECRUITER_ID : CANDIDATE_ID, role };
    next();
  });
  app.post('/t/echo', (req, res) => res.json({ got: req.body }));
  app.get('/t/throw', () => { throw new Error(`thrown ${LEAK}`); });
  app.get('/t/reject', async () => { throw new Error(`rejected ${LEAK}`); });
  app.get('/t/raw-error-field', (req, res) => res.status(500).json({ message: 'Fixed sentence.', error: `free text ${LEAK}` }));
  app.get('/t/my-applications', mods.jobs.getMyApplications);
  app.post('/t/jobs', mods.jobs.createJob);
  app.get('/t/candidate-analysis', mods.analysis.getCandidateAnalysis);
  app.get('/t/candidates', mods.analysis.getAllCandidates);
  app.get('/t/applicants', mods.analysis.getAllApplicants);
  app.get('/t/resume/:candidateId', mods.analysis.getCandidateResume);
  app.post('/t/analyze', ...mods.analysis.analyzeResume);
  app.get('/t/health', createHealthHandler({ probe: mods.supabase.probeDatabase, timeoutMs: 2000 }));
  app.use(notFoundHandler);
  app.use(errorHandler);
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

const call = async (path, init = {}) => {
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { res, text, body };
};

test('malformed JSON body -> 400 JSON invalid_json, no stack', async () => {
  const { res, text, body } = await call('/t/echo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"broken": ',
  });
  assert.ok(body, `not JSON: ${text}`);
  assertContract(body, res, { status: 400, error: 'invalid_json' });
  assertNoLeak(text);
  assert.ok(!/SyntaxError|Unexpected|JSON\.parse/.test(text), text);
});

test('a handler that throws -> 500 JSON internal_error with a request id', async () => {
  for (const path of ['/t/throw', '/t/reject']) {
    const { res, text, body } = await call(path);
    assert.ok(body, `not JSON: ${text}`);
    assertContract(body, res, { status: 500, error: 'internal_error' });
    assert.ok(body.requestId);
    assertNoLeak(text);
  }
});

test('core uses the request id the gateway forwards', async () => {
  const { res, body } = await call('/t/throw', { headers: { 'X-Request-ID': 'gw-req-12345' } });
  assert.equal(res.headers.get('x-request-id'), 'gw-req-12345');
  assert.equal(body.requestId, 'gw-req-12345');
});

test('unknown route -> JSON 404 not_found', async () => {
  const { res, body } = await call('/t/no-such-route', { method: 'POST' });
  assertContract(body, res, { status: 404, error: 'not_found' });
  assert.equal(body.message, 'Cannot POST /t/no-such-route');
});

test('a free-text "error" field never reaches the client', async () => {
  const { res, text, body } = await call('/t/raw-error-field');
  assertContract(body, res, { status: 500, error: 'internal_error' });
  assert.equal(body.message, 'Fixed sentence.');
  assertNoLeak(text);
});

test('stubbed Supabase errors: no Supabase text in any response body', async () => {
  mode = 'error';
  const before = supa.requests.length;
  const cases = [
    ['/t/my-applications', {}, 500],
    ['/t/candidate-analysis', {}, 500],
    ['/t/candidates', { headers: { 'X-Test-Role': 'RECRUITER' } }, 500],
    ['/t/applicants', { headers: { 'X-Test-Role': 'RECRUITER' } }, 500],
    ['/t/resume/33333333-3333-4333-8333-333333333333', { headers: { 'X-Test-Role': 'RECRUITER' } }, 500],
    ['/t/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Test-Role': 'RECRUITER' },
      body: JSON.stringify({ title: 'T', skills: ['a'], description: 'd', experienceLevel: 'mid', location: 'x' }),
    }, 400],
  ];
  for (const [path, init, status] of cases) {
    const { res, text, body } = await call(path, init);
    assert.ok(body, `${path}: not JSON: ${text}`);
    assertContract(body, res, { status });
    assertNoLeak(text);
    assert.equal(body.code, undefined, `${path}: database code exposed`);
  }
  assert.ok(supa.requests.length > before, 'the stub was never called');
});

test('O1: an NLP error body is never echoed by analyze', async () => {
  mode = 'ok';
  const form = new FormData();
  form.append('jobId', 'job-1');
  form.append('resume', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'x.pdf');
  const { res, text, body } = await call('/t/analyze', { method: 'POST', body: form });
  assert.ok(body, `not JSON: ${text}`);
  assertContract(body, res, { status: 502, error: 'parser_failed' });
  assertNoLeak(text);
  assert.ok(nlp.requests.length >= 1, 'the NLP stub was never called');
});

test('Supabase timeout -> 503 database_timeout, fixed message', async () => {
  mode = 'hang';
  const t0 = Date.now();
  const { res, text, body } = await call('/t/my-applications');
  const elapsed = Date.now() - t0;
  assertContract(body, res, { status: 503, error: 'database_timeout' });
  assertNoLeak(text);
  assert.ok(!text.includes(supa.url) && !text.includes(String(supa.port)), `URL leaked: ${text}`);
  assert.ok(elapsed >= SUPABASE_TIMEOUT_MS - 50 && elapsed < SUPABASE_TIMEOUT_MS + 3000, `took ${elapsed} ms`);
});

test('R-04 A: Supabase answering 503 is not retried; one bounded attempt -> 503 database_timeout', async () => {
  mode = 'unavailable';
  try {
    for (const [path, init] of [
      ['/t/my-applications', {}],
      ['/t/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Test-Role': 'RECRUITER' },
        body: JSON.stringify({ title: 'T', skills: ['a'], description: 'd', experienceLevel: 'mid', location: 'x' }),
      }],
    ]) {
      const before = supa.requests.length;
      const t0 = Date.now();
      const { res, text, body } = await call(path, init);
      const elapsed = Date.now() - t0;
      assertContract(body, res, { status: 503, error: 'database_timeout' });
      assertNoLeak(text);
      assert.equal(supa.requests.length - before, 1, `${path}: the Supabase call was retried`);
      assert.ok(elapsed < SUPABASE_TIMEOUT_MS + 600, `${path}: took ${elapsed} ms`);
    }
  } finally {
    mode = 'error';
  }
});

test('health: ok when the database answers, degraded when it errors or exceeds 2 s', async () => {
  mode = 'ok';
  let r = await call('/t/health');
  assert.equal(r.res.status, 200);
  assert.equal(r.body.status, 'ok');
  assert.equal(r.body.checks.database, 'ok');

  mode = 'error';
  r = await call('/t/health');
  assert.equal(r.res.status, 200);
  assert.equal(r.body.status, 'degraded');
  assert.equal(r.body.checks.database, 'unavailable');

  // A probe slower than 2 s (one that ignores its abort signal) -> degraded at ~2 s.
  const { createHealthHandler } = mods.errors;
  const slowApp = express();
  slowApp.use(mods.requestId.requestIdMiddleware);
  slowApp.use(mods.errors.errorContract);
  slowApp.get('/h', createHealthHandler({ probe: () => new Promise((resolve) => setTimeout(() => resolve(true), 2600)) }));
  const slow = await new Promise((resolve) => { const s = slowApp.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const t0 = Date.now();
    const res = await fetch(`http://127.0.0.1:${slow.address().port}/h`);
    const elapsed = Date.now() - t0;
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, 'degraded');
    assert.ok(elapsed >= 1900 && elapsed < 2500, `took ${elapsed} ms`);
  } finally {
    slow.closeAllConnections?.();
    await new Promise((resolve) => slow.close(resolve));
  }

  // The stubbed database hanging: the real probe gives up (here at the client's
  // SUPABASE_TIMEOUT_MS; in production the 2 s health limit comes first).
  mode = 'hang';
  const t0 = Date.now();
  r = await call('/t/health');
  const elapsed = Date.now() - t0;
  assert.equal(r.res.status, 200);
  assert.equal(r.body.status, 'degraded');
  assert.ok(elapsed < 2500, `took ${elapsed} ms`);
  for (const text of [r.text]) {
    assert.ok(!text.includes(supa.url) && !text.includes(String(supa.port)), `URL leaked: ${text}`);
    assertNoLeak(text);
  }
  mode = 'error';
});

test('index.js mounts the contract in order and hides x-powered-by', () => {
  const src = readFileSync(join(REPO_DIR, 'backend', 'index.js'), 'utf8');
  assert.match(src, /app\.disable\('x-powered-by'\)/);
  const order = ['app.use(requestIdMiddleware)', 'app.use(errorContract)', 'app.use(express.json())',
    "app.get('/api/health', createHealthHandler(", 'app.use(notFoundHandler)', 'app.use(errorHandler)'];
  let last = -1;
  for (const s of order) {
    const at = src.indexOf(s);
    assert.ok(at > last, `${s} missing or out of order`);
    last = at;
  }
  assert.ok(!/console\.log\([^)]*SUPABASE_URL/.test(src));
});

test('no controller response echoes an error message or the Supabase host', () => {
  const dir = join(REPO_DIR, 'backend', 'Controllers');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    // Every .json( ... ) argument up to its closing ");" on the same statement.
    for (const m of src.matchAll(/\.json\(([\s\S]*?)\);/g)) {
      const arg = m[1];
      assert.ok(!/\b\w*(?:error|err|Error|e)\??\.message\b/.test(arg) || /resolved\.failure\.message/.test(arg),
        `${f}: a response echoes an error message: .json(${arg.slice(0, 120)})`);
      assert.ok(!/String\(\s*err/.test(arg), `${f}: a response echoes an exception: .json(${arg.slice(0, 120)})`);
    }
    assert.ok(!/console\.\w+\([^;]*SUPABASE_URL/.test(src), `${f}: logs the Supabase URL`);
    assert.ok(!/console\.\w+\([^;]*username/i.test(src), `${f}: logs a username`);
  }
  const cfg = readFileSync(join(REPO_DIR, 'backend', 'Config', 'supabase.js'), 'utf8');
  assert.ok(!/console\.\w+\([^;]*supabaseUrl/.test(cfg), 'Config/supabase.js logs the project URL');
});
