// T-0007 / I-0022 (live): regression guard. One user's analysis must never be
// served to another user (the pre-baseline in-memory globals did exactly that).
//
// Accounts (tests/.env): candidate t0001_cand (C) runs a real /api/analyze on
// f1_dev_github.pdf (needs the NLP service); candidate t0001_cand2 (C2) has
// none and must see "no analysis"; recruiters t0001_recr (R, owns the job) and
// t0001_recr2 (R2, no jobs) must not see C's data either.
//
//   BACKEND_BASE_URL=http://localhost:5000 node --test tests/backend/live-analysis-isolation.test.mjs
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TESTS_DIR, backendBaseUrl } from './lib/env.mjs';
import { api, login } from './lib/session.mjs';
import {
  client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, snapshotProfiles, sweep,
} from './lib/testdb.mjs';

const BASE = backendBaseUrl();
const cfg = liveConfig();
const missing = [
  ...cfg.missing,
  ...(cfg.recruiterPassword ? [] : ['TEST_RECRUITER_PASSWORD']),
  ...(cfg.recruiter2Username && cfg.recruiter2Password ? [] : ['TEST_RECRUITER2_*']),
  ...(cfg.candidate2Username && cfg.candidate2Password ? [] : ['TEST_CANDIDATE2_*']),
];
const skip = missing.length ? `tests/.env missing ${missing.join(', ')}` : false;

// Identifying content of f1_dev_github.pdf (tests/fixtures/make_fixtures.py).
const C_MARKERS = ['Maya Okafor', 'maya.okafor@example.com', 'example-mokafor'];

let sb;
let ids;
let cookieC;
let cookieC2;
let cookieR;
let cookieR2;

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  await snapshotProfiles(sb, ids);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
  const jobId = await insertTestJob(sb, ids.R);
  cookieC = await login(cfg.candidateUsername, cfg.candidatePassword);
  cookieC2 = await login(cfg.candidate2Username, cfg.candidate2Password);
  cookieR = await login(cfg.recruiterUsername, cfg.recruiterPassword);
  cookieR2 = await login(cfg.recruiter2Username, cfg.recruiter2Password);

  const form = new FormData();
  form.append('jobId', jobId);
  form.append('resume', new Blob([readFileSync(join(TESTS_DIR, 'fixtures', 'f1_dev_github.pdf'))], { type: 'application/pdf' }), 'f1_dev_github.pdf');
  const r = await fetch(`${BASE}/api/analyze`, { method: 'POST', body: form, headers: { Cookie: cookieC } });
  const text = await r.text();
  assert.equal(r.status, 200, `analyze as C failed: HTTP ${r.status} ${text.slice(0, 300)}`);
  assert.equal(JSON.parse(text).candidateId, ids.C);
});

after(async () => {
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  console.log('remaining after teardown:', remaining);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

const leaks = (text) => C_MARKERS.concat(ids.C).filter((m) => text.includes(m));

test('I-0022: candidate 2 does not get candidate 1\'s analysis (404, no identifying data)', { skip }, async () => {
  const r = await api(cookieC2, 'GET', '/api/candidate-analysis');
  const state = { http: r.status, leaked: leaks(r.text) };
  assert.deepEqual(state, { http: 404, leaked: [] }, `got ${JSON.stringify(state)}: ${r.text.slice(0, 200)}`);
});

test('control: candidate 1 still gets their own analysis', { skip }, async () => {
  const r = await api(cookieC, 'GET', '/api/candidate-analysis');
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.body.candidateId, ids.C);
  assert.ok(Array.isArray(r.body.extractedSkills) && r.body.extractedSkills.length > 0);
});

test('recruiters cannot use the candidate endpoint (403) and recruiter 2 sees no applicants', { skip }, async () => {
  for (const [name, cookie] of [['R', cookieR], ['R2', cookieR2]]) {
    const r = await api(cookie, 'GET', '/api/candidate-analysis');
    assert.equal(r.status, 403, `${name}: HTTP ${r.status}`);
    assert.deepEqual(leaks(r.text), []);
  }
  const apps = await api(cookieR2, 'GET', '/api/recruiter/applicants');
  assert.equal(apps.status, 200, apps.text.slice(0, 200));
  assert.deepEqual(apps.body, []);
});
