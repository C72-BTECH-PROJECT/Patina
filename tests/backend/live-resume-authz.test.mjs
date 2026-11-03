// T-0029 criterion 5 (live): I-0056. A recruiter gets a signed résumé URL only
// for a candidate who applied to one of that recruiter's jobs; candidateId must
// be a UUID.
//
// Accounts (tests/.env): C (t0001_cand) has a résumé in storage and applies to
// R's job; R2 (t0001_recr2) owns no job C applied to, until the positive control.
// Seeding is through the service role, tagged "[T-0001 TEST]", and swept.
//
//   BACKEND_BASE_URL=http://localhost:5000 node --test tests/backend/live-resume-authz.test.mjs
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TESTS_DIR } from './lib/env.mjs';
import { api, login } from './lib/session.mjs';
import {
  client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, snapshotProfiles, sweep,
} from './lib/testdb.mjs';

const cfg = liveConfig();
const missing = [
  ...cfg.missing,
  ...(cfg.recruiterPassword ? [] : ['TEST_RECRUITER_PASSWORD']),
  ...(cfg.recruiter2Username && cfg.recruiter2Password ? [] : ['TEST_RECRUITER2_*']),
];
const skip = missing.length ? `tests/.env missing ${missing.join(', ')}` : false;

let sb;
let ids;
let cookieR;
let cookieR2;

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  await snapshotProfiles(sb, ids);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
  const jobR = await insertTestJob(sb, ids.R);
  const pdf = readFileSync(join(TESTS_DIR, 'fixtures', 'f1_dev_github.pdf'));
  const { error: upErr } = await sb.storage.from('resumes')
    .upload(`candidates/${ids.C}/resume.pdf`, pdf, { contentType: 'application/pdf', upsert: true });
  assert.ifError(upErr);
  const { error: appErr } = await sb.from('applications').insert({ candidate_id: ids.C, job_id: jobR });
  assert.ifError(appErr);
  cookieR = await login(cfg.recruiterUsername, cfg.recruiterPassword);
  cookieR2 = await login(cfg.recruiter2Username, cfg.recruiter2Password);
});

after(async () => {
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

const resume = (cookie, id) => api(cookie, 'GET', `/api/resume/candidate/${id}`);

test('control: the recruiter whose job C applied to gets a signed URL', { skip }, async () => {
  const r = await resume(cookieR, ids.C);
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.match(r.body.url, /^https?:\/\//);
});

test('I-0056: a recruiter C never applied to gets 404, no URL', { skip }, async () => {
  const r = await resume(cookieR2, ids.C);
  assert.equal(r.status, 404, `R2 got HTTP ${r.status}: ${r.text.slice(0, 200)}`);
  assert.ok(!r.text.includes('token='), 'no signed URL in the body');
});

test('I-0056: a non-UUID candidateId -> 400', { skip }, async () => {
  const r = await resume(cookieR, 'not-a-uuid');
  assert.equal(r.status, 400, `got HTTP ${r.status}: ${r.text.slice(0, 200)}`);
});

test('I-0056: a random UUID -> 404 (same answer as "not yours")', { skip }, async () => {
  const r = await resume(cookieR, crypto.randomUUID());
  assert.equal(r.status, 404, r.text.slice(0, 200));
});

test('positive control: once C applies to an R2 job, R2 gets the URL', { skip }, async () => {
  const jobR2 = await insertTestJob(sb, ids.R2);
  const { error } = await sb.from('applications').insert({ candidate_id: ids.C, job_id: jobR2 });
  assert.ifError(error);
  const r = await resume(cookieR2, ids.C);
  assert.equal(r.status, 200, r.text.slice(0, 200));
});
