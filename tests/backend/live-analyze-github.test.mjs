// T-0014 criterion 10 (live), moved to score-on-apply by R-10 (POST /api/analyze is
// removed, Y1): apply and score-again call github-evidence and fold its sub-score
// into a new stored score. Real NLP and Supabase; github-evidence is a stub on
// :8001 (the core default GITHUB_EVIDENCE_URL) that replays the synthetic fixture
// response, so GitHub is never called. (The file keeps its old name so the harness
// lists stay stable.)
//
// Writes to the shared Supabase project, scoped to the t0001_ accounts and a
// "[T-0001 TEST]" job (lib/testdb.mjs), swept before and after. Needs :8001
// free: stop a real github-evidence service first.
//
//   BACKEND_BASE_URL=http://127.0.0.1:5001 node --test tests/backend/live-analyze-github.test.mjs
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TESTS_DIR, backendBaseUrl } from './lib/env.mjs';
import { api, login } from './lib/session.mjs';
import { client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, sweep } from './lib/testdb.mjs';
import { json, startStub } from './lib/stub-server.mjs';

const BASE = backendBaseUrl();
const STUB_PORT = 8001;
const cfg = liveConfig();
const skip = cfg.missing.length ? `tests/.env missing ${cfg.missing.join(', ')}` : false;

const FIXTURE = JSON.parse(readFileSync(join(TESTS_DIR, 'backend', 'fixtures', 'github-evidence-example-mokafor.json'), 'utf8'));
const off = (reason) => ({ value: null, weight: 0, available: false, reason });
// R-06's answer for repositories with no commits in the window.
const INACTIVE = {
  ...FIXTURE,
  commit_activity: { available: true, window_days: 365, authored_commits: 0, active_weeks: 0, weeks: 52, weekly: Array(52).fill(0) },
  repositories: { ...FIXTURE.repositories, with_authored_commits: 0 },
  sub_score: {
    available: false, value: null, reason_code: 'no_recent_public_activity', weights_source: 'default', partial: false,
    components: ['activity', 'consistency', 'ownership', 'corroboration'].map((key) => ({ key, ...off('no_recent_public_activity') })),
  },
};
const P = 'parsing_semantic_alignment';
const G = 'github_evidence';

let sb;
let ids;
let jobId;
let cookie;
let stub;
let stubBody = FIXTURE;
let applicationId;

before(async () => {
  if (skip) return;
  try {
    stub = await startStub({ port: STUB_PORT, handler: (req, res) => json(res, 200, stubBody) });
  } catch (err) {
    assert.fail(`cannot bind the github-evidence stub on :${STUB_PORT} (${err.code}); stop whatever listens there`);
  }
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
  jobId = await insertTestJob(sb, ids.R);
  cookie = await login(cfg.candidateUsername, cfg.candidatePassword);
});

after(async () => {
  if (stub) await stub.close();
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  console.log('remaining after teardown:', remaining);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

async function upload(fixture) {
  const form = new FormData();
  form.append('resume', new Blob([readFileSync(join(TESTS_DIR, 'fixtures', fixture))], { type: 'application/pdf' }), fixture);
  const r = await fetch(`${BASE}/api/resume/upload`, { method: 'POST', body: form, headers: { Cookie: cookie } });
  assert.equal(r.status, 201, `${fixture}: upload HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

// The newest stored score for this candidate and job.
async function newestScore() {
  const { data, error } = await sb.from('scores').select('*').eq('candidate_id', ids.C).eq('job_id', jobId)
    .order('created_at', { ascending: false }).limit(1).single();
  assert.ifError(error);
  return data;
}

async function scoreAgain() {
  const r = await api(cookie, 'POST', `/api/applications/${applicationId}/score`);
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.deepEqual(r.body.scoring, { status: 'scored', reason: null });
  return newestScore();
}

test('apply folds the GitHub sub-score in, and it degrades to "unavailable" with a reason', { skip }, async (t) => {
  const requestId = `t0014-${randomBytes(6).toString('hex')}`;
  let scored;

  await t.test('f1 (GitHub link): apply gets an available GitHub sub-score', async () => {
    await upload('f1_dev_github.pdf');
    const before = stub.requests.length;
    const r = await fetch(`${BASE}/api/jobs/${jobId}/apply`, { method: 'POST', headers: { Cookie: cookie, 'X-Request-ID': requestId } });
    const body = await r.json();
    assert.equal(r.status, 201, JSON.stringify(body).slice(0, 300));
    assert.deepEqual(body.scoring, { status: 'scored', reason: null });
    applicationId = body.id;

    scored = await newestScore();
    const gh = scored.subscores[G];
    assert.equal(gh.available, true, `github sub-score: ${JSON.stringify(gh).slice(0, 300)}`);
    assert.equal(gh.value, Math.round(FIXTURE.sub_score.value * 100 * 100) / 100);
    assert.equal(gh.components.request_id, requestId);
    assert.equal(gh.components.ownership_verified, false);
    assert.ok(scored.weights[G] > 0 && scored.weights[P] < 1, `weights: ${JSON.stringify(scored.weights)}`);

    assert.equal(stub.requests.length - before, 1, 'one call to github-evidence');
    const rec = stub.requests.at(-1);
    assert.equal(rec.path, '/v1/evidence');
    assert.equal(rec.body.username, 'example-mokafor');
    assert.equal(rec.body.window_days, 365);
    assert.ok(Array.isArray(rec.body.claimed_skills) && rec.body.claimed_skills.includes('python'));
    assert.equal(rec.headers['x-request-id'], requestId);
  });

  await t.test('the stored score, read back, has the same sub-score', async () => {
    const r = await api(cookie, 'GET', '/api/candidate-analysis');
    assert.equal(r.status, 200);
    assert.equal(r.body.id, scored.id);
    assert.deepEqual(r.body.subScores[G], scored.subscores[G]);
  });

  await t.test('inactive account (R-06): unavailable with no_recent_public_activity, weight 0', async () => {
    stubBody = INACTIVE;
    const row = await scoreAgain();
    assert.equal(row.subscores[G].available, false);
    assert.equal(row.subscores[G].components.reason_code, 'no_recent_public_activity');
    assert.equal(row.weights[P], 1);
    stubBody = FIXTURE;
  });

  await t.test('f3 (no link): score-again is unavailable with no_github_link and makes no call', async () => {
    await upload('f3_support_nogithub.pdf');
    const before = stub.requests.length;
    const row = await scoreAgain();
    assert.equal(row.subscores[G].available, false);
    assert.equal(row.subscores[G].value, null);
    assert.equal(row.subscores[G].components.reason_code, 'no_github_link');
    assert.equal(row.weights[P], 1);
    assert.equal(stub.requests.length, before, 'zero stub requests');
  });

  await t.test('service down: f1 still scores, GitHub is service_unavailable', async () => {
    await upload('f1_dev_github.pdf');
    await stub.close();
    stub = null;
    const row = await scoreAgain();
    assert.equal(row.subscores[G].available, false);
    assert.equal(row.subscores[G].components.reason_code, 'service_unavailable');
    assert.equal(row.weights[P], 1);
  });
});
