// T-0029 criterion 7 (live): I-0069. One attempt is graded once.
// Needs the backend and assessment-service (:8002). Seeded attempts are
// MCQ-only, so grading is deterministic and spends no LLM call.
//
//   BACKEND_BASE_URL=http://localhost:5000 node --test tests/backend/live-evaluate-once.test.mjs
import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, login } from './lib/session.mjs';
import {
  client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, snapshotProfiles, sweep,
} from './lib/testdb.mjs';
import { assessmentServiceUp, seedAssessment, seedScore } from './lib/assessment.mjs';

const cfg = liveConfig();
let skip = cfg.missing.length ? `tests/.env missing ${cfg.missing.join(', ')}` : false;
if (!skip && !(await assessmentServiceUp())) skip = 'assessment-service (:8002) is not running';

let sb;
let ids;
let cookieC;

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  await snapshotProfiles(sb, ids);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
  cookieC = await login(cfg.candidateUsername, cfg.candidatePassword);
});

beforeEach(async () => {
  // Every case starts from a clean slate: no open attempt left by an earlier case.
  if (skip || !sb) return;
  await sweep(sb, ids);
});

after(async () => {
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

const evaluate = (id, answers) => api(cookieC, 'POST', '/api/assessment/evaluate', { assessmentId: id, answers });
const row = async (id) => {
  const { data, error } = await sb.from('assessments').select('status, score').eq('id', id).single();
  assert.ifError(error);
  return data;
};

test('I-0069: 5 concurrent submits -> exactly one 200, four 409, one completion folded into the score', { skip }, async () => {
  const jobId = await insertTestJob(sb, ids.R);
  const scoreId = await seedScore(sb, { candidateId: ids.C, jobId });
  const a = await seedAssessment(sb, { candidateId: ids.C, jobId });
  const results = await Promise.all(Array.from({ length: 5 }, () => evaluate(a.id, a.responses)));
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 409, 409, 409, 409], `statuses ${statuses}: ${results.map((r) => r.text.slice(0, 120)).join(' | ')}`);
  const ok = results.find((r) => r.status === 200);
  assert.equal(ok.body.score, 50);
  assert.equal((await row(a.id)).status, 'completed');
  const { data: score } = await sb.from('scores').select('subscores').eq('id', scoreId).single();
  assert.equal(score.subscores.assessment_results.components.score, ok.body.score);
  // A submit after completion is refused too.
  assert.equal((await evaluate(a.id, a.responses)).status, 409);
});

test('I-0069: a fresh grading claim is respected by evaluate and by generate', { skip }, async () => {
  const jobId = await insertTestJob(sb, ids.R);
  const a = await seedAssessment(sb, {
    candidateId: ids.C, jobId, status: 'grading', gradingStartedAt: new Date().toISOString(),
  });
  const e = await evaluate(a.id, a.responses);
  assert.equal(e.status, 409, e.text.slice(0, 200));
  const g = await api(cookieC, 'POST', '/api/assessment/generate', { jobId });
  assert.equal(g.status, 409, g.text.slice(0, 200));
  assert.equal(g.body.error, 'grading_in_progress');
  assert.equal((await row(a.id)).status, 'grading');
});

test('I-0069: a stale grading claim (older than 10 minutes) is reclaimed and graded', { skip }, async () => {
  const jobId = await insertTestJob(sb, ids.R);
  const a = await seedAssessment(sb, {
    candidateId: ids.C, jobId, status: 'grading', gradingStartedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
  });
  const e = await evaluate(a.id, a.responses);
  assert.equal(e.status, 200, e.text.slice(0, 200));
  assert.equal((await row(a.id)).status, 'completed');
});
