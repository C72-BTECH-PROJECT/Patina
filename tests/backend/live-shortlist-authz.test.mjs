// T-0004 / I-0019 (live): only the recruiter who owns a job may change the
// status of an application to it, and only recruiter-settable statuses are
// accepted.
//
// Accounts (tests/.env): candidate t0001_cand (C), owner recruiter t0001_recr
// (R, "recruiter A"), other recruiter t0001_recr2 (R2, "recruiter B").
// Applications are inserted directly (service role) on jobs tagged
// "[T-0001 TEST]"; the sweep removes everything. See lib/testdb.mjs.
//
//   BACKEND_BASE_URL=http://localhost:5000 node --test tests/backend/live-shortlist-authz.test.mjs
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { api, login } from './lib/session.mjs';
import {
  client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, snapshotProfiles, sweep,
} from './lib/testdb.mjs';

const cfg = liveConfig();
const missing = [
  ...cfg.missing,
  ...(cfg.recruiter2Username ? [] : ['TEST_RECRUITER2_USERNAME']),
  ...(cfg.recruiter2Password && cfg.recruiterPassword ? [] : ['TEST_RECRUITER(2)_PASSWORD']),
];
const skip = missing.length ? `tests/.env missing ${missing.join(', ')}` : false;
const SHORTLIST = '/api/jobs/applications/shortlist';

let sb;
let ids;
let cookieC;
let cookieA;
let cookieB;

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  await snapshotProfiles(sb, ids);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
  cookieC = await login(cfg.candidateUsername, cfg.candidatePassword);
  cookieA = await login(cfg.recruiterUsername, cfg.recruiterPassword);
  cookieB = await login(cfg.recruiter2Username, cfg.recruiter2Password);
});

after(async () => {
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  console.log('remaining after teardown:', remaining);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

// One new job owned by recruiter A and one application to it by C
// (unique(candidate_id, job_id) => one job per application).
async function newApplication(status = 'submitted') {
  const jobId = await insertTestJob(sb, ids.R);
  const { data, error } = await sb
    .from('applications')
    .insert({ candidate_id: ids.C, job_id: jobId, status })
    .select('id')
    .single();
  assert.ifError(error);
  return data.id;
}

async function rowStatus(applicationId) {
  const { data, error } = await sb.from('applications').select('status').eq('id', applicationId).single();
  assert.ifError(error);
  return data.status;
}

async function notificationsFor(applicationId) {
  const { data, error } = await sb.from('notifications').select('type, data').eq('user_id', ids.C);
  assert.ifError(error);
  return (data ?? []).filter((n) => n.data?.applicationId === applicationId);
}

test('I-0019: recruiter B cannot shortlist recruiter A\'s application (404, row unchanged, no notification)', { skip }, async () => {
  const appId = await newApplication();
  const r = await api(cookieB, 'POST', SHORTLIST, { applicationId: appId, status: 'shortlisted' });
  const state = { http: r.status, row: await rowStatus(appId), notifications: (await notificationsFor(appId)).length };
  assert.deepEqual(state, { http: 404, row: 'submitted', notifications: 0 }, `got ${JSON.stringify(state)}`);
});

test('I-0019: recruiter B cannot reject recruiter A\'s application (404, row unchanged)', { skip }, async () => {
  const appId = await newApplication();
  const r = await api(cookieB, 'POST', SHORTLIST, { applicationId: appId, status: 'rejected' });
  const state = { http: r.status, row: await rowStatus(appId) };
  assert.deepEqual(state, { http: 404, row: 'submitted' }, `got ${JSON.stringify(state)}`);
});

test('control: recruiter A shortlists own application (200, row shortlisted, 1 notification) and rejects another (200, no notification)', { skip }, async () => {
  const shortlistId = await newApplication();
  const r1 = await api(cookieA, 'POST', SHORTLIST, { applicationId: shortlistId, status: 'shortlisted' });
  assert.equal(r1.status, 200, r1.text);
  assert.equal(r1.body.status, 'shortlisted');
  assert.equal(await rowStatus(shortlistId), 'shortlisted');
  const notes = await notificationsFor(shortlistId);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].type, 'shortlisted');

  const rejectId = await newApplication();
  const r2 = await api(cookieA, 'POST', SHORTLIST, { applicationId: rejectId, status: 'rejected' });
  assert.equal(r2.status, 200, r2.text);
  assert.equal(await rowStatus(rejectId), 'rejected');
  assert.equal((await notificationsFor(rejectId)).length, 0);
});

test('I-0019: well-formed but non-existent applicationId -> 404', { skip }, async () => {
  const r = await api(cookieA, 'POST', SHORTLIST, { applicationId: randomUUID(), status: 'shortlisted' });
  assert.equal(r.status, 404, `HTTP ${r.status}: ${r.text.slice(0, 200)}`);
});

test('control: candidate session -> 403', { skip }, async () => {
  const appId = await newApplication();
  const r = await api(cookieC, 'POST', SHORTLIST, { applicationId: appId, status: 'shortlisted' });
  assert.equal(r.status, 403);
  assert.equal(await rowStatus(appId), 'submitted');
});

// The owner may only set 'shortlisted' or 'rejected'. The row starts as
// 'shortlisted' so that any accepted change would be visible.
for (const [label, status] of [
  ['"submitted"', 'submitted'],
  ['"withdrawn"', 'withdrawn'],
  ['"SHORTLISTED" (wrong case)', 'SHORTLISTED'],
  ['"" (empty)', ''],
  ['object', { $ne: 'x' }],
  ['number', 123],
]) {
  test(`status ${label} -> 400, row unchanged, no notification`, { skip }, async () => {
    const appId = await newApplication('shortlisted');
    const r = await api(cookieA, 'POST', SHORTLIST, { applicationId: appId, status });
    const state = { http: r.status, row: await rowStatus(appId), notifications: (await notificationsFor(appId)).length };
    assert.deepEqual(state, { http: 400, row: 'shortlisted', notifications: 0 }, `got ${JSON.stringify(state)}`);
  });
}
