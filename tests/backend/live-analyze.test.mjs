// Tier 2 (live): candidate logs in, POST /api/analyze forwards to NLP, the
// response has the expected shape, and teardown leaves nothing behind.
//
// Writes to the shared Supabase project, so it is scoped to two dedicated
// accounts (t0001_cand / t0001_recr, from tests/.env) and a job tagged
// "[T-0001 TEST]". See lib/testdb.mjs for the exact deletes.
//
//   BACKEND_BASE_URL=http://localhost:5100 node --test tests/backend/live-analyze.test.mjs
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TESTS_DIR, backendBaseUrl } from './lib/env.mjs';
import { client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, sweep } from './lib/testdb.mjs';

const BASE = backendBaseUrl();
const cfg = liveConfig();
const skip = cfg.missing.length ? `tests/.env missing ${cfg.missing.join(', ')}` : false;

let sb;
let ids;
let jobId;
let cookie;

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
  jobId = await insertTestJob(sb, ids.R);

  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: cfg.candidateUsername, password: cfg.candidatePassword }),
  });
  assert.equal(r.status, 200, `candidate login failed: HTTP ${r.status} ${await r.text()}`);
  cookie = (r.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('patina_session='));
  assert.ok(cookie, 'login did not set patina_session');
});

after(async () => {
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  console.log('remaining after teardown:', remaining);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

test('POST /api/analyze forwards to NLP and returns the scored candidate', { skip }, async () => {
  const pdf = readFileSync(join(TESTS_DIR, 'fixtures', 'f1_dev_github.pdf'));
  const form = new FormData();
  form.append('jobId', jobId);
  form.append('resume', new Blob([pdf], { type: 'application/pdf' }), 'f1_dev_github.pdf');

  const r = await fetch(`${BASE}/api/analyze`, { method: 'POST', body: form, headers: { Cookie: cookie } });
  const text = await r.text();
  assert.equal(r.status, 200, `HTTP ${r.status}: ${text.slice(0, 300)}`);
  const body = JSON.parse(text);
  for (const key of ['id', 'resumeId', 'candidateId', 'jobId', 'credibilityScore', 'subScores', 'weights', 'explanation', 'extractedSkills']) {
    assert.ok(key in body, `response missing "${key}"`);
  }
  assert.equal(body.candidateId, ids.C);
  assert.equal(body.jobId, jobId);
  assert.ok(Array.isArray(body.extractedSkills) && body.extractedSkills.length > 0,
    'expected skills extracted from f1 (proves the NLP service was called)');
});
