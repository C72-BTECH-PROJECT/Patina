// R-12 (offline): assessment orchestration II. Server time limit with an injected
// clock, saved answers, late submits, finalise on read, pending grading and retry,
// attempt reset (Y5), and R-11 verifier defects D1-D4 (REBUILD/DECISIONS.md §6.2,
// §0 A1; REBUILD/TASKS.md R-12).
//
// Nothing leaves loopback, no LLM is called and no model is loaded. Core's real
// routers run in process against local stubs: Supabase (lib/supabase-stub.mjs),
// nlp-engine (replays the R-05 f1 snapshot), github-evidence (synthetic fixture) and
// a FAKE assessment-service whose generate and evaluate calls can succeed, fail with
// the service's real error codes, or be held open. Core's clock is injected
// (configurePreparation({ now })), so no test waits on a timer.
//
//   node --test tests/backend/assessment-time-reset.test.mjs
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_DIR, TESTS_DIR } from './lib/env.mjs';
import { json, startStub } from './lib/stub-server.mjs';
import { createSupabaseStub, fakeServiceKey } from './lib/supabase-stub.mjs';

const backendUrl = (...parts) =>
  new URL(`file:///${join(REPO_DIR, 'backend', ...parts).replace(/\\/g, '/')}`);
const express = createRequire(join(REPO_DIR, 'backend', 'package.json'))('express');

const F1 = readFileSync(join(TESTS_DIR, 'fixtures', 'f1_dev_github.pdf'));
const SNAP_F1 = JSON.parse(readFileSync(join(TESTS_DIR, 'nlp', 'snapshots', 'current', 'f1_dev_github.json'), 'utf8'));
const GH_FIXTURE = JSON.parse(readFileSync(join(TESTS_DIR, 'backend', 'fixtures', 'github-evidence-example-mokafor.json'), 'utf8'));

const A = 'assessment_results';
const RECRUITER = '22222222-2222-4222-8222-0000000000a1';
const OTHER_RECRUITER = '22222222-2222-4222-8222-0000000000a2';
const ADMIN = '33333333-3333-4333-8333-0000000000a1';
const MIN = 60_000;
let seq = 0;
const newCandidate = () => `11111111-1111-4111-8111-${String(700 + ++seq).padStart(12, '0')}`;

const db = createSupabaseStub();

const nlpHandler = (req, res, rec) => {
  const hasJd = rec.rawBody.includes(Buffer.from('name="jd"'));
  if (!rec.rawBody.includes(F1)) return json(res, 422, { error: 'unreadable_document', reason: 'corrupt' });
  return json(res, 200, { ...SNAP_F1, semantic_analysis: hasJd ? SNAP_F1.semantic_analysis : null });
};

// ---- the fake assessment-service ----
const SERVICE_LEAK = 'LEAKY-UPSTREAM gemini 503 quota for key AIza';
let genMode = 'ok';   // 'ok' | { status, body }
let evalMode = 'ok';  // 'ok' | 'hold' | { status, body }
const heldEvals = [];

const makeBundle = (input) => {
  const id = randomUUID();
  const questions = [];
  const answers = [];
  for (let i = 1; i <= 10; i += 1) {
    const qid = `q${i}`;
    if (i <= 6) {
      questions.push({
        question_id: qid, question_type: 'mcq', question: `R-12 fake MCQ ${i}?`, skill: 'python', source: 'jd',
        options: ['A', 'B', 'C', 'D'].map((label) => ({ label, text: `Option ${label}` })),
      });
      answers.push({ question_id: qid, correct_option: 'C', explanation: `R12-KEY-${id}-${qid}` });
    } else {
      questions.push({ question_id: qid, question_type: 'short_answer', question: `R-12 fake short ${i}?`, skill: 'sql', source: 'resume' });
      answers.push({ question_id: qid, ideal_answer: `R12-IDEAL-${id}-${qid}`, key_points: [`R12-KP-${id}-${qid}`] });
    }
  }
  return {
    questions: { assessment_id: id, candidate_id: input?.candidate_id, job_id: input?.job_id, model_used: 'fake-model', prompt_version: 'fake-v1', questions },
    answer_key: { assessment_id: id, answers },
  };
};

const fakeEvaluate = (body) => {
  const keyById = new Map(body.answer_key.map((k) => [k.question_id, k]));
  const given = new Map(body.answers.map((a) => [a.question_id, a.response]));
  const results = body.questions.map((q) => {
    const k = keyById.get(q.question_id);
    const r = given.get(q.question_id);
    if (r === undefined) {
      return { question_id: q.question_id, question_type: q.question_type, skill: q.skill, correct: false, points: 0, max_points: 1, candidate_feedback: 'Not answered.', recruiter_feedback: 'Not answered.' };
    }
    if (q.question_type === 'mcq') {
      const correct = r === k.correct_option;
      return { question_id: q.question_id, question_type: 'mcq', skill: q.skill, correct, points: correct ? 1 : 0, max_points: 1, candidate_feedback: correct ? 'Correct.' : 'Incorrect.', recruiter_feedback: `Correct answer: ${k.correct_option}.` };
    }
    return { question_id: q.question_id, question_type: 'short_answer', skill: q.skill, correct: false, points: 0.5, max_points: 1, candidate_feedback: 'Partially correct.', recruiter_feedback: `Ideal: ${k.ideal_answer}` };
  });
  const earned = results.reduce((s, r) => s + r.points, 0);
  return {
    assessment_id: body.assessment_id, points_earned: earned, points_possible: results.length,
    score: Math.round((earned / results.length) * 10000) / 100, results,
    short_answer_graded: true, grading_model: 'fake-grader', grading_prompt_version: 'fake-g1',
  };
};

const asmHandler = (req, res, rec) => {
  if (rec.path === '/generate-assessment') {
    if (genMode === 'ok') return json(res, 200, makeBundle(rec.body));
    return json(res, genMode.status, genMode.body);
  }
  if (rec.path === '/evaluate-assessment') {
    if (evalMode === 'hold') { heldEvals.push({ res, body: rec.body }); return undefined; }
    if (evalMode === 'ok') return json(res, 200, fakeEvaluate(rec.body));
    return json(res, evalMode.status, evalMode.body);
  }
  return json(res, 404, { detail: 'not found' });
};
const releaseEvals = () => { while (heldEvals.length) { const h = heldEvals.shift(); json(h.res, 200, fakeEvaluate(h.body)); } };

let supa; let nlp; let gh; let asm; let envDir; let svc; let claimMod; let server; let base;
let clock = Date.parse('2026-11-14T12:00:00Z');

before(async () => {
  supa = await startStub({ handler: db.handler });
  nlp = await startStub({ handler: nlpHandler });
  gh = await startStub({ handler: (_req, res) => json(res, 200, GH_FIXTURE) });
  asm = await startStub({ handler: asmHandler });

  envDir = mkdtempSync(join(tmpdir(), 'patina-r12-'));
  const envFile = join(envDir, 'backend.env');
  writeFileSync(envFile, [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${fakeServiceKey()}`,
    'SUPABASE_ANON_KEY=stub-anon-key',
    'SESSION_SECRET=r12-offline-test-secret-r12-offline',
    'SUPABASE_TIMEOUT_MS=3000',
  ].join('\n'));
  process.env.BACKEND_ENV_FILE = envFile;
  delete process.env.CREDIBILITY_WEIGHTS;

  const errors = await import(backendUrl('Middlewares', 'errorHandler.js'));
  const requestId = await import(backendUrl('Middlewares', 'requestId.js'));
  const assessmentRoutes = (await import(backendUrl('Routes', 'assessment.routes.js'))).default;
  svc = await import(backendUrl('Services', 'assessmentService.js'));
  claimMod = await import(backendUrl('Services', 'gradingClaim.js'));
  assert.equal(process.env.SUPABASE_URL, supa.url, 'Supabase client is not pointed at the local stub');

  const app = express();
  app.use(requestId.requestIdMiddleware);
  app.use(errors.errorContract);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: req.get('X-Test-User'), role: req.get('X-Test-Role') || 'CANDIDATE' };
    next();
  });
  app.use('/api/assessment', assessmentRoutes);
  app.use(errors.notFoundHandler);
  app.use(errors.errorHandler);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  releaseEvals();
  svc?.resetPreparation();
  claimMod?.resetGradingRuns();
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  await Promise.all([supa?.close(), nlp?.close(), gh?.close(), asm?.close()]);
  if (envDir) rmSync(envDir, { recursive: true, force: true });
});

beforeEach(() => {
  genMode = 'ok';
  evalMode = 'ok';
  db.fail.clear();
  process.env.NLP_PARSE_URL = `${nlp.url}/parse`;
  process.env.GITHUB_EVIDENCE_URL = gh.url;
  process.env.ASSESSMENT_SERVICE_URL = asm.url;
  delete process.env.ASSESSMENT_PREPARE_RETRIES;
  delete process.env.ASSESSMENT_MAX_ATTEMPTS;
  delete process.env.ASSESSMENT_TIME_LIMIT_MINUTES;
  process.env.ASSESSMENT_PREPARE_ON_APPLY = 'false';
  clock += 60 * MIN; // every test starts on a fresh hour; no gate carries over
  svc.configurePreparation({ sleep: async () => {}, now: () => clock });
});

// ---- helpers ----
const seedJob = (recruiterId = RECRUITER) => {
  const job = {
    id: randomUUID(), recruiter_id: recruiterId, title: '[R-12 TEST] Backend engineer',
    description: 'Backend engineer: Python, SQL, PostgreSQL, Docker, REST APIs.',
    required_skills: ['python', 'sql'], preferred_skills: [], experience_level: 'mid', status: 'published', created_at: db.stamp(),
  };
  db.tables.jobs.push(job);
  return job;
};
const readyCandidate = (job = seedJob()) => {
  const c = newCandidate();
  db.store.set(`candidates/${c}/resume.pdf`, { bytes: F1, contentType: 'application/pdf', updated_at: db.stamp() });
  db.tables.applications.push({ id: randomUUID(), candidate_id: c, job_id: job.id, status: 'submitted', created_at: db.stamp() });
  return { c, job };
};
/** A prepared, unstarted pool as preparation stores it. */
const seedPool = (c, jobId, extra = {}) => {
  const b = makeBundle({ candidate_id: c, job_id: jobId });
  const row = {
    id: b.questions.assessment_id, candidate_id: c, job_id: jobId, questions: [], status: 'generated',
    answers: null, score: null, evaluation: null, model_used: 'fake-model', prompt_version: 'fake-v1', created_at: db.stamp(), ...extra,
  };
  db.tables.assessments.push(row);
  db.tables.assessment_keys.push({ assessment_id: row.id, answer_key: { ...b.answer_key, pool_questions: b.questions }, created_at: db.stamp() });
  return row;
};

const call = async (method, path, { user, role = 'CANDIDATE', body } = {}) => {
  const headers = { 'X-Test-User': user || '', 'X-Test-Role': role };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const started = Date.now();
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not JSON */ }
  return { res, text, body: parsed, ms: Date.now() - started };
};
const status = (c, jobId) => call('GET', `/api/assessment/status?jobId=${jobId}`, { user: c });
const start = (c, jobId, route = 'start') => call('POST', `/api/assessment/${route}`, { user: c, body: { jobId } });
const save = (c, id, answers) => call('PUT', `/api/assessment/${id}/answers`, { user: c, body: { answers } });
const evaluate = (c, assessmentId, answers) => call('POST', '/api/assessment/evaluate', { user: c, body: answers === undefined ? { assessmentId } : { assessmentId, answers } });
const reset = (user, role, id, body) => call('POST', `/api/assessment/${id}/reset`, { user, role, body });
const attempts = (user, role, jobId, c) => call('GET', `/api/assessment/attempts?jobId=${jobId}&candidateId=${c}`, { user, role });

const rowOf = (id) => db.tables.assessments.find((a) => a.id === id);
const scoresFor = (c, jobId) => db.tables.scores.filter((s) => s.candidate_id === c && s.job_id === jobId);
const evalCalls = () => asm.requests.filter((r) => r.path === '/evaluate-assessment');
const genCalls = () => asm.requests.filter((r) => r.path === '/generate-assessment').length;
const waitFor = async (cond, what, ms = 5000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail(`timed out waiting for ${what}`);
};
const settled = (c, jobId) => waitFor(() => !svc.preparationState(c, jobId).inFlight, 'preparation to settle');
const gradingIdle = (id) => waitFor(() => !claimMod.gradingRunState(id, clock).inFlight, 'grading run to settle');

/** A started attempt for a fresh candidate: returns { c, job, id, startBody }. */
const startedAttempt = async (job) => {
  const { c, job: j } = readyCandidate(job);
  seedPool(c, j.id);
  const s = await start(c, j.id);
  assert.equal(s.res.status, 200, s.text);
  return { c, job: j, id: s.body.assessmentId, startBody: s.body };
};
const assertTiming = (body, startedAt, what) => {
  assert.equal(body.started_at, startedAt, `${what}: started_at`);
  assert.equal(body.expires_at, new Date(Date.parse(startedAt) + 15 * MIN).toISOString(), `${what}: expires_at`);
  assert.equal(body.server_time, new Date(clock).toISOString(), `${what}: server_time`);
};

// ---- time limit and saved answers ----
test('save before the deadline -> 200 (started_at untouched, merged by question); after the deadline -> 409 time_expired; every response carries expires_at and server_time', async () => {
  const { c, job, id, startBody } = await startedAttempt();
  const startedAt = startBody.started_at;
  assert.equal(startedAt, new Date(clock).toISOString(), 'Start uses core\'s clock');
  assertTiming(startBody, startedAt, 'start');
  assert.deepEqual(startBody.saved_answers, []);

  clock += 5 * MIN;
  const s1 = await save(c, id, [{ question_id: 'q1', response: 'C' }, { question_id: 'q7', response: 'first draft' }]);
  assert.equal(s1.res.status, 200, s1.text);
  assert.equal(s1.body.saved, 2);
  assertTiming(s1.body, startedAt, 'save');
  clock += 9 * MIN; // 14 min in
  const s2 = await save(c, id, [{ question_id: 'q7', response: 'second draft' }, { question_id: 'q1', response: '' }, { question_id: 'q2', response: 'B' }]);
  assert.equal(s2.res.status, 200, s2.text);
  const row = rowOf(id);
  assert.equal(row.answers.started_at, startedAt, 'a save never touches started_at');
  assert.deepEqual(row.answers.responses, [{ question_id: 'q7', response: 'second draft' }, { question_id: 'q2', response: 'B' }], 'merged; an empty response clears');
  assert.equal(row.answers.submitted_at, undefined);

  // Status and a reload (start again) restore the saved answers and the same clock.
  const st = await status(c, job.id);
  assert.equal(st.body.state, 'in_progress');
  assertTiming(st.body, startedAt, 'status');
  const again = await start(c, job.id);
  assert.equal(again.res.status, 200);
  assertTiming(again.body, startedAt, 'reload');
  assert.deepEqual(again.body.saved_answers, row.answers.responses);

  // Validation: unknown question, oversize response, wrong shape.
  const unknown = await save(c, id, [{ question_id: 'q99', response: 'x' }]);
  assert.equal(unknown.res.status, 400);
  assert.equal(unknown.body.error, 'unknown_question');
  const long = await save(c, id, [{ question_id: 'q7', response: 'x'.repeat(10001) }]);
  assert.equal(long.res.status, 400);
  assert.equal(long.body.error, 'invalid_answers');
  assert.equal((await save(c, id, 'nope')).res.status, 400);
  assert.equal((await call('PUT', `/api/assessment/${id}/answers`, { user: c, body: { answers: [{ question_id: 'q7', response: 'y'.repeat(120_000) }] } })).res.status, 413, 'payload capped');

  // One second past the deadline: refused, nothing changes.
  clock = Date.parse(startedAt) + 15 * MIN + 1000;
  const late = await save(c, id, [{ question_id: 'q3', response: 'A' }]);
  assert.equal(late.res.status, 409, late.text);
  assert.equal(late.body.error, 'time_expired');
  assertTiming(late.body, startedAt, 'late save');
  assert.deepEqual(rowOf(id).answers.responses, [{ question_id: 'q7', response: 'second draft' }, { question_id: 'q2', response: 'B' }]);
});

test('a pool prepared an hour before it is started still gets the full 15 minutes from started_at', async () => {
  const { c, job } = readyCandidate();
  const preparedAt = new Date(clock - 60 * MIN).toISOString();
  const pool = seedPool(c, job.id, { created_at: preparedAt });
  const st0 = await status(c, job.id);
  assert.equal(st0.body.state, 'ready');
  assert.ok(!st0.body.expires_at, 'an unstarted pool has no deadline');
  const s = await start(c, job.id);
  assert.equal(s.res.status, 200, s.text);
  assert.equal(s.body.expires_at, new Date(clock + 15 * MIN).toISOString(), 'deadline from started_at, not created_at');
  clock += 14 * MIN + 59_000;
  assert.equal((await save(c, pool.id, [{ question_id: 'q1', response: 'C' }])).res.status, 200, 'still open at 14:59');
  const r = await evaluate(c, pool.id, [{ question_id: 'q2', response: 'C' }]);
  assert.equal(r.res.status, 200, r.text);
  assert.equal(r.body.late_submission, false);
  assert.ok(!r.body.answers_ignored);
  assert.deepEqual(evalCalls().at(-1).body.answers, [{ question_id: 'q1', response: 'C' }, { question_id: 'q2', response: 'C' }], 'the in-time body is merged over the saved answers');
});

test('ASSESSMENT_TIME_LIMIT_MINUTES sets the deadline; a submit inside the 30 s grace keeps its body', async () => {
  process.env.ASSESSMENT_TIME_LIMIT_MINUTES = '5';
  const { c, id, startBody } = await startedAttempt();
  assert.equal(startBody.expires_at, new Date(Date.parse(startBody.started_at) + 5 * MIN).toISOString());
  clock = Date.parse(startBody.started_at) + 5 * MIN + 20_000;
  const r = await evaluate(c, id, [{ question_id: 'q1', response: 'C' }]);
  assert.equal(r.res.status, 200, r.text);
  assert.ok(!r.body.answers_ignored, 'within the grace the body counts');
  assert.deepEqual(evalCalls().at(-1).body.answers, [{ question_id: 'q1', response: 'C' }]);
});

test('submit after deadline + 30 s grades the SAVED answers and ignores the late body', async () => {
  const { c, job, id, startBody } = await startedAttempt();
  clock += 3 * MIN;
  assert.equal((await save(c, id, [{ question_id: 'q1', response: 'C' }, { question_id: 'q2', response: 'A' }])).res.status, 200);
  clock = Date.parse(startBody.started_at) + 15 * MIN + 31_000;
  const before = evalCalls().length;
  const r = await evaluate(c, id, [{ question_id: 'q1', response: 'A' }, { question_id: 'q3', response: 'C' }, { question_id: 'q4', response: 'C' }]);
  assert.equal(r.res.status, 200, r.text);
  assert.equal(r.body.answers_ignored, true);
  assert.equal(r.body.late_submission, true);
  assert.equal(evalCalls().length, before + 1);
  assert.deepEqual(evalCalls().at(-1).body.answers, [{ question_id: 'q1', response: 'C' }, { question_id: 'q2', response: 'A' }], 'only the saved answers were graded');
  const row = rowOf(id);
  assert.equal(row.status, 'completed');
  assert.deepEqual(row.answers.responses, [{ question_id: 'q1', response: 'C' }, { question_id: 'q2', response: 'A' }]);
  assert.equal(row.answers.late_submission, true);
  assert.equal(r.body.score, 10, 'q1 right (1 of 10)');
  assert.equal(scoresFor(c, job.id).length, 1);
});

test('expired open attempt is finalised on the candidate\'s read: the read answers at once (grading held), then grades the saved answers in the background', async () => {
  const { c, job, id, startBody } = await startedAttempt();
  clock += 2 * MIN;
  await save(c, id, [{ question_id: 'q1', response: 'C' }]);
  clock = Date.parse(startBody.started_at) + 16 * MIN;
  evalMode = 'hold';
  const before = evalCalls().length;
  const r = await status(c, job.id);
  assert.equal(r.res.status, 200, r.text);
  assert.equal(r.body.state, 'grading_pending');
  assertTiming(r.body, startBody.started_at, 'expired status');
  assert.ok(r.ms < 2000, `the read took ${r.ms} ms`);
  await waitFor(() => heldEvals.length === 1, 'the background grading call');
  assert.ok(rowOf(id).answers.submitted_at, 'the submission was fixed by the read');
  assert.equal(rowOf(id).answers.auto_submitted, 'expired');
  // A save or a start while it grades: refused, never re-opened.
  assert.equal((await save(c, id, [{ question_id: 'q2', response: 'C' }])).res.status, 409);
  const st = await start(c, job.id);
  assert.equal(st.res.status, 409);
  assert.equal(st.body.state, 'grading_pending');
  releaseEvals();
  await gradingIdle(id);
  assert.equal(evalCalls().length, before + 1, 'one grading call');
  assert.deepEqual(evalCalls().at(-1).body.answers, [{ question_id: 'q1', response: 'C' }]);
  assert.equal(rowOf(id).status, 'completed');
  assert.equal(scoresFor(c, job.id).length, 1, 'graded and scored');
  assert.equal((await status(c, job.id)).body.state, 'completed');
});

test('expired open attempt is finalised on the job recruiter\'s read; nothing saved -> 0 without an LLM call', async () => {
  const { c, job, id, startBody } = await startedAttempt();
  clock = Date.parse(startBody.started_at) + 20 * MIN;
  const before = evalCalls().length;
  const r = await attempts(RECRUITER, 'RECRUITER', job.id, c);
  assert.equal(r.res.status, 200, r.text);
  assert.equal(r.body.items.length, 1);
  assert.equal(r.body.items[0].state, 'grading_pending');
  assert.ok(r.body.server_time);
  await gradingIdle(id);
  const row = rowOf(id);
  assert.equal(row.status, 'completed');
  assert.equal(Number(row.score), 0);
  assert.equal(row.evaluation.no_answers, true);
  assert.equal(row.evaluation.grading_model, null, 'no grader is claimed');
  assert.equal(evalCalls().length, before, 'no LLM call for an empty submission');
  const again = await attempts(RECRUITER, 'RECRUITER', job.id, c);
  assert.equal(again.body.items[0].state, 'completed');
  assert.equal(again.body.items[0].auto_submitted, 'expired');
  // Another recruiter cannot read it.
  assert.equal((await attempts(OTHER_RECRUITER, 'RECRUITER', job.id, c)).res.status, 403);
  assert.equal((await attempts(c, 'CANDIDATE', job.id, c)).res.status, 403);
});

// ---- grading outage ----
test('grader failure -> 503 grading_unavailable, status not completed, no scores row added, answers kept; retry (no body) succeeds', async () => {
  const { c, job, id, startBody } = await startedAttempt();
  evalMode = { status: 502, body: { error: 'grading_unavailable', message: SERVICE_LEAK } };
  const answers = [{ question_id: 'q1', response: 'C' }, { question_id: 'q7', response: 'an answer' }];
  const r = await evaluate(c, id, answers);
  assert.equal(r.res.status, 503, r.text);
  assert.equal(r.body.error, 'grading_unavailable');
  assert.equal(r.body.state, 'grading_pending');
  assertTiming(r.body, startBody.started_at, '503');
  assert.ok(!r.text.includes('LEAKY'));
  const row = rowOf(id);
  assert.notEqual(row.status, 'completed');
  assert.equal(row.status, 'generated', 'the claim was released');
  assert.equal(row.grading_started_at, null);
  assert.deepEqual(row.answers.responses, answers, 'answers kept');
  assert.ok(row.answers.submitted_at);
  assert.equal(scoresFor(c, job.id).length, 0, 'no scores row');
  // Unreachable service too: same answer.
  evalMode = { status: 503, body: { error: 'llm_unavailable', message: SERVICE_LEAK } };
  const r2 = await evaluate(c, id);
  assert.equal(r2.res.status, 503);
  assert.equal(r2.body.error, 'grading_unavailable');
  const st = await status(c, job.id);
  assert.equal(st.body.state, 'grading_pending');
  assert.equal((await save(c, id, [{ question_id: 'q2', response: 'C' }])).res.status, 409, 'a submitted attempt takes no more saves');

  evalMode = 'ok';
  const calls = evalCalls().length;
  const retry = await evaluate(c, id, [{ question_id: 'q1', response: 'A' }]);
  assert.equal(retry.res.status, 200, retry.text);
  assert.equal(retry.body.answers_ignored, true, 'a retry grades the fixed submission');
  assert.deepEqual(evalCalls().at(-1).body.answers, answers);
  assert.equal(evalCalls().length, calls + 1);
  assert.equal(rowOf(id).status, 'completed');
  assert.equal(scoresFor(c, job.id).length, 1);
});

test('a pending submission is re-graded in the background by a read only after the 60 s gate', async () => {
  const { c, job, id } = await startedAttempt();
  evalMode = { status: 502, body: { error: 'grading_unavailable', message: SERVICE_LEAK } };
  assert.equal((await evaluate(c, id, [{ question_id: 'q1', response: 'C' }])).res.status, 503);
  evalMode = 'ok';
  const calls = evalCalls().length;
  assert.equal((await status(c, job.id)).body.state, 'grading_pending');
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(evalCalls().length, calls, 'no retry within 60 s of the failure');
  clock += 61_000;
  assert.equal((await status(c, job.id)).body.state, 'grading_pending');
  await gradingIdle(id);
  assert.equal(evalCalls().length, calls + 1, 'one background retry');
  assert.equal(rowOf(id).status, 'completed');
  assert.equal((await status(c, job.id)).body.state, 'completed');
});

// ---- reset (Y5) ----
test('reset: candidate 403, another recruiter 403, missing or blank reason 400, bad id 400, unknown 404', async () => {
  const { c, id } = await startedAttempt();
  assert.equal((await reset(c, 'CANDIDATE', id, { reason: 'mine' })).res.status, 403);
  const other = await reset(OTHER_RECRUITER, 'RECRUITER', id, { reason: 'not my job' });
  assert.equal(other.res.status, 403, other.text);
  for (const body of [{}, { reason: '' }, { reason: '   ' }, { reason: 7 }, { reason: 'x'.repeat(501) }]) {
    const r = await reset(RECRUITER, 'RECRUITER', id, body);
    assert.equal(r.res.status, 400, JSON.stringify(body));
    assert.equal(r.body.error, 'invalid_reason');
  }
  assert.equal((await reset(RECRUITER, 'RECRUITER', 'nope', { reason: 'x' })).res.status, 400);
  assert.equal((await reset(RECRUITER, 'RECRUITER', randomUUID(), { reason: 'x' })).res.status, 404);
  assert.equal(rowOf(id).evaluation, null, 'nothing was voided');
});

test('reset by the owning recruiter (completed attempt): 200; the row is kept with its void record; a new score row has no assessment sub-score from it; the candidate is notified and can generate again; a second reset -> 409', async () => {
  const { c, job, id } = await startedAttempt();
  const graded = await evaluate(c, id, [{ question_id: 'q1', response: 'C' }]);
  assert.equal(graded.res.status, 200, graded.text);
  const scored = scoresFor(c, job.id);
  assert.equal(scored.length, 1);
  assert.equal(scored[0].subscores[A].available, true);
  assert.equal((await start(c, job.id)).res.status, 409, 'one attempt used');

  const r = await reset(RECRUITER, 'RECRUITER', id, { reason: '  Lost connection during the test  ' });
  assert.equal(r.res.status, 200, r.text);
  assert.equal(r.body.state, 'voided');
  assert.deepEqual(r.body.scoring, { status: 'scored', reason: null });
  assert.equal(r.body.notified, true);
  const v = r.body.voided;
  assert.deepEqual(Object.keys(v).sort(), ['at', 'by', 'prior_state', 'reason', 'role']);
  assert.equal(v.by, RECRUITER);
  assert.equal(v.role, 'recruiter');
  assert.equal(v.reason, 'Lost connection during the test');
  assert.equal(v.prior_state, 'completed');
  assert.equal(v.at, new Date(clock).toISOString());

  const row = rowOf(id);
  assert.ok(row, 'the voided attempt still exists');
  assert.equal(row.status, 'completed');
  assert.deepEqual(row.evaluation.voided, v);
  assert.equal(Number(row.score), Number(graded.body.score), 'its result is kept, only voided');
  assert.ok(Array.isArray(row.evaluation.results) && row.evaluation.results.length === 10);

  const rows = scoresFor(c, job.id);
  assert.equal(rows.length, 2, 'a new score row');
  assert.deepEqual(rows[0], scored[0], 'the old row is unchanged');
  assert.equal(rows[1].subscores[A].available, false, 'the newest row has no assessment sub-score');
  assert.equal(rows[1].weights[A], 0, 'the voided result carries no weight');

  const note = db.tables.notifications.filter((n) => n.user_id === c);
  assert.equal(note.length, 1);
  assert.equal(note[0].type, 'assessment_reset');
  assert.equal(note[0].data.assessmentId, id);

  // Recruiter-facing read exposes the void record.
  const list = await attempts(RECRUITER, 'RECRUITER', job.id, c);
  assert.equal(list.res.status, 200, list.text);
  const item = list.body.items.find((i) => i.assessmentId === id);
  assert.equal(item.state, 'voided');
  assert.deepEqual(item.voided, v);
  assert.equal(item.score_of_record, false);
  assert.deepEqual(list.body.attempts, { used: 0, max: 1 });

  // The reset started preparation of a new pool; the candidate can generate again.
  await settled(c, job.id);
  const st = await status(c, job.id);
  assert.equal(st.body.state, 'ready', st.text);
  const again = await start(c, job.id, 'generate');
  assert.equal(again.res.status, 200, again.text);
  assert.notEqual(again.body.assessmentId, id);

  const second = await reset(RECRUITER, 'RECRUITER', id, { reason: 'again' });
  assert.equal(second.res.status, 409);
  assert.equal(second.body.error, 'already_voided');
  assert.deepEqual(rowOf(id).evaluation.voided, v, 'the first record stands');
});

test('reset by an admin on an OPEN attempt: 200, answers kept, the open slot is freed; a pending evaluate of the voided attempt is refused', async () => {
  const { c, job, id } = await startedAttempt();
  await save(c, id, [{ question_id: 'q1', response: 'C' }]);
  const r = await reset(ADMIN, 'ADMIN', id, { reason: 'Proctor saw a power cut' });
  assert.equal(r.res.status, 200, r.text);
  assert.equal(r.body.voided.role, 'admin');
  assert.equal(r.body.voided.by, ADMIN);
  assert.equal(r.body.voided.prior_state, 'in_progress');
  const row = rowOf(id);
  assert.equal(row.status, 'completed');
  assert.ok(row.completed_at);
  assert.deepEqual(row.answers.responses, [{ question_id: 'q1', response: 'C' }], 'answers kept');
  assert.equal(row.score, null);
  const ev = await evaluate(c, id);
  assert.equal(ev.res.status, 409);
  assert.equal(ev.body.error, 'attempt_voided');
  assert.equal((await save(c, id, [{ question_id: 'q2', response: 'C' }])).body.error, 'attempt_voided');
  await settled(c, job.id);
  assert.equal((await status(c, job.id)).body.state, 'ready');
  assert.equal((await attempts(ADMIN, 'ADMIN', job.id, c)).res.status, 200, 'admin may read any job');
});

// ---- D1-D4 (R-11 verifier) ----
test('D1: after a failed preparation Start answers unavailable and re-triggers only after 60 s (one run per 60 s whatever the clicks)', async () => {
  const { c, job } = readyCandidate();
  genMode = { status: 502, body: { error: 'llm_unavailable', message: SERVICE_LEAK } };
  process.env.ASSESSMENT_PREPARE_RETRIES = '0';
  const calls = genCalls();
  const first = await start(c, job.id);
  assert.equal(first.res.status, 202);
  await settled(c, job.id);
  assert.equal(genCalls(), calls + 1);
  for (let i = 0; i < 4; i += 1) {
    const r = await start(c, job.id, i % 2 ? 'generate' : 'start');
    assert.equal(r.res.status, 503, r.text);
    assert.equal(r.body.state, 'unavailable');
    assert.equal(r.body.reason, 'llm_unavailable');
    assert.ok(r.body.retry_after_seconds > 0 && r.body.retry_after_seconds <= 60);
    assert.ok(!r.text.includes('LEAKY'));
    assert.ok(r.ms < 2000);
  }
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(genCalls(), calls + 1, 'no click within 60 s started a run');
  assert.equal((await status(c, job.id)).body.state, 'unavailable', 'status agrees');
  clock += 61_000;
  genMode = 'ok';
  const later = await start(c, job.id);
  assert.equal(later.res.status, 202, later.text);
  await settled(c, job.id);
  assert.equal(genCalls(), calls + 2, 'exactly one new run after the gate');
  assert.equal((await start(c, job.id)).res.status, 200);
});

test('D2: a failed key insert leaves the row in place, closed as voided (pool_missing, by system); a new pool can be prepared', async () => {
  const { c, job } = readyCandidate();
  db.fail.add('assessment_keys:POST');
  const out = await svc.prepareAssessment(c, job.id);
  assert.deepEqual(out, { status: 'failed', reason: 'database_error' });
  db.fail.delete('assessment_keys:POST');
  const rows = db.tables.assessments.filter((a) => a.candidate_id === c && a.job_id === job.id);
  assert.equal(rows.length, 1, 'the keyless row is kept, not deleted');
  assert.equal(rows[0].status, 'completed');
  assert.equal(rows[0].evaluation.voided.reason, 'pool_missing');
  assert.equal(rows[0].evaluation.voided.by, 'system');
  assert.equal(rows[0].answers, null);
  const st = await status(c, job.id);
  assert.equal(st.body.state, 'unavailable', 'within the 60 s gate');
  assert.equal(st.body.reason, 'database_error');
  clock += 61_000;
  assert.equal((await status(c, job.id)).body.state, 'preparing');
  await settled(c, job.id);
  const st2 = await status(c, job.id);
  assert.equal(st2.body.state, 'ready', st2.text);
  assert.deepEqual(st2.body.attempts, { used: 0, max: 1 });
});

test('D3: the preparation and grading registries evict finished entries (a failure is kept only for the 60 s gate)', async () => {
  svc.resetPreparation();
  svc.configurePreparation({ sleep: async () => {}, now: () => clock });
  claimMod.resetGradingRuns();
  const ok = readyCandidate();
  assert.equal((await svc.prepareAssessment(ok.c, ok.job.id)).status, 'ready');
  assert.equal(svc.preparationRegistrySize(), 0, 'a successful run leaves no entry');
  const skipped = readyCandidate();
  db.tables.applications = db.tables.applications.filter((a) => a.candidate_id !== skipped.c);
  assert.equal((await svc.prepareAssessment(skipped.c, skipped.job.id)).status, 'skipped');
  assert.equal(svc.preparationRegistrySize(), 0, 'a skipped run leaves no entry');
  genMode = { status: 503, body: { error: 'llm_not_configured', message: SERVICE_LEAK } };
  const bad = readyCandidate();
  assert.equal((await svc.prepareAssessment(bad.c, bad.job.id)).status, 'failed');
  assert.equal(svc.preparationRegistrySize(), 1, 'the failure is kept for the gate');
  clock += 61_000;
  assert.equal(svc.preparationRegistrySize(), 0, 'and evicted after it');

  genMode = 'ok';
  const g = await startedAttempt();
  assert.equal((await evaluate(g.c, g.id, [{ question_id: 'q1', response: 'C' }])).res.status, 200);
  assert.equal(claimMod.gradingRunsSize(clock), 0, 'a graded run leaves no entry');
  const f = await startedAttempt();
  evalMode = { status: 502, body: { error: 'grading_unavailable', message: SERVICE_LEAK } };
  assert.equal((await evaluate(f.c, f.id, [{ question_id: 'q1', response: 'C' }])).res.status, 503);
  assert.equal(claimMod.gradingRunsSize(clock), 1);
  clock += 61_000;
  assert.equal(claimMod.gradingRunsSize(clock), 0);
});

test('D4: one candidate cannot start, save to or evaluate another candidate\'s attempt', async () => {
  const job = seedJob();
  const a = await startedAttempt(job);
  await save(a.c, a.id, [{ question_id: 'q1', response: 'C' }]);
  const snapshot = JSON.stringify(rowOf(a.id));
  const b = readyCandidate(job); // B applied to the same job
  const outsider = newCandidate(); // never applied

  const sv = await save(b.c, a.id, [{ question_id: 'q1', response: 'A' }]);
  assert.equal(sv.res.status, 404, sv.text);
  const ev = await evaluate(b.c, a.id, [{ question_id: 'q1', response: 'A' }]);
  assert.equal(ev.res.status, 404, ev.text);
  const evNoBody = await evaluate(outsider, a.id);
  assert.equal(evNoBody.res.status, 404);
  // Start takes a job, never an attempt: B gets their own (preparing), never A's questions.
  const st = await start(b.c, job.id);
  assert.equal(st.res.status, 202, st.text);
  assert.ok(!('questions' in st.body));
  assert.notEqual(st.body.assessmentId, a.id);
  assert.equal((await start(outsider, job.id)).res.status, 403);
  // The status of B never shows A's attempt.
  const sb = await status(b.c, job.id);
  assert.notEqual(sb.body.assessmentId, a.id);
  assert.equal(JSON.stringify(rowOf(a.id)), snapshot, 'A\'s attempt is unchanged');
  assert.ok(!evalCalls().some((q) => q.body.assessment_id === a.id), 'nothing graded');
  await settled(b.c, job.id);
});
