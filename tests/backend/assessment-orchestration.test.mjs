// R-11 (offline): assessment orchestration I. Inputs, eligibility, attempt policy,
// no answer reveal, background preparation (REBUILD/DECISIONS.md §6.1, §6.2, §0 A1).
//
// Nothing leaves loopback, no LLM is called and no model is loaded. Core's real
// routers run in process against local stubs: Supabase (lib/supabase-stub.mjs),
// nlp-engine (replays the R-05 f1 snapshot), github-evidence (synthetic fixture) and a
// FAKE assessment-service whose generate call can be held open, released, or made
// to fail with the service's real error codes. Backoff sleeps and the clock are
// injected (configurePreparation), so no test waits on a timer.
//
//   node --test tests/backend/assessment-orchestration.test.mjs
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
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

const P = 'parsing_semantic_alignment';
const G = 'github_evidence';
const A = 'assessment_results';
const RECRUITER = '22222222-2222-4222-8222-0000000000aa';
let seq = 0;
const newCandidate = () => `11111111-1111-4111-8111-${String(500 + ++seq).padStart(12, '0')}`;

const db = createSupabaseStub();

// ---- nlp-engine stub: the f1 snapshot for the f1 bytes ----
const nlpHandler = (req, res, rec) => {
  const hasJd = rec.rawBody.includes(Buffer.from('name="jd"'));
  if (!rec.rawBody.includes(F1)) return json(res, 422, { error: 'unreadable_document', reason: 'corrupt' });
  return json(res, 200, { ...SNAP_F1, semantic_analysis: hasJd ? SNAP_F1.semantic_analysis : null });
};

// ---- the fake assessment-service ----
const SERVICE_LEAK = 'LEAKY-UPSTREAM gemini-3.5-flash 503 quota for key AIza';
let genMode = 'ok';   // 'ok' | 'hold' | { status, body }
let evalMode = 'ok';  // 'ok' | { status, body }
const held = [];

const makeBundle = (input) => {
  const id = randomUUID();
  const skills = input?.required_skills?.length ? input.required_skills : ['python'];
  const questions = [];
  const answers = [];
  for (let i = 1; i <= 10; i += 1) {
    const qid = `q${i}`;
    const skill = skills[i % skills.length];
    if (i <= 6) {
      questions.push({
        question_id: qid, question_type: 'mcq', question: `R-11 fake MCQ ${i}?`, skill, source: 'jd',
        options: ['A', 'B', 'C', 'D'].map((label) => ({ label, text: `Option ${label} of ${qid}` })),
      });
      answers.push({ question_id: qid, correct_option: 'C', explanation: `R11-KEY-EXPLANATION-${id}-${qid}` });
    } else {
      questions.push({ question_id: qid, question_type: 'short_answer', question: `R-11 fake short ${i}?`, skill, source: 'resume' });
      answers.push({
        question_id: qid,
        ideal_answer: `R11-IDEAL-ANSWER-${id}-${qid}`,
        key_points: [`R11-KEYPOINT-${id}-${qid}-a`, `R11-KEYPOINT-${id}-${qid}-b`],
      });
    }
  }
  return {
    questions: { assessment_id: id, candidate_id: input?.candidate_id, job_id: input?.job_id, model_used: 'fake-model', prompt_version: 'fake-v1', questions },
    answer_key: { assessment_id: id, answers },
  };
};

// Mirrors assessment-service's evaluator contract (R-08): candidate_feedback is safe,
// recruiter_feedback names the correct option / ideal answer.
const fakeEvaluate = (body) => {
  const keyById = new Map(body.answer_key.map((k) => [k.question_id, k]));
  const given = new Map(body.answers.map((a) => [a.question_id, a.response]));
  const results = body.questions.map((q) => {
    const k = keyById.get(q.question_id);
    const r = given.get(q.question_id);
    if (q.question_type === 'mcq') {
      const correct = r === k.correct_option;
      return {
        question_id: q.question_id, question_type: 'mcq', skill: q.skill, correct, points: correct ? 1 : 0, max_points: 1,
        candidate_feedback: correct ? 'Correct.' : 'Incorrect.',
        recruiter_feedback: `Correct answer: ${k.correct_option}. Candidate chose: ${r}. ${k.explanation}`,
      };
    }
    return {
      question_id: q.question_id, question_type: 'short_answer', skill: q.skill, correct: false, points: r ? 0.5 : 0, max_points: 1,
      candidate_feedback: r ? 'Partially correct.' : 'Not answered.',
      recruiter_feedback: `0.5/1. Missing ${k.key_points[1]}. Ideal: ${k.ideal_answer}`,
    };
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
    if (genMode === 'hold') { held.push({ res, body: rec.body }); return undefined; }
    if (genMode === 'ok') return json(res, 200, makeBundle(rec.body));
    return json(res, genMode.status, genMode.body);
  }
  if (rec.path === '/evaluate-assessment') {
    if (evalMode === 'ok') return json(res, 200, fakeEvaluate(rec.body));
    return json(res, evalMode.status, evalMode.body);
  }
  return json(res, 404, { detail: 'not found' });
};

const release = (mode = 'ok') => {
  while (held.length) {
    const h = held.shift();
    if (mode === 'ok') json(h.res, 200, makeBundle(h.body));
    else json(h.res, mode.status, mode.body);
  }
};

let supa;
let nlp;
let gh;
let asm;
let envDir;
let svc;
let scoring;
let server;
let base;
let nlpUrl;
let fakeNow = Date.parse('2026-11-14T12:00:00Z');

const closedPortUrl = async (suffix = '') => {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return `http://127.0.0.1:${port}${suffix}`;
};

before(async () => {
  supa = await startStub({ handler: db.handler });
  nlp = await startStub({ handler: nlpHandler });
  gh = await startStub({ handler: (_req, res) => json(res, 200, GH_FIXTURE) });
  asm = await startStub({ handler: asmHandler });
  nlpUrl = `${nlp.url}/parse`;

  envDir = mkdtempSync(join(tmpdir(), 'patina-r11-'));
  const envFile = join(envDir, 'backend.env');
  writeFileSync(envFile, [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${fakeServiceKey()}`,
    'SUPABASE_ANON_KEY=stub-anon-key',
    'SESSION_SECRET=r11-offline-test-secret-r11-offline',
    'SUPABASE_TIMEOUT_MS=3000',
  ].join('\n'));
  process.env.BACKEND_ENV_FILE = envFile;
  delete process.env.CREDIBILITY_WEIGHTS;

  const errors = await import(backendUrl('Middlewares', 'errorHandler.js'));
  const requestId = await import(backendUrl('Middlewares', 'requestId.js'));
  const jobsRoutes = (await import(backendUrl('Routes', 'jobs.routes.js'))).default;
  const assessmentRoutes = (await import(backendUrl('Routes', 'assessment.routes.js'))).default;
  svc = await import(backendUrl('Services', 'assessmentService.js'));
  scoring = await import(backendUrl('Services', 'scoringPipeline.js'));
  assert.equal(process.env.SUPABASE_URL, supa.url, 'Supabase client is not pointed at the local stub');

  const app = express();
  app.use(requestId.requestIdMiddleware);
  app.use(errors.errorContract);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: req.get('X-Test-User'), role: req.get('X-Test-Role') || 'CANDIDATE' };
    next();
  });
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/assessment', assessmentRoutes);
  app.use(errors.notFoundHandler);
  app.use(errors.errorHandler);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  release({ status: 502, body: { error: 'llm_unavailable', message: 'teardown' } });
  svc?.resetPreparation();
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
  process.env.NLP_PARSE_URL = nlpUrl;
  process.env.GITHUB_EVIDENCE_URL = gh.url;
  process.env.ASSESSMENT_SERVICE_URL = asm.url;
  delete process.env.ASSESSMENT_PREPARE_RETRIES;
  delete process.env.ASSESSMENT_MAX_ATTEMPTS;
  delete process.env.ASSESSMENT_PREPARE_ON_APPLY; // default true: the on-apply tests run with it on
  svc.configurePreparation({ sleep: async () => {}, now: () => fakeNow });
});

// ---- helpers ----
const seedJob = () => {
  const job = {
    id: randomUUID(), recruiter_id: RECRUITER, title: '[R-11 TEST] Backend engineer',
    description: 'Backend engineer: Python, SQL, PostgreSQL, Docker, REST APIs.',
    required_skills: ['python', 'sql', 'docker'], preferred_skills: ['react'],
    experience_level: 'mid', location: 'Remote', status: 'published', created_at: db.stamp(),
  };
  db.tables.jobs.push(job);
  return job;
};
const seedResumeFile = (c) => db.store.set(`candidates/${c}/resume.pdf`, { bytes: F1, contentType: 'application/pdf', updated_at: db.stamp() });
const seedApplication = (c, jobId) => db.tables.applications.push({ id: randomUUID(), candidate_id: c, job_id: jobId, status: 'submitted', created_at: db.stamp() });
// As preparation stores it: `questions` [] in the candidate-readable row, the pool in the key row.
// `key: 'none'` seeds no key row; `key: 'no_pool'` a key row without its pool (both broken).
const seedPool = (c, jobId, extra = {}, { key = 'pool', filled = false } = {}) => {
  const b = makeBundle({ candidate_id: c, job_id: jobId, required_skills: ['python'] });
  const row = {
    id: b.questions.assessment_id, candidate_id: c, job_id: jobId, questions: filled ? b.questions : [], status: 'generated',
    answers: null, score: null, evaluation: null, model_used: 'fake-model', prompt_version: 'fake-v1', created_at: db.stamp(), ...extra,
  };
  db.tables.assessments.push(row);
  if (key !== 'none') {
    const answerKey = key === 'pool' ? { ...b.answer_key, pool_questions: b.questions } : b.answer_key;
    db.tables.assessment_keys.push({ assessment_id: row.id, answer_key: answerKey, created_at: db.stamp() });
  }
  return row;
};
const seedCompleted = (c, jobId, { score = 70, completedAt, voided = null } = {}) => {
  const row = seedPool(c, jobId, {
    status: 'completed', score, completed_at: completedAt || db.stamp(),
    answers: { started_at: db.stamp(), responses: [] },
    evaluation: {
      score, points_earned: score / 10, points_possible: 10, short_answer_graded: true,
      results: [{ question_id: 'q1', question_type: 'mcq', skill: 'python', correct: true, points: 1, max_points: 1 }],
      ...(voided ? { voided } : {}),
    },
  }, { filled: true });
  return row;
};

const call = async (method, path, { user, body } = {}) => {
  const headers = { 'X-Test-User': user || '', 'X-Test-Role': 'CANDIDATE' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const started = Date.now();
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not JSON */ }
  return { res, text, body: parsed, ms: Date.now() - started };
};
const apply = (c, jobId) => call('POST', `/api/jobs/${jobId}/apply`, { user: c });
const status = (c, jobId) => call('GET', `/api/assessment/status?jobId=${jobId}`, { user: c });
const start = (c, jobId, route = 'start') => call('POST', `/api/assessment/${route}`, { user: c, body: { jobId } });
const evaluate = (c, assessmentId, answers) => call('POST', '/api/assessment/evaluate', { user: c, body: { assessmentId, answers } });

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
const poolOf = (c, jobId) => db.tables.assessments.find((a) => a.candidate_id === c && a.job_id === jobId && a.status === 'generated');
const scoresFor = (c, jobId) => db.tables.scores.filter((s) => s.candidate_id === c && s.job_id === jobId);

const KEY_FIELDS = ['answer_key', 'correct_option', 'ideal_answer', 'key_points', 'explanation', 'recruiter_feedback'];
const allKeys = (v, out = new Set()) => {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); allKeys(x, out); }
  return out;
};
const keyStrings = (assessmentId) => {
  const key = db.tables.assessment_keys.find((k) => k.assessment_id === assessmentId).answer_key;
  return key.answers.flatMap((a) => [a.explanation, a.ideal_answer, ...(a.key_points || [])].filter(Boolean));
};
const assertNoKey = (text, body, assessmentId) => {
  const keys = allKeys(body);
  assert.deepEqual(KEY_FIELDS.filter((f) => keys.has(f)), [], 'a key field reached the candidate');
  for (const s of keyStrings(assessmentId)) assert.ok(!text.includes(s), `key text reached the candidate: ${s}`);
  assert.ok(!/Correct answer:/i.test(text), 'recruiter feedback reached the candidate');
};
const readyCandidate = () => {
  const c = newCandidate();
  const job = seedJob();
  seedResumeFile(c);
  seedApplication(c, job.id);
  return { c, job };
};

// ---- eligibility ----
test('start / generate without an application -> 403 not_applied; status not_applied; nothing prepared', async () => {
  const c = newCandidate();
  const job = seedJob();
  seedResumeFile(c);
  const before = genCalls();
  for (const route of ['start', 'generate']) {
    const r = await start(c, job.id, route);
    assert.equal(r.res.status, 403, r.text);
    assert.equal(r.body.error, 'not_applied');
  }
  const s = await status(c, job.id);
  assert.equal(s.res.status, 200, s.text);
  assert.equal(s.body.state, 'not_applied');
  assert.equal(svc.preparationState(c, job.id).inFlight, false);
  const out = await svc.prepareAssessment(c, job.id);
  assert.deepEqual(out, { status: 'skipped', reason: 'not_applied' });
  assert.equal(genCalls(), before, 'no generation without an application');

  assert.equal((await start(c, 'not-a-uuid')).res.status, 400);
  assert.equal((await start(c, randomUUID())).res.status, 404);
  assert.equal((await status(c, 'x')).res.status, 400);
});

// ---- background preparation ----
test('apply returns 201 before a held generation completes; its body is the same whether preparation then succeeds or fails; status preparing -> ready / unavailable', async () => {
  const bodies = [];
  for (const outcome of ['ok', { status: 502, body: { error: 'llm_unavailable', message: SERVICE_LEAK } }]) {
    const c = newCandidate();
    const job = seedJob();
    seedResumeFile(c);
    genMode = 'hold';
    const calls = genCalls();
    const r = await apply(c, job.id);
    assert.equal(r.res.status, 201, r.text);
    // The apply answer is in hand; the generation it triggered is reached and still open.
    await waitFor(() => genCalls() === calls + 1, 'the background generate call');
    assert.equal(held.length, 1, 'the fake holds the generation open');
    assert.equal(svc.preparationState(c, job.id).inFlight, true);
    const during = await status(c, job.id);
    assert.equal(during.body.state, 'preparing', during.text);
    assert.ok(!('questions' in during.body));

    if (outcome === 'ok') {
      release('ok');
      await settled(c, job.id);
      assert.ok(poolOf(c, job.id), 'the pool row exists');
      assert.equal(poolOf(c, job.id).answers, null, 'a pool is unstarted: answers null');
      // Anti-cheat: before Start the questions are only in the key row.
      assert.deepEqual(poolOf(c, job.id).questions, [], 'the candidate-readable row holds no questions');
      const keyRow = db.tables.assessment_keys.find((k) => k.assessment_id === poolOf(c, job.id).id);
      assert.ok(keyRow, 'its key is stored');
      assert.equal(keyRow.answer_key.pool_questions.questions.length, 10, 'the pool is in the key row');
      assert.equal(keyRow.answer_key.answers.length, 10);
      const ready = await status(c, job.id);
      assert.equal(ready.body.state, 'ready', ready.text);
      assert.equal(ready.body.assessmentId, poolOf(c, job.id).id);
      assert.ok(!('questions' in ready.body), 'status never returns questions');
      // The generation input: full parsed text and the GitHub snapshot (D§6.1).
      const input = asm.requests.filter((q) => q.path === '/generate-assessment').at(-1).body;
      assert.equal(input.resume_text, SNAP_F1.raw_text);
      assert.equal(input.include_github, true);
      assert.equal(input.github_data.username, GH_FIXTURE.username);
    } else {
      genMode = outcome;
      release(outcome);
      await settled(c, job.id);
      assert.equal(poolOf(c, job.id), undefined);
      const after = await status(c, job.id);
      assert.equal(after.body.state, 'unavailable', after.text);
      assert.equal(after.body.reason, 'llm_unavailable');
      assert.ok(!after.text.includes('LEAKY'), 'upstream text reached the client');
    }
    const { id, candidate_id: _c, job_id: _j, created_at: _t, submitted_at: _s, ...rest } = r.body;
    assert.ok(id);
    bodies.push({ status: r.res.status, rest });
  }
  assert.deepEqual(bodies[0], bodies[1], 'apply answers identically whatever preparation does later');
});

test('start while preparing -> 202 in under 2 s with the fake blocked; then ready -> 200 with 10 questions and started_at; a second start returns the same attempt and clock', async () => {
  const { c, job } = readyCandidate();
  genMode = 'hold';
  const calls = genCalls();
  const first = await start(c, job.id);
  assert.equal(first.res.status, 202, first.text);
  assert.equal(first.body.state, 'preparing');
  assert.ok(first.ms < 2000, `start took ${first.ms} ms`);
  await waitFor(() => genCalls() === calls + 1, 'the generate call');
  const again = await start(c, job.id);
  assert.equal(again.res.status, 202);
  assert.ok(again.ms < 2000, `start took ${again.ms} ms`);
  assert.equal(held.length, 1, 'the fake is still blocked');
  assert.equal(genCalls(), calls + 1, 'a start while preparing does not start a second generation');

  release('ok');
  await settled(c, job.id);
  const pool = poolOf(c, job.id);
  assert.deepEqual(pool.questions, []);
  const s1 = await start(c, job.id);
  assert.equal(s1.res.status, 200, s1.text);
  assert.equal(s1.body.state, 'in_progress');
  assert.equal(s1.body.assessmentId, pool.id);
  assert.equal(s1.body.questions.length, 10);
  assert.equal(s1.body.question_count, 10);
  assert.ok(Date.parse(s1.body.started_at), 'started_at is a timestamp');
  assertNoKey(s1.text, s1.body, pool.id);
  // answers shape written once at Start, in the same update that copies the questions over.
  assert.deepEqual(pool.answers, { started_at: s1.body.started_at, responses: [] });
  const poolQuestions = db.tables.assessment_keys.find((k) => k.assessment_id === pool.id).answer_key.pool_questions;
  assert.deepEqual(pool.questions, poolQuestions, 'start filled assessments.questions from the key row');
  assert.deepEqual(s1.body.questions.map((q) => q.question_id), poolQuestions.questions.map((q) => q.question_id));
  const startPatches = supa.requests.filter((q) => q.method === 'PATCH' && q.path.startsWith('/rest/v1/assessments') && q.path.includes(pool.id) && q.body?.answers?.started_at);
  assert.equal(startPatches.length, 1, 'one start write');
  assert.ok(/answers=is\.null/.test(decodeURIComponent(startPatches[0].path)), 'guarded by answers is null');
  assert.deepEqual(Object.keys(startPatches[0].body).sort(), ['answers', 'questions'], 'questions and the start mark in one update');

  const s2 = await start(c, job.id, 'generate');
  assert.equal(s2.res.status, 200, s2.text);
  assert.equal(s2.body.assessmentId, s1.body.assessmentId);
  assert.equal(s2.body.started_at, s1.body.started_at, 'the clock is not restarted');
  assert.deepEqual(s2.body.questions, s1.body.questions);

  const st = await status(c, job.id);
  assert.equal(st.body.state, 'in_progress');
  assert.equal(st.body.started_at, s1.body.started_at);
  assert.ok(!('questions' in st.body));
});

test('a failing fake is called at most 1 + ASSESSMENT_PREPARE_RETRIES times, then status reads unavailable with a reason code; retried only after 60 s', async () => {
  const { c, job } = readyCandidate();
  genMode = { status: 502, body: { error: 'llm_unavailable', message: SERVICE_LEAK } };
  const calls = genCalls();
  const s0 = await status(c, job.id);
  assert.equal(s0.body.state, 'preparing');
  await settled(c, job.id);
  assert.equal(genCalls(), calls + 3, 'default ASSESSMENT_PREPARE_RETRIES is 2');
  const s1 = await status(c, job.id);
  assert.equal(s1.body.state, 'unavailable', s1.text);
  assert.equal(s1.body.reason, 'llm_unavailable');
  assert.ok(!s1.text.includes('LEAKY'));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(genCalls(), calls + 3, 'a read within 60 s does not retry');
  assert.equal(svc.preparationState(c, job.id).lastFailure.reason, 'llm_unavailable');

  fakeNow += 61_000;
  const s2 = await status(c, job.id);
  assert.equal(s2.body.state, 'preparing', 'a read after 60 s starts preparation again');
  await settled(c, job.id);
  assert.equal(genCalls(), calls + 6);

  // ASSESSMENT_PREPARE_RETRIES=0 -> exactly one call; a missing key is never retried.
  process.env.ASSESSMENT_PREPARE_RETRIES = '0';
  const other = readyCandidate();
  let before = genCalls();
  await svc.prepareAssessment(other.c, other.job.id);
  assert.equal(genCalls(), before + 1);
  delete process.env.ASSESSMENT_PREPARE_RETRIES;
  const third = readyCandidate();
  genMode = { status: 503, body: { error: 'llm_not_configured', message: SERVICE_LEAK } };
  before = genCalls();
  const out = await svc.prepareAssessment(third.c, third.job.id);
  assert.deepEqual(out, { status: 'failed', reason: 'llm_not_configured' });
  assert.equal(genCalls(), before + 1, 'llm_not_configured is not retried');
  // Nothing about a failure is stored in the database.
  assert.equal(db.tables.assessments.filter((a) => a.candidate_id === c).length, 0);
});

test('two concurrent triggers make one generation call (single flight per candidate and job)', async () => {
  const { c, job } = readyCandidate();
  genMode = 'hold';
  const calls = genCalls();
  const p1 = svc.prepareAssessment(c, job.id);
  const p2 = svc.prepareAssessment(c, job.id);
  assert.equal(p1, p2, 'the second call joins the first');
  const reads = await Promise.all([status(c, job.id), status(c, job.id), start(c, job.id)]);
  assert.deepEqual(reads.map((r) => r.res.status), [200, 200, 202]);
  await waitFor(() => genCalls() === calls + 1, 'the generate call');
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(genCalls(), calls + 1, 'one generation call');
  release('ok');
  assert.equal((await p1).status, 'ready');
  assert.equal(db.tables.assessments.filter((a) => a.candidate_id === c && a.job_id === job.id).length, 1);
});

// ---- attempt policy ----
test('an unstarted pool is not an attempt: status ready with 0 used, and generate / start answer 200, not 409', async () => {
  const { c, job } = readyCandidate();
  const pool = seedPool(c, job.id);
  const s = await status(c, job.id);
  assert.equal(s.body.state, 'ready');
  assert.deepEqual(s.body.attempts, { used: 0, max: 1 });
  const r = await start(c, job.id, 'generate');
  assert.equal(r.res.status, 200, r.text);
  assert.equal(r.body.assessmentId, pool.id);
  assert.equal(r.body.questions.length, 10);
});

test('second generate after a completed attempt -> 409 attempts_used; status completed; no preparation', async () => {
  const { c, job } = readyCandidate();
  const done = seedCompleted(c, job.id, { score: 70 });
  const calls = genCalls();
  for (const route of ['generate', 'start']) {
    const r = await start(c, job.id, route);
    assert.equal(r.res.status, 409, r.text);
    assert.equal(r.body.error, 'attempts_used');
    assert.equal(r.body.state, 'completed');
    assert.deepEqual(r.body.attempts, { used: 1, max: 1 });
    assert.equal(r.body.scoreOfRecord.assessmentId, done.id);
    assert.equal(r.body.scoreOfRecord.score, 70);
  }
  const s = await status(c, job.id);
  assert.equal(s.body.state, 'completed');
  assert.deepEqual(await svc.prepareAssessment(c, job.id), { status: 'skipped', reason: 'attempts_used' });
  assert.equal(genCalls(), calls, 'no generation when no attempt is left');

  // ASSESSMENT_MAX_ATTEMPTS=2 leaves one more; the first attempt stays the score of record.
  process.env.ASSESSMENT_MAX_ATTEMPTS = '2';
  const s2 = await status(c, job.id);
  assert.equal(s2.body.state, 'preparing');
  assert.equal(s2.body.scoreOfRecord.assessmentId, done.id);
  await settled(c, job.id);
  assert.ok(poolOf(c, job.id));
});

test('a voided attempt (evaluation.voided) does not count toward the limit', async () => {
  const { c, job } = readyCandidate();
  seedCompleted(c, job.id, { score: 20, voided: { by: RECRUITER, at: '2026-11-14T11:00:00Z', reason: 'lost connection' } });
  assert.equal(svc.isVoided(db.tables.assessments.at(-1)), true);
  assert.equal(svc.isVoided({ evaluation: { voided: null } }), false);
  assert.equal(svc.isVoided({ evaluation: null }), false);
  const s = await status(c, job.id);
  assert.deepEqual(s.body.attempts, { used: 0, max: 1 });
  assert.equal(s.body.scoreOfRecord, null);
  await settled(c, job.id);
  const r = await start(c, job.id);
  assert.equal(r.res.status, 200, r.text);
});

// ---- evaluate ----
const answerAll = (questions) => questions.map((q) => ({
  question_id: q.question_id,
  response: q.question_type === 'mcq' ? 'C' : 'An answer written by the candidate.',
}));

test('evaluate before start -> 409 not_started (an unstarted pool cannot be graded)', async () => {
  const { c, job } = readyCandidate();
  const pool = seedPool(c, job.id);
  const r = await evaluate(c, pool.id, [{ question_id: 'q1', response: 'C' }]);
  assert.equal(r.res.status, 409, r.text);
  assert.equal(r.body.error, 'not_started');
  assert.equal(pool.status, 'generated');
});

test('evaluate with a prior score row: the old row is unchanged, a new row exists; the response carries no key material', async () => {
  const { c, job } = (() => { const x = newCandidate(); const j = seedJob(); seedResumeFile(x); return { c: x, job: j }; })();
  const applied = await apply(c, job.id);
  assert.equal(applied.body.scoring.status, 'scored', applied.text);
  await settled(c, job.id);
  const prior = JSON.parse(JSON.stringify(scoresFor(c, job.id)));
  assert.equal(prior.length, 1);

  const s = await start(c, job.id);
  assert.equal(s.res.status, 200, s.text);
  const answers = answerAll(s.body.questions);
  const r = await evaluate(c, s.body.assessmentId, answers);
  assert.equal(r.res.status, 200, r.text);
  assert.deepEqual(r.body.scoring, { status: 'scored', reason: null });
  assert.equal(r.body.state, 'completed');
  assert.equal(r.body.results.length, 10);
  for (const res of r.body.results) {
    assert.deepEqual(Object.keys(res).sort(), ['candidate_feedback', 'correct', 'max_points', 'points', 'question_id', 'question_type', 'skill']);
  }
  assert.ok(r.body.skills.length >= 1, 'per-skill summary');
  assert.equal(r.body.skills.reduce((n, k) => n + k.questions, 0), 10);
  assert.equal(typeof r.body.score, 'number');
  // Asserted against the stored key.
  assertNoKey(r.text, r.body, s.body.assessmentId);

  const rows = scoresFor(c, job.id);
  assert.equal(rows.length, 2, 'a new score row was inserted');
  assert.deepEqual(rows[0], prior[0], 'the prior row is unchanged');
  const newest = rows[1];
  assert.equal(newest.subscores[A].available, true);
  assert.equal(newest.subscores[A].value, r.body.score);
  assert.equal(newest.subscores[P].available, true);
  assert.equal(newest.evidence_limited, false);
  // Recruiter-facing explanation: per-question outcomes, still no key material.
  const outcomes = newest.explanation.factors.find((f) => f.key === A).evidence.find((e) => e.key === 'assessment_question_outcomes');
  assert.equal(outcomes.items.length, 10);
  const scoreText = JSON.stringify(newest);
  for (const k of keyStrings(s.body.assessmentId)) assert.ok(!scoreText.includes(k));

  // Stored attempt: the answers shape, candidate-safe evaluation; recruiter detail beside the key.
  const row = db.tables.assessments.find((a) => a.id === s.body.assessmentId);
  assert.equal(row.status, 'completed');
  assert.equal(row.answers.started_at, s.body.started_at);
  assert.deepEqual(row.answers.responses, answers);
  assert.ok(Date.parse(row.answers.submitted_at));
  assert.ok(!JSON.stringify(row.evaluation).includes('recruiter_feedback'));
  for (const k of keyStrings(row.id)) assert.ok(!JSON.stringify(row.evaluation).includes(k));
  const keyRow = db.tables.assessment_keys.find((k) => k.assessment_id === row.id);
  assert.equal(keyRow.answer_key.recruiter_results.length, 10);
  assert.match(keyRow.answer_key.recruiter_results[0].recruiter_feedback, /Correct answer: C/);

  // A second submit is refused; status reads completed.
  assert.equal((await evaluate(c, row.id, answers)).res.status, 409);
  assert.equal((await status(c, job.id)).body.state, 'completed');
});

test('evaluate with no prior score row and the parser down creates one, marked evidence-limited (assessment-only fallback)', async () => {
  const { c, job } = readyCandidate();
  const stored = { id: randomUUID(), candidate_id: c, job_id: job.id, contact: { github: null }, skills: ['python'], parser_version: 'x', created_at: db.stamp() };
  db.tables.resumes.push(stored);
  seedPool(c, job.id);
  const s = await start(c, job.id);
  assert.equal(s.res.status, 200, s.text);
  process.env.NLP_PARSE_URL = await closedPortUrl('/parse');
  assert.equal(scoresFor(c, job.id).length, 0);

  const r = await evaluate(c, s.body.assessmentId, answerAll(s.body.questions));
  assert.equal(r.res.status, 200, r.text);
  assert.deepEqual(r.body.scoring, { status: 'scored', reason: null });
  const rows = scoresFor(c, job.id);
  assert.equal(rows.length, 1, 'the first score row was created');
  const [row] = rows;
  assert.equal(row.evidence_limited, true);
  assert.equal(row.resume_id, stored.id, 'anchored to the newest stored resumes row');
  assert.equal(row.subscores[P].available, false);
  assert.equal(row.subscores[P].components.reason_code, 'parser_unavailable');
  assert.equal(row.subscores[G].components.reason_code, 'no_github_link');
  assert.equal(row.subscores[A].available, true);
  assert.equal(row.weights[A], 1);
  assert.equal(Number(row.composite_score), row.subscores[A].value);
});

test('evaluate with no resumes row at all: no score row, scoring failed, the graded attempt stays stored', async () => {
  const c = newCandidate();
  const job = seedJob();
  seedApplication(c, job.id);
  seedPool(c, job.id);
  const s = await start(c, job.id);
  const r = await evaluate(c, s.body.assessmentId, answerAll(s.body.questions));
  assert.equal(r.res.status, 200, r.text);
  assert.deepEqual(r.body.scoring, { status: 'failed', reason: 'no_resume' });
  assert.equal(scoresFor(c, job.id).length, 0);
  assert.equal(db.tables.assessments.find((a) => a.id === s.body.assessmentId).status, 'completed');
});

// R-12 changed this case: 503 (was 502), and the attempt reads "submitted, grading pending".
test('grader failure -> 503 grading_unavailable with a fixed message; the submission is kept and reads grading_pending; no score row', async () => {
  const { c, job } = readyCandidate();
  seedPool(c, job.id);
  const s = await start(c, job.id);
  evalMode = { status: 502, body: { error: 'grading_unavailable', message: SERVICE_LEAK } };
  const r = await evaluate(c, s.body.assessmentId, answerAll(s.body.questions));
  assert.equal(r.res.status, 503, r.text);
  assert.equal(r.body.error, 'grading_unavailable');
  assert.equal(r.body.state, 'grading_pending');
  assert.ok(!r.text.includes('LEAKY'));
  const row = db.tables.assessments.find((a) => a.id === s.body.assessmentId);
  assert.equal(row.status, 'generated');
  assert.equal(row.answers.started_at, s.body.started_at);
  assert.ok(row.answers.submitted_at, 'the submission is fixed');
  assert.equal(scoresFor(c, job.id).length, 0);
  assert.equal((await status(c, job.id)).body.state, 'grading_pending');
  evalMode = 'ok';
  assert.equal((await evaluate(c, s.body.assessmentId, answerAll(s.body.questions))).res.status, 200);
});

// ---- the score of record ----
test('scoring folds in the FIRST completed, non-voided attempt', async () => {
  const { c, job } = readyCandidate();
  const first = seedCompleted(c, job.id, { score: 40, completedAt: '2026-11-14T09:00:00.000Z' });
  seedCompleted(c, job.id, { score: 90, completedAt: '2026-11-14T09:30:00.000Z' });
  assert.equal((await scoring.findScoringAssessment(c, job.id)).id, first.id);
  let out = await scoring.scoreApplication({ candidateId: c, jobId: job.id });
  assert.equal(out.status, 'scored');
  assert.equal(out.scoreRow.subscores[A].value, 40);

  first.evaluation = { ...first.evaluation, voided: { by: RECRUITER, at: '2026-11-14T10:00:00Z', reason: 'test' } };
  out = await scoring.scoreApplication({ candidateId: c, jobId: job.id });
  assert.equal(out.scoreRow.subscores[A].value, 90, 'a voided attempt is skipped');
});

// ---- R-11 rework: pool questions unreadable before Start; on-apply flag ----
// R-12 (D2) changed this case: the broken row is closed (voided by the system,
// reason pool_missing, row kept) on the next status or start read, so a new pool
// is prepared instead of the slot staying blocked.
test('an unstarted row whose key row lacks the pool is closed as voided (pool_missing, by system, row kept) on read; a new pool is prepared', async () => {
  for (const [key, route] of [['no_pool', 'status'], ['none', 'start'], ['none', 'generate']]) {
    const { c, job } = readyCandidate();
    const row = seedPool(c, job.id, {}, { key });
    const calls = genCalls();
    const r = route === 'status' ? await status(c, job.id) : await start(c, job.id, route);
    assert.equal(r.res.status, route === 'status' ? 200 : 202, `${key}/${route}: ${r.text}`);
    assert.equal(r.body.state, 'preparing');
    assert.ok(!('questions' in r.body), 'no questions served');
    assert.ok(db.tables.assessments.includes(row), 'the broken row is not deleted');
    assert.equal(row.status, 'completed');
    assert.equal(row.evaluation.voided.reason, 'pool_missing');
    assert.equal(row.evaluation.voided.by, 'system');
    assert.equal(row.evaluation.voided.role, 'system');
    assert.equal(row.evaluation.voided.prior_state, 'unstarted');
    assert.equal(row.answers, null, 'the clock was never started');
    await settled(c, job.id);
    assert.equal(genCalls(), calls + 1, 'a new pool was prepared');
    const fresh = poolOf(c, job.id);
    assert.ok(fresh && fresh.id !== row.id);
    const after = await status(c, job.id);
    assert.equal(after.body.state, 'ready', after.text);
    assert.deepEqual(after.body.attempts, { used: 0, max: 1 }, 'the voided row is not an attempt');
  }
});

test('ASSESSMENT_PREPARE_ON_APPLY=false: apply does not prepare; status then prepares lazily', async () => {
  process.env.ASSESSMENT_PREPARE_ON_APPLY = 'false';
  assert.equal(svc.prepareOnApply(), false);
  const c = newCandidate();
  const job = seedJob();
  seedResumeFile(c);
  const calls = genCalls();
  const parses = nlp.requests.length;
  const r = await apply(c, job.id);
  assert.equal(r.res.status, 201, r.text);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(nlp.requests.length, parses + 1, 'only the scoring parse ran; no preparation parse');
  assert.equal(genCalls(), calls, 'no generation on apply');
  assert.deepEqual(svc.preparationState(c, job.id), { inFlight: false, lastFailure: null });

  const s = await status(c, job.id);
  assert.equal(s.body.state, 'preparing');
  await settled(c, job.id);
  assert.equal(genCalls(), calls + 1, 'status prepared lazily');
  assert.equal((await status(c, job.id)).body.state, 'ready');

  for (const v of ['true', '1', '', undefined]) {
    if (v === undefined) delete process.env.ASSESSMENT_PREPARE_ON_APPLY; else process.env.ASSESSMENT_PREPARE_ON_APPLY = v;
    assert.equal(svc.prepareOnApply(), true, String(v));
  }
});
