// Tier 1 backend smoke tests: black-box against BACKEND_BASE_URL.
// No Supabase writes. The only Supabase traffic is one profiles read (login
// with a username that does not exist).
//
//   BACKEND_BASE_URL=http://localhost:5100 node --test tests/backend/smoke.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backendBaseUrl } from './lib/env.mjs';

const BASE = backendBaseUrl();

const postJson = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('GET /api/health -> 200 {status:"ok"}', async () => {
  const r = await fetch(`${BASE}/api/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'ok');
});

test('R-03: health reports the database check; no x-powered-by', async () => {
  const r = await fetch(`${BASE}/api/health`);
  const body = await r.json();
  assert.equal(body.checks?.database, 'ok');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('R-03: malformed JSON body -> 400 JSON { error, message, requestId }, no stack', async () => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'r03-smoke-1' }, body: '{"username": ',
  });
  assert.equal(r.status, 400);
  assert.match(r.headers.get('content-type') || '', /application\/json/);
  const text = await r.text();
  const body = JSON.parse(text);
  assert.equal(body.error, 'invalid_json');
  assert.ok(body.message);
  assert.equal(body.requestId, 'r03-smoke-1');
  assert.ok(!/"stack"|\n\s+at |SyntaxError/.test(text), text);
});

test('R-03: errors carry a code and the request id', async () => {
  const r = await fetch(`${BASE}/api/t0001-no-such-route`, { headers: { 'X-Request-ID': 'r03-smoke-2' } });
  const body = await r.json();
  assert.equal(body.error, 'not_found');
  assert.equal(body.requestId, 'r03-smoke-2');
  const r2 = await fetch(`${BASE}/api/jobs`);
  const b2 = await r2.json();
  assert.equal(r2.status, 401);
  assert.equal(b2.error, 'unauthorized');
  assert.equal(b2.requestId, r2.headers.get('x-request-id'));
});

test('unknown route -> 404', async () => {
  const r = await fetch(`${BASE}/api/t0001-no-such-route`);
  assert.equal(r.status, 404);
});

test('I-0027: unknown route with POST -> 404 naming the real method', async () => {
  const r = await postJson('/api/t0001-no-such-route', {});
  assert.equal(r.status, 404);
  assert.equal((await r.json()).message, 'Cannot POST /api/t0001-no-such-route');
});

test('POST /api/auth/login with empty body -> 400', async () => {
  const r = await postJson('/api/auth/login', {});
  assert.equal(r.status, 400);
  assert.ok((await r.json()).message, 'expected an error message');
});

test('POST /api/auth/signup with empty body -> 400', async () => {
  const r = await postJson('/api/auth/signup', {});
  assert.equal(r.status, 400);
  assert.ok((await r.json()).message, 'expected an error message');
});

test('I-0016: a one-word name passes the required-fields check (reaches the password rule, creates no user)', async () => {
  const r = await postJson('/api/auth/signup', {
    name: 'Madonna', username: 't0001_oneword', email: 't0001_oneword@example.com', password: '12345',
  });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).message, 'Password must be at least 8 characters.');
});

test('POST /api/auth/login with unknown username -> 401, no session cookie', async () => {
  const r = await postJson('/api/auth/login', { username: 't0001_nonexistent', password: 'not-a-real-password-1' });
  assert.equal(r.status, 401);
  const cookies = r.headers.getSetCookie?.() ?? [];
  assert.ok(!cookies.some((c) => c.startsWith('patina_session=') && !/expires=Thu, 01 Jan 1970/i.test(c)),
    'must not issue a session for a failed login');
});

// R-10 (Y1): POST /api/analyze is removed. The baseline worktree still has it
// (401 without a session); the current tree answers 404. tests/run-suite.ps1 sets
// HARNESS_TARGET; run by hand, the current tree is assumed.
const BASELINE = process.env.HARNESS_TARGET === 'baseline';

test(`POST /api/analyze without session -> ${BASELINE ? '401 (baseline)' : '404 (removed in R-10)'}`, async () => {
  const form = new FormData();
  form.append('jobId', '00000000-0000-0000-0000-000000000000');
  form.append('resume', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'x.pdf');
  const r = await fetch(`${BASE}/api/analyze`, { method: 'POST', body: form });
  assert.equal(r.status, BASELINE ? 401 : 404);
});

test('POST /api/applications/:id/score without session -> 401 (R-10)', { skip: BASELINE && 'route added in R-10' }, async () => {
  const r = await fetch(`${BASE}/api/applications/00000000-0000-4000-8000-000000000000/score`, { method: 'POST' });
  assert.equal(r.status, 401);
});

test('GET /api/jobs without session -> 401', async () => {
  const r = await fetch(`${BASE}/api/jobs`);
  assert.equal(r.status, 401);
});
