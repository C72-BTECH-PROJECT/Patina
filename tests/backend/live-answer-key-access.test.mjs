// T-0029 criterion 3 (live): I-0066. No path from a candidate (or the job's
// recruiter) to an answer key: not PostgREST with their own token, not the
// backend's responses. Passes only after M2, the backend deploy and M4.
//
// The attacker model: C signs in to GoTrue DIRECTLY with the public anon key
// (no backend involved) and queries PostgREST with C's own access token.
//
//   BACKEND_BASE_URL=http://localhost:5000 node --test tests/backend/live-answer-key-access.test.mjs
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';
import { api, login } from './lib/session.mjs';
import {
  client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, snapshotProfiles, sweep,
} from './lib/testdb.mjs';
import { allKeys, directAccessToken, restGet, seedAssessment } from './lib/assessment.mjs';

const cfg = liveConfig();
const missing = [...cfg.missing, ...(cfg.recruiterPassword ? [] : ['TEST_RECRUITER_PASSWORD'])];
const skip = missing.length ? `tests/.env missing ${missing.join(', ')}` : false;

const KEY_FIELDS = ['answer_key', 'correct_option', 'ideal_answer', 'key_points'];
const MARKER = 'SECRET-KEY-MARKER';

let sb;
let ids;
let seeded;
let jobId;
let tokenC;
let tokenR;

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  await snapshotProfiles(sb, ids);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
  jobId = await insertTestJob(sb, ids.R);
  seeded = await seedAssessment(sb, { candidateId: ids.C, jobId });
  tokenC = await directAccessToken(sb, ids.C, cfg.candidatePassword);
  tokenR = await directAccessToken(sb, ids.R, cfg.recruiterPassword);
});

after(async () => {
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

const noKeyIn = (who, r) => {
  const text = JSON.stringify(r.body);
  assert.ok(!allKeys(r.body).has('answer_key'), `${who}: answer_key field returned: ${text.slice(0, 300)}`);
  assert.ok(!text.includes(MARKER), `${who}: key content returned`);
};

test('I-0066 (i): candidate reads own attempt via PostgREST: row returned, no answer_key', { skip }, async () => {
  const r = await restGet(tokenC, `assessments?id=eq.${seeded.id}&select=*`);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.body.length, 1, 'candidate policy must still return the own row');
  noKeyIn('candidate', r);
});

test('I-0066 (ii): candidate cannot read assessment_keys', { skip }, async () => {
  const r = await restGet(tokenC, `assessment_keys?assessment_id=eq.${seeded.id}&select=*`);
  const refused = r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.body) && r.body.length === 0);
  assert.ok(refused, `candidate got HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  noKeyIn('candidate keys', r);
});

test('I-0066 (iii): the job\'s recruiter reads neither the column nor the key table', { skip }, async () => {
  const a = await restGet(tokenR, `assessments?id=eq.${seeded.id}&select=*`);
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 300));
  noKeyIn('recruiter', a);
  const k = await restGet(tokenR, `assessment_keys?assessment_id=eq.${seeded.id}&select=*`);
  const refused = k.status === 401 || k.status === 403 || (k.status === 200 && Array.isArray(k.body) && k.body.length === 0);
  assert.ok(refused, `recruiter got HTTP ${k.status}: ${JSON.stringify(k.body).slice(0, 300)}`);
});

test('I-0066 (iv): backend generate (resumes the open attempt) returns no key fields', { skip }, async () => {
  const cookie = await login(cfg.candidateUsername, cfg.candidatePassword);
  const r = await api(cookie, 'POST', '/api/assessment/generate', { jobId });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.body.assessmentId, seeded.id);
  const keys = allKeys(r.body);
  assert.deepEqual(KEY_FIELDS.filter((f) => keys.has(f)), []);
  assert.ok(!r.text.includes(MARKER));
});

test('I-0066 (v, static): no backend select on assessments names answer_key, and no response carries it', () => {
  const src = readFileSync(join(REPO_DIR, 'backend', 'Controllers', 'assessment.controller.js'), 'utf8');
  const selects = [...src.matchAll(/from\('assessments'\)[\s\S]{0,200}?\.select\('([^']*)'\)/g)].map((m) => m[1]);
  assert.ok(selects.length > 0);
  for (const s of selects) assert.ok(!s.includes('answer_key'), `assessments select names answer_key: ${s}`);
  assert.doesNotMatch(src, /res\.json\([^)]*answer_key/);
});
