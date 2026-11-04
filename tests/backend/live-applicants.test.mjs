// T-0031 (a) (live): I-0063, I-0028, D1, D2. Recruiters see the real Auth email,
// and only the service role can call applicant_emails.
//
// Accounts: t0001_cand (C), t0001_cand2 (C2), t0001_recr (R), t0001_recr2 (R2). R
// and R2 each own a job tagged "[T-0001 TEST]" with one applicant; the sweep
// removes them. See lib/testdb.mjs.
//
//   BACKEND_BASE_URL=http://localhost:5000 node --test tests/backend/live-applicants.test.mjs
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { api, login } from './lib/session.mjs';
import {
  client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, snapshotProfiles, sweep,
} from './lib/testdb.mjs';
import { anonClient, anonKey, directAccessToken, supabaseUrl } from './lib/assessment.mjs';

const cfg = liveConfig();
const missing = [
  ...cfg.missing,
  ...(cfg.recruiterPassword ? [] : ['TEST_RECRUITER_PASSWORD']),
  ...(cfg.candidate2Username ? [] : ['TEST_CANDIDATE2_USERNAME']),
  ...(cfg.recruiter2Username && cfg.recruiter2Password ? [] : ['TEST_RECRUITER2_USERNAME/PASSWORD']),
];
const skip = missing.length ? `tests/.env missing ${missing.join(', ')}` : false;

let sb;
let ids;
let cookieR;
let cookieR2;
let jobId;
let applicationId;
let applicationId2;

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  await snapshotProfiles(sb, ids);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
  cookieR = await login(cfg.recruiterUsername, cfg.recruiterPassword);
  jobId = await insertTestJob(sb, ids.R);
  const { data, error } = await sb
    .from('applications')
    .insert({ candidate_id: ids.C, job_id: jobId })
    .select('id')
    .single();
  assert.ifError(error);
  applicationId = data.id;

  cookieR2 = await login(cfg.recruiter2Username, cfg.recruiter2Password);
  const jobId2 = await insertTestJob(sb, ids.R2);
  const second = await sb
    .from('applications')
    .insert({ candidate_id: ids.C2, job_id: jobId2 })
    .select('id')
    .single();
  assert.ifError(second.error);
  applicationId2 = second.data.id;
});

after(async () => {
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

const authEmail = async (id) => {
  const { data, error } = await sb.auth.admin.getUserById(id);
  assert.ifError(error);
  return data.user.email;
};

test('I-0028: /api/recruiter/applicants returns the Auth email for an applicant with a profile', { skip }, async () => {
  const r = await api(cookieR, 'GET', '/api/recruiter/applicants');
  assert.equal(r.status, 200, r.text.slice(0, 200));
  const row = r.body.find((a) => a.applicationId === applicationId);
  assert.ok(row, 'the seeded application is not in the list');
  assert.equal(row.candidateInfo.email, await authEmail(ids.C));
  assert.ok(row.candidateInfo.name, 'expected a name');
});

// I-0079. Each recruiter owns a job with one applicant, so the applications query
// and the applicant_emails call both run. Only facts are compared: if the recruiter
// filter regresses, this list holds real people from the shared project, and a
// failure must not print their emails.
test('I-0079: two recruiters with applicants each see only their own candidates', { skip }, async () => {
  const emailC = await authEmail(ids.C);
  const emailC2 = await authEmail(ids.C2);
  assert.notEqual(emailC, emailC2, 'the two candidates must differ or this proves nothing');

  const cases = [
    { name: 'R', cookie: cookieR, ownApp: applicationId, ownEmail: emailC, otherApp: applicationId2, otherEmail: emailC2 },
    { name: 'R2', cookie: cookieR2, ownApp: applicationId2, ownEmail: emailC2, otherApp: applicationId, otherEmail: emailC },
  ];
  for (const { name, cookie, ownApp, ownEmail, otherApp, otherEmail } of cases) {
    const r = await api(cookie, 'GET', '/api/recruiter/applicants');
    assert.equal(r.status, 200, `${name}: HTTP ${r.status}`);
    const state = {
      rows: r.body.length,
      ownApplicantWithEmail: r.body.some((a) => a.applicationId === ownApp && a.candidateInfo.email === ownEmail),
      rowsForAnyoneElse: r.body.filter((a) => a.candidateInfo.email !== ownEmail).length,
      otherApplication: r.text.includes(otherApp),
      otherEmail: r.text.includes(otherEmail),
    };
    assert.deepEqual(state, {
      rows: 1,
      ownApplicantWithEmail: true,
      rowsForAnyoneElse: 0,
      otherApplication: false,
      otherEmail: false,
    }, `${name} sees someone else's applicants`);
  }
});

// Only 42501 counts. PGRST202 ("no such function") must not pass: that is what a
// missing function answers, and it would prove nothing about the revoke.
const assertPermissionDenied = (error, data) => {
  assert.ok(error, `rpc returned ${JSON.stringify(data)}`);
  assert.equal(error.code, '42501', `unexpected refusal: ${JSON.stringify(error)}`);
};

test('D1: applicant_emails is refused for anon', { skip }, async () => {
  const { data, error } = await anonClient().rpc('applicant_emails', { p_candidate_ids: [ids.C] });
  assertPermissionDenied(error, data);
});

test('D1: applicant_emails is refused for a signed-in candidate', { skip }, async () => {
  const token = await directAccessToken(sb, ids.C, cfg.candidatePassword);
  const r = await fetch(`${supabaseUrl()}/rest/v1/rpc/applicant_emails`, {
    method: 'POST',
    headers: { apikey: anonKey(), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_candidate_ids: [ids.C] }),
  });
  const body = await r.json();
  assert.equal(body.code, '42501', JSON.stringify(body));
  assert.equal(r.status, 403, JSON.stringify(body));
});

test('D1: applicant_emails works for the service role, and returns only (id, email) for the requested ids', { skip }, async () => {
  const stranger = randomUUID();
  const { data, error } = await sb.rpc('applicant_emails', { p_candidate_ids: [ids.C, stranger] });
  assert.ifError(error);
  assert.deepEqual(data, [{ id: ids.C, email: await authEmail(ids.C) }]);
});

test('D2: recruiter GET /api/jobs/applications is 404', { skip }, async () => {
  const r = await api(cookieR, 'GET', '/api/jobs/applications');
  assert.equal(r.status, 404, r.text.slice(0, 200));
});
