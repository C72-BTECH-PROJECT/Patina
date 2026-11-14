// R-37 (offline): the answer-key scan of lib/network.mjs, on sample response bodies.
// No browser and no stack: the entries have the shape recordApiResponses() records.
//
//   node --test tests/e2e/lib/network.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_KEY_FIELDS, answerKeyFieldsFor, findAnswerKeyLeaks, findFieldNames } from './network.mjs';

const entry = (method, path, body) => ({ url: `http://127.0.0.1:5173${path}`, path, method, status: 200, body, bodyError: null });

// A graded result as the candidate's status read returns it, with the key's explanation leaked
// into one per-question result (the field the key carries: assessment-service/app/validators.py:188).
const leakingStatus = entry('GET', '/api/assessment/status', {
  state: 'completed',
  result: {
    score: 60,
    results: [
      { question_id: 'q1', question_type: 'mcq', correct: true, points: 1, max_points: 1, candidate_feedback: 'Correct.' },
      { question_id: 'q2', question_type: 'mcq', correct: false, points: 0, max_points: 1, candidate_feedback: 'Incorrect.', explanation: 'B is right because ...' },
    ],
  },
});

// The same read without the leak.
const cleanStatus = entry('GET', '/api/assessment/status', {
  state: 'completed',
  result: { score: 60, results: [{ question_id: 'q1', question_type: 'mcq', correct: true, points: 1, max_points: 1, candidate_feedback: 'Correct.' }] },
});

// Score and application responses carry the score's own explanation record (not key material).
const scoreResult = entry('GET', '/api/applications/0b6f2d0e-1111-4111-8111-000000000001/result', {
  score: { credibilityScore: 62.25, explanation: { version: 1, summary: 'Composite 62.25.', factors: [], skill_evidence: [] } },
});
const candidateAnalysis = entry('GET', '/api/candidate-analysis', {
  credibilityScore: 62.25, explanation: { version: 1, factors: [] },
});

test('explanation is a key field on /api/assessment/ responses only', () => {
  assert.ok(answerKeyFieldsFor('/api/assessment/status').includes('explanation'));
  assert.ok(answerKeyFieldsFor('/api/assessment/evaluate').includes('explanation'));
  assert.ok(answerKeyFieldsFor('/api/assessment/7f1c/answers').includes('explanation'));
  for (const path of ['/api/applications/x/result', '/api/candidate-analysis', '/api/jobs/my-applications', '/api/assessmentx', '']) {
    assert.ok(!answerKeyFieldsFor(path).includes('explanation'), path);
  }
  // The other key fields count everywhere.
  for (const f of ANSWER_KEY_FIELDS) assert.ok(answerKeyFieldsFor('/api/candidate-analysis').includes(f), f);
});

test('a key explanation in an assessment response is reported, with its place', () => {
  assert.deepEqual(findAnswerKeyLeaks([leakingStatus]), ['GET /api/assessment/status $.result.results[1].explanation']);
  // Before R-37 the default scan missed it.
  assert.deepEqual(findFieldNames(leakingStatus.body), []);
});

test('a score response with its own explanation, and a clean assessment response, pass', () => {
  assert.deepEqual(findAnswerKeyLeaks([cleanStatus, scoreResult, candidateAnalysis]), []);
});

test('the other key fields are reported on any response, and every leak in a run is listed', () => {
  const evaluateLeak = entry('POST', '/api/assessment/evaluate', { results: [{ question_id: 'q7', ideal_answer: 'x', key_points: ['y'] }] });
  const resultLeak = entry('GET', '/api/applications/a/result', { score: { explanation: {} }, answer_key: { answers: [] } });
  assert.deepEqual(findAnswerKeyLeaks([cleanStatus, evaluateLeak, scoreResult, resultLeak, leakingStatus]), [
    'POST /api/assessment/evaluate $.results[0].ideal_answer',
    'POST /api/assessment/evaluate $.results[0].key_points',
    'GET /api/applications/a/result $.answer_key',
    'GET /api/assessment/status $.result.results[1].explanation',
  ]);
});

test('bodies that are null or unread yield no hits (the spine checks bodyError separately)', () => {
  assert.deepEqual(findAnswerKeyLeaks([entry('GET', '/api/assessment/status', null), entry('GET', '/api/assessment/status', undefined)]), []);
});
