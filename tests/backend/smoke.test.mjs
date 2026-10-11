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

test('unknown route -> 404', async () => {
  const r = await fetch(`${BASE}/api/t0001-no-such-route`);
  assert.equal(r.status, 404);
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

test('POST /api/auth/login with unknown username -> 401, no session cookie', async () => {
  const r = await postJson('/api/auth/login', { username: 't0001_nonexistent', password: 'not-a-real-password-1' });
  assert.equal(r.status, 401);
  const cookies = r.headers.getSetCookie?.() ?? [];
  assert.ok(!cookies.some((c) => c.startsWith('patina_session=') && !/expires=Thu, 01 Jan 1970/i.test(c)),
    'must not issue a session for a failed login');
});

test('POST /api/analyze without session -> 401', async () => {
  const form = new FormData();
  form.append('jobId', '00000000-0000-0000-0000-000000000000');
  form.append('resume', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'x.pdf');
  const r = await fetch(`${BASE}/api/analyze`, { method: 'POST', body: form });
  assert.equal(r.status, 401);
});

test('GET /api/jobs without session -> 401', async () => {
  const r = await fetch(`${BASE}/api/jobs`);
  assert.equal(r.status, 401);
});
