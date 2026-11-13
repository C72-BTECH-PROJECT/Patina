// Tier 2 (live). R-10 (Y1): POST /api/analyze is removed; this file moved to the
// endpoints that replaced it. The candidate uploads f1, applies, and the apply
// response reports `scoring.status = "scored"` with exactly one `scores` row for
// that candidate and job; score-again inserts another row; `/api/analyze` is 404.
// (The file keeps its old name so the harness lists stay stable.)
//
// Not covered here, because it needs nlp-engine stopped mid-run: apply with the
// parser down -> 201 `failed`, listed as `pending`, then score-again after restart.
// The offline twin is tests/backend/score-on-apply.test.mjs; the live run is the
// verifier's (TASKS.md R-10 check).
//
// Writes to the shared Supabase project, scoped to the t0001_ accounts and a job
// tagged "[T-0001 TEST]" (lib/testdb.mjs), swept before and after.
//
//   BACKEND_BASE_URL=http://127.0.0.1:5001 node --test tests/backend/live-analyze.test.mjs
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TESTS_DIR, backendBaseUrl } from './lib/env.mjs';
import { api, login } from './lib/session.mjs';
import { client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, sweep } from './lib/testdb.mjs';

const BASE = backendBaseUrl();
const cfg = liveConfig();
const skip = cfg.missing.length ? `tests/.env missing ${cfg.missing.join(', ')}` : false;
const recruiterSkip = skip || (cfg.recruiterPassword ? false : 'tests/.env missing TEST_RECRUITER_PASSWORD');
const recruiter2Skip = recruiterSkip
  || (cfg.recruiter2Username && cfg.recruiter2Password ? false : 'tests/.env missing TEST_RECRUITER2_*');

let sb;
let ids;
let jobId;
let cookie;
let applicationId;

const scoreRows = async () => {
  const { data, error } = await sb.from('scores').select('id, weights, explanation, composite_score, resume_id')
    .eq('candidate_id', ids.C).eq('job_id', jobId).order('created_at', { ascending: true });
  assert.ifError(error);
  return data;
};

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
  jobId = await insertTestJob(sb, ids.R);
  cookie = await login(cfg.candidateUsername, cfg.candidatePassword);
});

after(async () => {
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  console.log('remaining after teardown:', remaining);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

test('upload f1, apply -> 201 scored; one scores row with weights summing to 1 and a band', { skip }, async () => {
  const form = new FormData();
  form.append('resume', new Blob([readFileSync(join(TESTS_DIR, 'fixtures', 'f1_dev_github.pdf'))], { type: 'application/pdf' }), 'f1_dev_github.pdf');
  const up = await fetch(`${BASE}/api/resume/upload`, { method: 'POST', body: form, headers: { Cookie: cookie } });
  const upText = await up.text();
  assert.equal(up.status, 201, `upload: HTTP ${up.status}: ${upText.slice(0, 300)}`);
  assert.ok(JSON.parse(upText).parsed.skills.length > 0, 'expected skills from f1 (proves the NLP service was called)');

  const r = await api(cookie, 'POST', `/api/jobs/${jobId}/apply`);
  assert.equal(r.status, 201, `apply: HTTP ${r.status}: ${r.text.slice(0, 300)}`);
  assert.deepEqual(r.body.scoring, { status: 'scored', reason: null });
  assert.equal(r.body.candidate_id, ids.C);
  assert.equal(r.body.job_id, jobId);
  applicationId = r.body.id;

  const rows = await scoreRows();
  assert.equal(rows.length, 1, 'exactly one scores row for this candidate and job');
  const sum = Object.values(rows[0].weights).reduce((s, n) => s + Number(n), 0);
  assert.ok(Math.abs(sum - 1) < 1e-3, `weights sum to ${sum}`);
  assert.ok(['high', 'medium', 'low'].includes(rows[0].explanation.band), `band: ${rows[0].explanation.band}`);
  assert.equal(rows[0].explanation.github_account?.ownership_verified, false);

  const mine = await api(cookie, 'GET', '/api/jobs/my-applications');
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.find((a) => a.id === applicationId)?.scoring, { state: 'scored' });

  const analysis = await api(cookie, 'GET', '/api/candidate-analysis');
  assert.equal(analysis.status, 200, analysis.text.slice(0, 200));
  assert.equal(analysis.body.candidateId, ids.C);
  assert.equal(analysis.body.band, rows[0].explanation.band);
});

test('score-again as the candidate -> 200 scored and a second row (the first is unchanged)', { skip }, async () => {
  assert.ok(applicationId, 'the apply test must run first');
  const [first] = await scoreRows();
  const r = await api(cookie, 'POST', `/api/applications/${applicationId}/score`);
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.deepEqual(r.body, { applicationId, scoring: { status: 'scored', reason: null } });
  const rows = await scoreRows();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], first);
});

test('score-again as the job\'s recruiter -> 200', { skip: recruiterSkip }, async () => {
  const cookieR = await login(cfg.recruiterUsername, cfg.recruiterPassword);
  const r = await api(cookieR, 'POST', `/api/applications/${applicationId}/score`);
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.body.scoring.status, 'scored');
});

test('score-again as another recruiter -> 403', { skip: recruiter2Skip }, async () => {
  const cookieR2 = await login(cfg.recruiter2Username, cfg.recruiter2Password);
  const before = (await scoreRows()).length;
  const r = await api(cookieR2, 'POST', `/api/applications/${applicationId}/score`);
  assert.equal(r.status, 403, r.text.slice(0, 300));
  assert.equal((await scoreRows()).length, before);
});

test('POST /api/analyze -> 404 (removed, Y1)', { skip }, async () => {
  const form = new FormData();
  form.append('jobId', jobId);
  form.append('resume', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'x.pdf');
  const r = await fetch(`${BASE}/api/analyze`, { method: 'POST', body: form, headers: { Cookie: cookie } });
  assert.equal(r.status, 404);
});
