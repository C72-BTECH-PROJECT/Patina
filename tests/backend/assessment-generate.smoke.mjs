// T-0024/T-0025 backend smoke tests: black-box against BACKEND_BASE_URL.
// No Supabase writes. Both tests run without a session and without the
// assessment service: they prove the routes exist and are role-guarded.
//
//   BACKEND_BASE_URL=http://localhost:5100 node --test tests/backend/assessment-generate.smoke.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backendBaseUrl } from './lib/env.mjs';

const BASE = backendBaseUrl();

test('POST /api/assessment/generate without session -> 401 (route exists, guarded)', async () => {
  const r = await fetch(`${BASE}/api/assessment/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId: '00000000-0000-0000-0000-000000000000' }),
  });
  // 401 (not 404) proves the route is registered and behind CANDIDATE auth.
  assert.equal(r.status, 401);
  assert.ok((await r.json()).message, 'expected a JSON error message');
});

test('POST /api/assessment/evaluate without session -> 401 (route exists, guarded)', async () => {
  const r = await fetch(`${BASE}/api/assessment/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assessmentId: '00000000-0000-0000-0000-000000000000', answers: [] }),
  });
  assert.equal(r.status, 401);
  assert.ok((await r.json()).message, 'expected a JSON error message');
});

// R-11: the background-preparation routes exist and are guarded too.
test('GET /api/assessment/status and POST /api/assessment/start without session -> 401', async () => {
  const s = await fetch(`${BASE}/api/assessment/status?jobId=00000000-0000-0000-0000-000000000000`);
  assert.equal(s.status, 401);
  const r = await fetch(`${BASE}/api/assessment/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId: '00000000-0000-0000-0000-000000000000' }),
  });
  assert.equal(r.status, 401);
  assert.ok((await r.json()).message, 'expected a JSON error message');
});

// R-12: save, reset and the recruiter attempt read exist and are guarded too.
test('PUT /:id/answers, POST /:id/reset and GET /attempts without session -> 401', async () => {
  const id = '00000000-0000-0000-0000-000000000000';
  const cases = [
    ['PUT', `/api/assessment/${id}/answers`, { answers: [] }],
    ['POST', `/api/assessment/${id}/reset`, { reason: 'x' }],
    ['GET', `/api/assessment/attempts?jobId=${id}&candidateId=${id}`, undefined],
  ];
  for (const [method, path, body] of cases) {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.equal(r.status, 401, `${method} ${path}`);
  }
});
