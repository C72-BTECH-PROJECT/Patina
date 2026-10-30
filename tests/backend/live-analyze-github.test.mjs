// T-0014 criterion 10 (live): POST /api/analyze calls github-evidence and folds
// its sub-score into the stored score. Real NLP and Supabase; github-evidence is
// a stub on :8001 (the core default GITHUB_EVIDENCE_URL) that replays the
// synthetic fixture response, so GitHub is never called.
//
// Writes to the shared Supabase project, scoped to the t0001_ accounts and a
// "[T-0001 TEST]" job (lib/testdb.mjs), swept before and after. Needs :8001
// free: stop a real github-evidence service first.
//
//   BACKEND_BASE_URL=http://localhost:5000 node --test tests/backend/live-analyze-github.test.mjs
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TESTS_DIR, backendBaseUrl } from './lib/env.mjs';
import { client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, sweep } from './lib/testdb.mjs';
import { json, startStub } from './lib/stub-server.mjs';

const BASE = backendBaseUrl();
const STUB_PORT = 8001;
const cfg = liveConfig();
const skip = cfg.missing.length ? `tests/.env missing ${cfg.missing.join(', ')}` : false;

const FIXTURE = JSON.parse(readFileSync(join(TESTS_DIR, 'backend', 'fixtures', 'github-evidence-example-mokafor.json'), 'utf8'));
const P = 'parsing_semantic_alignment';
const G = 'github_evidence';

let sb;
let ids;
let jobId;
let cookie;
let stub;

before(async () => {
  if (skip) return;
  try {
    stub = await startStub({ port: STUB_PORT, handler: (req, res) => json(res, 200, FIXTURE) });
  } catch (err) {
    assert.fail(`cannot bind the github-evidence stub on :${STUB_PORT} (${err.code}); stop whatever listens there`);
  }
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
  if (stub) await stub.close();
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  console.log('remaining after teardown:', remaining);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

async function analyze(fixture, type, headers = {}) {
  const form = new FormData();
  form.append('jobId', jobId);
  form.append('resume', new Blob([readFileSync(join(TESTS_DIR, 'fixtures', fixture))], { type }), fixture);
  const r = await fetch(`${BASE}/api/analyze`, { method: 'POST', body: form, headers: { Cookie: cookie, ...headers } });
  const text = await r.text();
  assert.equal(r.status, 200, `${fixture}: HTTP ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

test('analyze folds the GitHub sub-score in, and it degrades to "unavailable" with a reason', { skip }, async (t) => {
  const requestId = `t0014-${randomBytes(6).toString('hex')}`;
  let analyzed;

  await t.test('f1 (GitHub link) gets an available GitHub sub-score', async () => {
    analyzed = await analyze('f1_dev_github.pdf', 'application/pdf', { 'X-Request-ID': requestId });
    const gh = analyzed.subScores[G];
    assert.equal(gh.available, true, `github sub-score: ${JSON.stringify(gh).slice(0, 300)}`);
    assert.equal(gh.value, Math.round(FIXTURE.sub_score.value * 100 * 100) / 100);
    assert.equal(gh.components.request_id, requestId);
    assert.ok(analyzed.weights[G] > 0 && analyzed.weights[P] < 1, `weights: ${JSON.stringify(analyzed.weights)}`);

    assert.equal(stub.requests.length, 1, 'one call to github-evidence');
    const [rec] = stub.requests;
    assert.equal(rec.path, '/v1/evidence');
    assert.equal(rec.body.username, 'example-mokafor');
    assert.equal(rec.body.window_days, 365);
    assert.ok(Array.isArray(rec.body.claimed_skills) && rec.body.claimed_skills.includes('python'));
    assert.equal(rec.headers['x-request-id'], requestId);
  });

  await t.test('the stored score, read back, has the same sub-score', async () => {
    const r = await fetch(`${BASE}/api/candidate-analysis`, { headers: { Cookie: cookie } });
    assert.equal(r.status, 200);
    const stored = await r.json();
    assert.equal(stored.id, analyzed.id);
    assert.deepEqual(stored.subScores[G], analyzed.subScores[G]);
  });

  await t.test('f3 (no link) is unavailable with no_github_link and makes no call', async () => {
    const before = stub.requests.length;
    const body = await analyze('f3_support_nogithub.pdf', 'application/pdf');
    assert.equal(body.subScores[G].available, false);
    assert.equal(body.subScores[G].value, null);
    assert.equal(body.subScores[G].components.reason_code, 'no_github_link');
    assert.equal(body.weights[P], 1);
    assert.equal(stub.requests.length, before, 'zero stub requests');
  });

  await t.test('service down: f1 still scores, GitHub is service_unavailable', async () => {
    await stub.close();
    stub = null;
    const body = await analyze('f1_dev_github.pdf', 'application/pdf');
    assert.equal(body.subScores[G].available, false);
    assert.equal(body.subScores[G].components.reason_code, 'service_unavailable');
    assert.equal(body.weights[P], 1);
  });
});
