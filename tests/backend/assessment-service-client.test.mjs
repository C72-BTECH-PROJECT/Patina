// T-0031 (f) (offline): I-0062. Core's assessment-service client against a local
// stub (lib/stub-server.mjs), never the real service and never an LLM.
//
//   node --test tests/backend/assessment-service-client.test.mjs
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';
import { hang, json, raw, reset, startStub } from './lib/stub-server.mjs';

const load = () => import(
  new URL(`file:///${join(REPO_DIR, 'backend', 'Services', 'assessmentService.js').replace(/\\/g, '/')}`)
);

const SENTINEL = 'T0031-UPSTREAM-SECRET-BODY';
const REQUEST_ID = 'req-t0031';
let stub;

const useStub = async (handler) => {
  stub = await startStub({ handler });
  process.env.ASSESSMENT_SERVICE_URL = stub.url;
  return stub;
};

afterEach(async () => {
  delete process.env.ASSESSMENT_SERVICE_URL;
  if (stub) await stub.close();
  stub = null;
});

test('generate posts JSON with X-Request-ID and returns the parsed body', async () => {
  const { generateAssessment } = await load();
  await useStub((_q, res) => json(res, 200, { questions: {}, answer_key: {} }));
  const data = await generateAssessment({ job_id: 'j' }, { requestId: REQUEST_ID });
  assert.deepEqual(data, { questions: {}, answer_key: {} });
  assert.equal(stub.requests.length, 1);
  assert.equal(stub.requests[0].path, '/generate-assessment');
  assert.equal(stub.requests[0].headers['x-request-id'], REQUEST_ID);
  assert.deepEqual(stub.requests[0].body, { job_id: 'j' });
});

test('evaluate posts JSON with X-Request-ID and returns the parsed body', async () => {
  const { evaluateAnswers } = await load();
  await useStub((_q, res) => json(res, 200, { score: 50 }));
  const data = await evaluateAnswers({ assessment_id: 'a' }, { requestId: REQUEST_ID });
  assert.deepEqual(data, { score: 50 });
  assert.equal(stub.requests[0].path, '/evaluate-assessment');
  assert.equal(stub.requests[0].headers['x-request-id'], REQUEST_ID);
});

test('timeouts stay 300 s for generate and 120 s for evaluate', async () => {
  const { GENERATE_TIMEOUT_MS, EVALUATE_TIMEOUT_MS } = await load();
  assert.equal(GENERATE_TIMEOUT_MS, 300000);
  assert.equal(EVALUATE_TIMEOUT_MS, 120000);
});

test('a sentinel upstream body reaches neither the error nor the client answer', async () => {
  const { generateAssessment, evaluateAnswers, assessmentFailure } = await load();
  await useStub((_q, res) => raw(res, 500, JSON.stringify({ detail: SENTINEL })));
  for (const call of [generateAssessment, evaluateAnswers]) {
    const err = await call({}, { requestId: REQUEST_ID }).then(() => null, (e) => e);
    assert.ok(err, 'expected a rejection');
    assert.equal(err.kind, 'bad_status');
    assert.ok(!JSON.stringify({ ...err, message: err.message }).includes(SENTINEL), 'error carries the body');
    const failure = assessmentFailure(err, 'Assessment generation failed');
    assert.equal(failure.status, 502);
    assert.deepEqual(failure.body, { message: 'Assessment generation failed' });
  }
});

test('one retry on a connection error, then the answer', async () => {
  const { generateAssessment } = await load();
  let n = 0;
  await useStub((req, res) => { n += 1; if (n === 1) reset(req); else json(res, 200, { ok: true }); });
  assert.deepEqual(await generateAssessment({}, { requestId: REQUEST_ID }), { ok: true });
  assert.equal(stub.requests.length, 2);
});

test('no retry on a timeout, and the client answer is the "unavailable" 502', async () => {
  const { generateAssessment, assessmentFailure } = await load();
  await useStub(hang);
  const err = await generateAssessment({}, { requestId: REQUEST_ID, timeoutMs: 150 }).then(() => null, (e) => e);
  assert.equal(err.kind, 'timeout');
  assert.equal(stub.requests.length, 1);
  const failure = assessmentFailure(err, 'Assessment generation failed');
  assert.equal(failure.status, 502);
  assert.match(failure.body.message, /unavailable/i);
});

test('a non-JSON 200 is a bad_body 502, not a crash', async () => {
  const { evaluateAnswers, assessmentFailure } = await load();
  await useStub((_q, res) => raw(res, 200, `<html>${SENTINEL}</html>`, 'text/html'));
  const err = await evaluateAnswers({}, { requestId: REQUEST_ID }).then(() => null, (e) => e);
  assert.equal(err.kind, 'bad_body');
  const failure = assessmentFailure(err, 'Assessment evaluation failed');
  assert.equal(failure.status, 502);
  assert.ok(!JSON.stringify(failure.body).includes(SENTINEL));
});

test('the service URL is read on every call', async () => {
  const { evaluateAnswers } = await load();
  await useStub((_q, res) => json(res, 200, { first: true }));
  assert.deepEqual(await evaluateAnswers({}, {}), { first: true });
  const firstStub = stub;
  await useStub((_q, res) => json(res, 200, { second: true }));
  assert.deepEqual(await evaluateAnswers({}, {}), { second: true });
  await firstStub.close();
});

test('the controller has no direct call to the assessment service', () => {
  const src = readFileSync(join(REPO_DIR, 'backend', 'Controllers', 'assessment.controller.js'), 'utf8');
  assert.doesNotMatch(src, /ASSESSMENT_SERVICE_URL/);
  assert.doesNotMatch(src, /\/generate-assessment/);
  assert.doesNotMatch(src, /\/evaluate-assessment/);
  assert.doesNotMatch(src, /detail\.slice\(0, 500\)/);
  assert.match(src, /from '\.\.\/Services\/assessmentService\.js'/);
});

test('resolveRequestId lives in internalHttp.js and keeps the github-evidence rule', async () => {
  const { resolveRequestId } = await import(
    new URL(`file:///${join(REPO_DIR, 'backend', 'Services', 'internalHttp.js').replace(/\\/g, '/')}`)
  );
  const req = (value) => ({ get: () => value });
  assert.equal(resolveRequestId(req('abc-123')), 'abc-123');
  assert.notEqual(resolveRequestId(req('bad id!')), 'bad id!');
  assert.notEqual(resolveRequestId(req('a'.repeat(65))), 'a'.repeat(65));
  assert.match(resolveRequestId(req(undefined)), /^[A-Za-z0-9-]{1,64}$/);
});
