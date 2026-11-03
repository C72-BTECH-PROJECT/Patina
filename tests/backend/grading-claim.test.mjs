// T-0029 (offline): I-0069. gradeOnce() grades an attempt only if it won the
// claim, releases the claim when grading fails, and refuses to return a result
// whose completion lost to a newer claim. Fakes only; no database, no service.
//
//   node --test tests/backend/grading-claim.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';

const modUrl = new URL(`file:///${join(REPO_DIR, 'backend', 'Services', 'gradingClaim.js').replace(/\\/g, '/')}`);
const load = () => import(modUrl);

const CLAIMED = { id: 'a1', job_id: 'j1', questions: {}, grading_started_at: '2026-11-03T10:00:00.000Z' };
const EVALUATION = { score: 50, results: [] };

function deps(over = {}) {
  const log = { grade: 0, release: [], complete: [] };
  return {
    log,
    d: {
      claim: async () => CLAIMED,
      grade: async () => { log.grade += 1; return EVALUATION; },
      complete: async (claimedAt, evaluation) => { log.complete.push([claimedAt, evaluation]); return true; },
      release: async (claimedAt) => { log.release.push(claimedAt); },
      ...over,
    },
  };
}

test('happy path: claim, grade, complete with the same claim timestamp -> 200 with the evaluation', async () => {
  const { gradeOnce } = await load();
  const { d, log } = deps();
  const r = await gradeOnce(d);
  assert.equal(r.status, 200);
  assert.equal(r.evaluation, EVALUATION);
  assert.deepEqual(log.complete, [[CLAIMED.grading_started_at, EVALUATION]]);
  assert.deepEqual(log.release, []);
});

test('claim lost (already submitted or being graded) -> 409 and no grading call', async () => {
  const { gradeOnce } = await load();
  const { d, log } = deps({ claim: async () => null });
  const r = await gradeOnce(d);
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'already_submitted');
  assert.equal(log.grade, 0);
});

test('grading fails -> claim released once with its timestamp, 502 by default', async () => {
  const { gradeOnce } = await load();
  const { d, log } = deps({ grade: async () => { throw new Error('service down'); } });
  const r = await gradeOnce(d);
  assert.equal(r.status, 502);
  assert.deepEqual(log.release, [CLAIMED.grading_started_at]);
  assert.deepEqual(log.complete, []);
});

test('grading fails with a GradeError -> its status and body, claim released', async () => {
  const { gradeOnce, GradeError } = await load();
  const { d, log } = deps({ grade: async () => { throw new GradeError(409, { error: 'key_unavailable', message: 'x' }); } });
  const r = await gradeOnce(d);
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'key_unavailable');
  assert.deepEqual(log.release, [CLAIMED.grading_started_at]);
});

test('completion lost to a newer claim (stale grader) -> 409, result not returned, nothing released', async () => {
  const { gradeOnce } = await load();
  const { d, log } = deps({ complete: async () => false });
  const r = await gradeOnce(d);
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'superseded');
  assert.equal(r.evaluation, undefined);
  assert.deepEqual(log.release, []);
});

test('completion write errors -> claim released, 500', async () => {
  const { gradeOnce } = await load();
  const { d, log } = deps({ complete: async () => { throw new Error('db down'); } });
  const r = await gradeOnce(d);
  assert.equal(r.status, 500);
  assert.deepEqual(log.release, [CLAIMED.grading_started_at]);
});

test('a failing release never masks the grading error', async () => {
  const { gradeOnce } = await load();
  const { d } = deps({
    grade: async () => { throw new Error('service down'); },
    release: async () => { throw new Error('release failed'); },
  });
  const r = await gradeOnce(d);
  assert.equal(r.status, 502);
});
