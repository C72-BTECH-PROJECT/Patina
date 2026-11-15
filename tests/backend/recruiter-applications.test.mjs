// R-13 (offline): the recruiter applications API, status actions, honest
// notifications and real job counts (REBUILD/DECISIONS.md §8.2, §10, Y2; TASKS.md R-13).
//
// Nothing leaves loopback, no LLM is called and no model is loaded. Core's real
// routers (analysis, jobs, notifications) and its auth middleware run in process
// against the in-memory Supabase stub (lib/supabase-stub.mjs). The NLP, GitHub and
// assessment upstreams are local stubs that refuse, so a background preparation a
// read may start ends at once with a failure code and never reaches a real service.
//
//   node --test tests/backend/recruiter-applications.test.mjs
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_DIR, TESTS_DIR } from './lib/env.mjs';
import { json, startStub } from './lib/stub-server.mjs';
import { LEAK, createSupabaseStub, fakeServiceKey } from './lib/supabase-stub.mjs';

const backendUrl = (...parts) =>
  new URL(`file:///${join(REPO_DIR, 'backend', ...parts).replace(/\\/g, '/')}`);
const express = createRequire(join(REPO_DIR, 'backend', 'package.json'))('express');

const REC_A = '22222222-2222-4222-8222-0000000000b1';
const REC_B = '22222222-2222-4222-8222-0000000000b2';
let seq = 0;
const newId = () => `11111111-1111-4111-8111-${String(900 + ++seq).padStart(12, '0')}`;

const db = createSupabaseStub();
let supa; let refuse; let envDir; let svc; let server; let base;
let generateCalls = 0;
const F1 = readFileSync(join(TESTS_DIR, 'fixtures', 'f1_dev_github.pdf'));

before(async () => {
  supa = await startStub({ handler: db.handler });
  refuse = await startStub({ handler: (_req, res) => json(res, 503, { error: 'stub_down' }) });

  envDir = mkdtempSync(join(tmpdir(), 'patina-r13-'));
  const envFile = join(envDir, 'backend.env');
  writeFileSync(envFile, [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${fakeServiceKey()}`,
    'SUPABASE_ANON_KEY=stub-anon-key',
    'SESSION_SECRET=r13-offline-test-secret-r13-offline',
    'SUPABASE_TIMEOUT_MS=3000',
  ].join('\n'));
  process.env.BACKEND_ENV_FILE = envFile;
  process.env.NLP_PARSE_URL = `${refuse.url}/parse`;
  process.env.GITHUB_EVIDENCE_URL = refuse.url;
  process.env.ASSESSMENT_SERVICE_URL = refuse.url;
  process.env.ASSESSMENT_PREPARE_ON_APPLY = 'false';
  process.env.ASSESSMENT_PREPARE_RETRIES = '0';

  const errors = await import(backendUrl('Middlewares', 'errorHandler.js'));
  const requestId = await import(backendUrl('Middlewares', 'requestId.js'));
  const analysisRoutes = (await import(backendUrl('Routes', 'analysis.routes.js'))).default;
  const jobsRoutes = (await import(backendUrl('Routes', 'jobs.routes.js'))).default;
  const notificationRoutes = (await import(backendUrl('Routes', 'notification.routes.js'))).default;
  const assessmentRoutes = (await import(backendUrl('Routes', 'assessment.routes.js'))).default;
  svc = await import(backendUrl('Services', 'assessmentService.js'));
  assert.equal(process.env.SUPABASE_URL, supa.url, 'Supabase client is not pointed at the local stub');
  svc.configurePreparation({ sleep: async () => {}, generate: async () => { generateCalls += 1; throw new Error('no generation in R-13 tests'); } });

  const app = express();
  app.use(requestId.requestIdMiddleware);
  app.use(errors.errorContract);
  app.use(express.json());
  app.use((req, _res, next) => {
    const user = req.get('X-Test-User');
    req.session = user ? { userId: user, role: req.get('X-Test-Role') || 'RECRUITER' } : {};
    next();
  });
  // The same mounts as backend/index.js.
  app.use('/api/jobs', jobsRoutes);
  app.use('/api', analysisRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/assessment', assessmentRoutes);
  app.use(errors.notFoundHandler);
  app.use(errors.errorHandler);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  svc?.resetPreparation();
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  await Promise.all([supa?.close(), refuse?.close()]);
  if (envDir) rmSync(envDir, { recursive: true, force: true });
});

beforeEach(() => { db.fail.clear(); });

// ---- seeding ----
const seedJob = (recruiterId, title = '[R-13 TEST] Backend engineer') => {
  const job = {
    id: randomUUID(), recruiter_id: recruiterId, title, description: 'Backend engineer: Python and SQL.',
    required_skills: ['python'], preferred_skills: [], experience_level: 'mid', location: 'JOB-LOCATION-Pune',
    status: 'published', created_at: db.stamp(),
  };
  db.tables.jobs.push(job);
  return job;
};
const seedCandidate = ({ first = 'Asha', last = 'Rao', email } = {}) => {
  const id = newId();
  db.tables.profiles.push({ id, first_name: first, last_name: last });
  db.emails.set(id, email || `${id.slice(-6)}@example.test`);
  return id;
};
const apply = (candidateId, job) => {
  const row = { id: randomUUID(), candidate_id: candidateId, job_id: job.id, status: 'submitted', submitted_at: db.stamp() };
  db.tables.applications.push(row);
  return row;
};
const SUBS = (parsing) => ({
  parsing_semantic_alignment: { key: 'parsing_semantic_alignment', available: true, value: parsing, weight: 1, reason: null, components: {}, evidence: [] },
  github_evidence: { key: 'github_evidence', available: false, value: null, weight: 0, reason: 'No GitHub profile link was found on the resume.', components: null, evidence: [] },
  assessment_results: { key: 'assessment_results', available: false, value: null, weight: 0, reason: 'No assessment has been completed.', components: null, evidence: [] },
});
const seedScore = (candidateId, job, composite, skills = ['python', 'sql']) => {
  const resume = { id: randomUUID(), candidate_id: candidateId, skills, contact: { candidate_name: 'RESUME-NAME Someone Else', email: 'resume@example.test' }, created_at: db.stamp() };
  db.tables.resumes.push(resume);
  const row = {
    id: randomUUID(), resume_id: resume.id, candidate_id: candidateId, job_id: job.id, composite_score: composite,
    subscores: SUBS(composite), weights: { parsing_semantic_alignment: 1, github_evidence: 0, assessment_results: 0 },
    explanation: { version: 1, composite, factors: [], skill_evidence: [{ name: 'python', status: 'matched' }], github_account: { source: 'resume_link', ownership_verified: false } },
    evidence_limited: true, created_at: db.stamp(),
  };
  db.tables.scores.push(row);
  return row;
};

const call = async (method, path, { user, role = 'RECRUITER', body } = {}) => {
  const headers = { 'X-Test-Role': role };
  if (user) headers['X-Test-User'] = user;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not JSON */ }
  return { res, text, body: parsed };
};
const list = (user, jobId) => call('GET', `/api/recruiter/applications${jobId ? `?jobId=${jobId}` : ''}`, { user });
const detail = (user, id, role) => call('GET', `/api/recruiter/applications/${id}`, { user, role });
const assertContract500 = (r, what) => {
  assert.equal(r.res.status, 500, `${what}: ${r.text}`);
  assert.match(r.res.headers.get('content-type') || '', /application\/json/);
  assert.equal(typeof r.body.error, 'string');
  assert.equal(typeof r.body.message, 'string');
  assert.ok(r.body.requestId, `${what}: no requestId`);
  assert.ok(!r.text.includes(LEAK) && !r.text.includes('LEAKY'), `${what}: leaked stub text`);
  assert.ok(!Array.isArray(r.body), `${what}: answered a list`);
};

// ---- two recruiters, each with their own applicants ----
const jobA = seedJob(REC_A, '[R-13 TEST] A job');
const jobA2 = seedJob(REC_A, '[R-13 TEST] A second job, no applicants');
const jobB = seedJob(REC_B, '[R-13 TEST] B job');
const cA1 = seedCandidate({ first: 'Asha', last: 'Rao', email: 'asha@example.test' });
const cA2 = seedCandidate({ first: '', last: '', email: 'noname@example.test' });
const cA3 = seedCandidate({ first: 'Unscored', last: 'Person', email: 'unscored@example.test' });
const cB1 = seedCandidate({ first: 'Bea', last: 'Other', email: 'bea@example.test' });
const cNever = seedCandidate({ first: 'Never', last: 'Applied', email: 'never@example.test' });
const appA1 = apply(cA1, jobA);
const appA2 = apply(cA2, jobA);
const appA3 = apply(cA3, jobA);
const appB1 = apply(cB1, jobB);
// cA1: an older high score and a newer lower one (the newest row is the score of record).
const oldA1 = seedScore(cA1, jobA, 91.5);
const newA1 = seedScore(cA1, jobA, 62.25, ['python', 'docker']);
seedScore(cA2, jobA, 75);
seedScore(cB1, jobB, 99);
// A score row with no application must never surface (the old /api/candidates listed it).
seedScore(cNever, jobA, 88);

test('recruiter A sees only applications to A\'s jobs; B sees only B\'s (list with and without jobId, detail)', async () => {
  const a = await list(REC_A);
  assert.equal(a.res.status, 200, a.text);
  assert.deepEqual(a.body.map((i) => i.id).sort(), [appA1.id, appA2.id, appA3.id].sort());
  for (const s of [appB1.id, cB1, 'bea@example.test', jobB.id]) assert.ok(!a.text.includes(s), `A's list leaks ${s}`);

  const b = await list(REC_B);
  assert.equal(b.res.status, 200, b.text);
  assert.deepEqual(b.body.map((i) => i.id), [appB1.id]);
  for (const s of [appA1.id, cA1, 'asha@example.test', jobA.id]) assert.ok(!b.text.includes(s), `B's list leaks ${s}`);

  const aJob = await list(REC_A, jobA.id);
  assert.equal(aJob.res.status, 200);
  assert.equal(aJob.body.length, 3);
  assert.deepEqual(await list(REC_A, jobA2.id).then((r) => [r.res.status, r.body]), [200, []]);

  const cross = await list(REC_A, jobB.id);
  assert.equal(cross.res.status, 404, 'another recruiter\'s jobId is not found');
  assert.equal(cross.body.error, 'job_not_found');
  assert.ok(!cross.text.includes(appB1.id) && !cross.text.includes('bea@'));
  assert.equal((await list(REC_A, randomUUID())).res.status, 404, 'an unknown jobId reads the same');
  assert.equal((await list(REC_A, 'not-a-uuid')).res.status, 400);

  const dOwn = await detail(REC_B, appB1.id);
  assert.equal(dOwn.res.status, 200, dOwn.text);
  for (const [user, id] of [[REC_A, appB1.id], [REC_B, appA1.id]]) {
    const d = await detail(user, id);
    assert.equal(d.res.status, 404, `${user} read ${id}: ${d.text}`);
    assert.equal(d.body.error, 'not_found');
    assert.ok(!d.text.includes('@example.test'));
  }
  assert.equal((await detail(REC_A, randomUUID())).res.status, 404, 'unknown id reads the same as someone else\'s');
  assert.equal((await detail(REC_A, 'nope')).res.status, 400);
});

test('a candidate who has not applied never appears, even with a score row for the job', async () => {
  const r = await list(REC_A);
  assert.ok(!r.text.includes(cNever), 'a non-applicant is listed');
  assert.ok(!r.text.includes('never@example.test'));
});

test('list item shape: profile name (null when none, never "Candidate"), account email, no job location; newest score wins; unscored last as pending', async () => {
  const r = await list(REC_A);
  assert.equal(r.res.status, 200);
  assert.ok(!r.text.includes('JOB-LOCATION'), 'the job location is presented');
  assert.ok(!r.text.includes('RESUME-NAME') && !r.text.includes('resume@example.test'), 'name or email came from the parsed resume');
  assert.ok(!/"Candidate"/.test(r.text), 'placeholder name');

  // Sorted by composite descending, unscored last: cA2 (75) > cA1 (newest 62.25) > cA3 (none).
  assert.deepEqual(r.body.map((i) => i.id), [appA2.id, appA1.id, appA3.id]);

  const a1 = r.body.find((i) => i.id === appA1.id);
  // R-27 (D§7.1 W4) adds `score_state`.
  assert.deepEqual(Object.keys(a1).sort(), ['applied_at', 'assessment', 'candidate', 'id', 'job', 'score', 'score_state', 'scoring', 'status'].sort());
  assert.deepEqual(a1.candidate, { id: cA1, name: 'Asha Rao', email: 'asha@example.test' });
  assert.deepEqual(a1.job, { id: jobA.id, title: jobA.title });
  assert.equal(a1.status, 'submitted');
  assert.equal(a1.applied_at, appA1.submitted_at);
  assert.deepEqual(a1.scoring, { state: 'scored' });
  assert.equal(a1.score.id, newA1.id, 'the newest score row is the score of record');
  assert.equal(a1.score.composite, 62.25);
  assert.equal(a1.score.band, 'medium');
  assert.equal(a1.score.evidence_limited, true);
  assert.equal(a1.score.verification, 'unverified', 'R-27: résumé only, from the stored sub-scores');
  assert.equal(a1.score_state, 'awaiting_assessment', 'R-27: not assessed yet');
  assert.deepEqual(a1.score.skills, ['python', 'docker'], 'skills of the resume that score was computed from');
  assert.equal(a1.score.created_at, newA1.created_at);
  assert.deepEqual(a1.score.subscores.parsing_semantic_alignment, { available: true, value: 62.25, weight: 1 });
  assert.deepEqual(a1.score.subscores.github_evidence, { available: false, value: null, weight: 0, reason: 'No GitHub profile link was found on the resume.' });
  assert.ok(!r.text.includes(oldA1.id), 'an older score row is not the list score');

  const a2 = r.body.find((i) => i.id === appA2.id);
  assert.equal(a2.candidate.name, null, 'a profile with no name gives null');
  assert.equal(a2.candidate.email, 'noname@example.test');

  const a3 = r.body.find((i) => i.id === appA3.id);
  assert.equal(a3.score, null);
  assert.deepEqual(a3.scoring, { state: 'pending' }, 'pending, with no invented reason');

  // Assessment block: state names of the candidate status read.
  for (const k of ['state', 'assessment_id', 'attempts', 'score_of_record', 'voided']) assert.ok(k in a3.assessment, `assessment.${k} missing`);
  assert.ok(Object.keys(a3.assessment).every((k) => ['state', 'reason', 'assessment_id', 'attempts', 'score_of_record', 'voided'].includes(k)), Object.keys(a3.assessment).join());
  assert.equal(a3.assessment.state, 'not_prepared', 'no pool and nothing running: an observing read says so');
  assert.deepEqual(a3.assessment.attempts, { used: 0, max: 1 });
  assert.equal(a3.assessment.score_of_record, null);
  assert.deepEqual(a3.assessment.voided, []);
});

test('ties: equal composites are ordered by applied_at descending, then id (stable across reads)', async () => {
  const job = seedJob(REC_A, '[R-13 TEST] tie job');
  const apps = [];
  for (let i = 0; i < 3; i += 1) {
    const c = seedCandidate({ first: `Tie${i}`, last: 'X' });
    apps.push(apply(c, job));
    seedScore(c, job, 70);
  }
  const first = await list(REC_A, job.id);
  const second = await list(REC_A, job.id);
  assert.deepEqual(first.body.map((i) => i.id), [...apps].reverse().map((a) => a.id));
  assert.deepEqual(second.body.map((i) => i.id), first.body.map((i) => i.id));
});

test('voided and completed attempts: list carries the void record and score of record; detail has every attempt with recruiter detail, never the key', async () => {
  const job = seedJob(REC_A, '[R-13 TEST] assessment job');
  const c = seedCandidate({ first: 'Vee', last: 'Oid' });
  const app = apply(c, job);
  seedScore(c, job, 81);
  const started = '2026-11-14T09:00:00.000Z';
  const questions = { questions: [
    { question_id: 'q1', question_type: 'mcq', question: 'R13 question one?', skill: 'python', options: [] },
    { question_id: 'q2', question_type: 'short_answer', question: 'R13 question two?', skill: 'sql' },
  ] };
  const results = [
    { question_id: 'q1', question_type: 'mcq', skill: 'python', correct: true, points: 1, max_points: 1, candidate_feedback: 'Correct.' },
    { question_id: 'q2', question_type: 'short_answer', skill: 'sql', correct: false, points: 0.5, max_points: 1, candidate_feedback: 'Partially correct.' },
  ];
  const voidRec = { by: REC_A, role: 'recruiter', at: '2026-11-14T09:30:00.000Z', reason: 'R13 technical problem', prior_state: 'completed' };
  const voidedRow = {
    id: randomUUID(), candidate_id: c, job_id: job.id, status: 'completed', score: 40, questions,
    answers: { started_at: started, submitted_at: '2026-11-14T09:10:00.000Z', responses: [] },
    evaluation: { score: 40, results, voided: voidRec }, created_at: '2026-11-14T08:59:00.000Z', completed_at: '2026-11-14T09:11:00.000Z',
  };
  const doneRow = {
    id: randomUUID(), candidate_id: c, job_id: job.id, status: 'completed', score: 75, questions,
    answers: { started_at: '2026-11-14T10:00:00.000Z', submitted_at: '2026-11-14T10:10:00.000Z', responses: [] },
    evaluation: { score: 75, results }, created_at: '2026-11-14T09:59:00.000Z', completed_at: '2026-11-14T10:11:00.000Z',
  };
  db.tables.assessments.push(voidedRow, doneRow);
  db.tables.assessment_keys.push(
    { assessment_id: doneRow.id, answer_key: { answers: [{ question_id: 'q1', correct_option: 'R13-SECRET-OPTION' }], pool_questions: { questions: [{ question: 'R13-POOL-SECRET' }] }, recruiter_results: [{ question_id: 'q1', recruiter_feedback: 'Correct answer: C.' }, { question_id: 'q2', recruiter_feedback: 'Ideal: joins.' }] } },
    { assessment_id: voidedRow.id, answer_key: { answers: [], recruiter_results: [{ question_id: 'q1', recruiter_feedback: 'Voided attempt detail.' }] } },
  );

  const l = await list(REC_A, job.id);
  assert.equal(l.res.status, 200, l.text);
  const item = l.body[0];
  assert.equal(item.assessment.state, 'completed');
  assert.deepEqual(item.assessment.attempts, { used: 1, max: 1 }, 'the voided attempt does not count');
  assert.deepEqual(item.assessment.score_of_record, { assessment_id: doneRow.id, score: 75, completed_at: doneRow.completed_at });
  assert.deepEqual(item.assessment.voided, [{ assessment_id: voidedRow.id, ...voidRec }]);

  const d = await detail(REC_A, app.id);
  assert.equal(d.res.status, 200, d.text);
  for (const secret of ['R13-SECRET-OPTION', 'R13-POOL-SECRET', 'correct_option', 'pool_questions', 'answer_key']) {
    assert.ok(!d.text.includes(secret), `detail leaks ${secret}`);
  }
  const items = d.body.assessment.items;
  assert.deepEqual(items.map((i) => i.assessmentId), [voidedRow.id, doneRow.id], 'every attempt, oldest first, voided included');
  assert.equal(items[0].state, 'voided');
  assert.deepEqual(items[0].voided, voidRec);
  assert.equal(items[0].score_of_record, false);
  assert.equal(items[1].state, 'completed');
  assert.equal(items[1].score_of_record, true);
  assert.deepEqual(items[1].results.map((r) => [r.question_id, r.question, r.recruiter_feedback, r.correct, r.points]), [
    ['q1', 'R13 question one?', 'Correct answer: C.', true, 1],
    ['q2', 'R13 question two?', 'Ideal: joins.', false, 0.5],
  ]);
  assert.equal(items[0].results[0].recruiter_feedback, 'Voided attempt detail.');
  assert.equal(d.body.assessment.unproctored_note, 'Unproctored online assessment.');
  assert.match(d.body.notes.github_ownership, /not verified/);
  assert.equal(d.body.notes.unproctored_assessment, 'Unproctored online assessment.');
});

test('detail: full stored explanation, weights and score history (newest first) for the owner', async () => {
  const d = await detail(REC_A, appA1.id);
  assert.equal(d.res.status, 200, d.text);
  assert.equal(d.body.id, appA1.id);
  assert.equal(d.body.score.id, newA1.id);
  assert.deepEqual(d.body.explanation, newA1.explanation, 'the stored explanation, as stored');
  assert.deepEqual(d.body.weights, newA1.weights);
  assert.deepEqual(d.body.score_history.map((s) => [s.id, s.composite]), [[newA1.id, 62.25], [oldA1.id, 91.5]]);
  assert.deepEqual(d.body.score_history[1].skills, ['python', 'sql']);
  assert.ok(!d.text.includes('JOB-LOCATION') && !d.text.includes('RESUME-NAME'));

  const unscored = await detail(REC_A, appA3.id);
  assert.equal(unscored.res.status, 200);
  assert.equal(unscored.body.score, null);
  assert.deepEqual(unscored.body.scoring, { state: 'pending' });
  assert.equal(unscored.body.explanation, null);
  assert.deepEqual(unscored.body.score_history, []);
});

test('candidates and unauthenticated callers are refused on both endpoints', async () => {
  for (const path of ['/api/recruiter/applications', `/api/recruiter/applications/${appA1.id}`]) {
    const cand = await call('GET', path, { user: cA1, role: 'CANDIDATE' });
    assert.equal(cand.res.status, 403, `${path} candidate: ${cand.text}`);
    assert.ok(!cand.text.includes('asha@example.test'));
    const anon = await call('GET', path);
    assert.equal(anon.res.status, 401, `${path} anonymous: ${anon.text}`);
  }
});

test('lookup errors are 500 JSON, never an empty list, a blank email or "not scored" (B6, B8)', async () => {
  for (const key of ['applications:GET', 'scores:GET', 'assessments:GET', 'applicant_emails:POST', 'resumes:GET', 'jobs:GET']) {
    db.fail.clear();
    db.fail.add(key);
    assertContract500(await list(REC_A), `list with ${key} failing`);
  }
  for (const key of ['applications:GET', 'scores:GET', 'assessments:GET', 'applicant_emails:POST']) {
    db.fail.clear();
    db.fail.add(key);
    assertContract500(await detail(REC_A, appA1.id), `detail with ${key} failing`);
  }
});

test('notification DB errors are 500 JSON, not an empty inbox or "not found" (B5)', async () => {
  db.tables.notifications.push({ id: randomUUID(), user_id: cA1, type: 'shortlisted', message: 'm', read: false, data: {}, created_at: db.stamp() });
  const ok = await call('GET', '/api/notifications', { user: cA1, role: 'CANDIDATE' });
  assert.equal(ok.res.status, 200);
  assert.equal(ok.body.unreadCount, 1);

  db.fail.add('notifications:GET');
  const r = await call('GET', '/api/notifications', { user: cA1, role: 'CANDIDATE' });
  assertContract500(r, 'notifications list');
  assert.equal(r.body.error, 'database_error');
  assert.ok(!('notifications' in r.body), 'an error answered as an inbox');

  db.fail.clear();
  db.fail.add('notifications:PATCH');
  const mark = await call('POST', `/api/notifications/${randomUUID()}/read`, { user: cA1, role: 'CANDIDATE' });
  assertContract500(mark, 'mark read');
  db.fail.clear();
  assert.equal((await call('POST', `/api/notifications/${randomUUID()}/read`, { user: cA1, role: 'CANDIDATE' })).res.status, 404, 'a real miss is 404');
  assert.equal((await call('POST', '/api/notifications/not-a-uuid/read', { user: cA1, role: 'CANDIDATE' })).res.status, 404);
});

test('removed routes: GET /api/candidates and GET /api/recruiter/applicants are 404 (Y2)', async () => {
  for (const path of ['/api/candidates', '/api/recruiter/applicants']) {
    const r = await call('GET', path, { user: REC_A });
    assert.equal(r.res.status, 404, `${path}: ${r.text}`);
    assert.equal(r.body.error, 'not_found');
  }
});

test('recruiter job list returns real application counts per job', async () => {
  const r = await call('GET', '/api/jobs/mine', { user: REC_A });
  assert.equal(r.res.status, 200, r.text);
  const count = (job) => r.body.find((j) => j.id === job.id)?.applicationCount;
  const expected = (job) => db.tables.applications.filter((a) => a.job_id === job.id).length;
  assert.equal(count(jobA), 3);
  assert.equal(count(jobA), expected(jobA));
  assert.equal(count(jobA2), 0);
  assert.ok(!r.body.some((j) => j.id === jobB.id), 'B\'s job is not in A\'s list');
  for (const j of r.body) assert.equal(j.applicationCount, expected(j), j.title);

  db.fail.add('applications:GET');
  assertContract500(await call('GET', '/api/jobs/mine', { user: REC_A }), 'job counts lookup');
});

test('status actions: shortlist and reject notify the candidate once; ownership and values enforced; notified reports the insert', async () => {
  const job = seedJob(REC_A, '[R-13 TEST] status job');
  const c = seedCandidate({ first: 'Stat', last: 'Us' });
  const app = apply(c, job);
  const notes = () => db.tables.notifications.filter((n) => n.user_id === c);

  const other = await call('POST', '/api/jobs/applications/shortlist', { user: REC_B, body: { applicationId: app.id, status: 'shortlisted' } });
  assert.equal(other.res.status, 404, 'another recruiter cannot change it');
  assert.equal(notes().length, 0);
  assert.equal((await call('POST', '/api/jobs/applications/shortlist', { user: REC_A, body: { applicationId: app.id, status: 'under_review' } })).res.status, 400);
  assert.equal((await call('POST', '/api/jobs/applications/shortlist', { user: c, role: 'CANDIDATE', body: { applicationId: app.id, status: 'shortlisted' } })).res.status, 403);

  const s = await call('POST', '/api/jobs/applications/shortlist', { user: REC_A, body: { applicationId: app.id, status: 'shortlisted' } });
  assert.equal(s.res.status, 200, s.text);
  assert.equal(s.body.status, 'shortlisted');
  assert.equal(s.body.notified, true);
  assert.deepEqual(notes().map((n) => n.type), ['shortlisted'], 'one notification for the candidate');
  assert.equal((await list(REC_A, job.id)).body[0].status, 'shortlisted');

  db.fail.add('notifications:POST');
  const rj = await call('POST', '/api/jobs/applications/shortlist', { user: REC_A, body: { applicationId: app.id, status: 'rejected' } });
  assert.equal(rj.res.status, 200, rj.text);
  assert.equal(rj.body.status, 'rejected');
  assert.equal(rj.body.notified, false, 'a failed notification insert is reported, not claimed');
  db.fail.clear();
  const rj2 = await call('POST', '/api/jobs/applications/shortlist', { user: REC_A, body: { applicationId: app.id, status: 'rejected' } });
  assert.equal(rj2.body.notified, true);
  assert.deepEqual(notes().map((n) => n.type), ['shortlisted', 'rejected']);
  // I-0074: a third identical decision is a no-op: no second notification.
  const rj3 = await call('POST', '/api/jobs/applications/shortlist', { user: REC_A, body: { applicationId: app.id, status: 'rejected' } });
  assert.equal(rj3.res.status, 200, rj3.text);
  assert.equal(rj3.body.status, 'rejected');
  assert.equal(rj3.body.unchanged, true);
  assert.equal(rj3.body.notified, false);
  assert.deepEqual(notes().map((n) => n.type), ['shortlisted', 'rejected'], 'no duplicate notification');
  // Fixed error codes (R-13 verification N1).
  const bad = await call('POST', '/api/jobs/applications/shortlist', { user: REC_A, body: { applicationId: app.id, status: 'under_review' } });
  assert.equal(bad.body.error, 'invalid_status');
  assert.equal(other.body.error, 'application_not_found');
  assert.equal((await call('POST', '/api/jobs/applications/shortlist', { user: REC_A, body: { applicationId: app.id } })).body.error, 'missing_field');
  // Both name the job, the same way.
  assert.deepEqual(notes().map((n) => n.message), [
    'You have been shortlisted for [R-13 TEST] status job.',
    'The recruiter has decided not to move forward with your application for [R-13 TEST] status job.',
  ]);
});

test('recruiter reads only observe: list, detail and /attempts start no preparation (zero generate, zero parse calls) and report not_prepared; the candidate status read still prepares', async () => {
  const job = seedJob(REC_A, '[R-13 TEST] observe job');
  const c = seedCandidate({ first: 'Obs', last: 'Erve' });
  const app = apply(c, job);
  // A stored resume, so a preparation (if one started) would reach the parser.
  db.store.set(`candidates/${c}/resume.pdf`, { bytes: F1, contentType: 'application/pdf', updated_at: db.stamp() });
  // A second applicant whose unstarted row has no pool in its key: reported, never voided.
  const c2 = seedCandidate({ first: 'Broken', last: 'Pool' });
  apply(c2, job);
  const broken = { id: randomUUID(), candidate_id: c2, job_id: job.id, status: 'generated', questions: [], answers: null, score: null, evaluation: null, created_at: db.stamp() };
  db.tables.assessments.push(broken);
  db.tables.assessment_keys.push({ assessment_id: broken.id, answer_key: { answers: [] } });
  // A third with a ready pool: batched check, no per-row lookup.
  const c3 = seedCandidate({ first: 'Ready', last: 'Pool' });
  apply(c3, job);
  const pool = { id: randomUUID(), candidate_id: c3, job_id: job.id, status: 'generated', questions: [], answers: null, score: null, evaluation: null, created_at: db.stamp() };
  db.tables.assessments.push(pool);
  db.tables.assessment_keys.push({ assessment_id: pool.id, answer_key: { answers: [], pool_questions: { questions: [{ question_id: 'q1', question: 'R13-POOL-Q' }] } } });

  const parseCalls = () => refuse.requests.filter((r) => /parse/.test(r.path || r.url || '')).length;
  const gen0 = generateCalls;
  const parse0 = parseCalls();
  const keyReads0 = supa.requests.filter((r) => /assessment_keys/.test(r.path || r.url || '') && r.method === 'GET').length;

  const l = await list(REC_A, job.id);
  assert.equal(l.res.status, 200, l.text);
  const keyReads = supa.requests.filter((r) => /assessment_keys/.test(r.path || r.url || '') && r.method === 'GET').length - keyReads0;
  assert.equal(keyReads, 1, 'one batched pool check for the list, not one per row');
  const stateOf = (cand) => l.body.find((i) => i.candidate.id === cand).assessment;
  assert.equal(stateOf(c).state, 'not_prepared');
  assert.deepEqual([stateOf(c2).state, stateOf(c2).reason], ['unavailable', 'pool_missing']);
  assert.equal(stateOf(c3).state, 'ready');
  assert.ok(!l.text.includes('R13-POOL-Q'), 'pool questions never leave the server');

  const d = await detail(REC_A, app.id);
  assert.equal(d.res.status, 200, d.text);
  assert.equal(d.body.assessment.state, 'not_prepared');
  const at = await call('GET', `/api/assessment/attempts?jobId=${job.id}&candidateId=${c}`, { user: REC_A });
  assert.equal(at.res.status, 200, at.text);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(svc.preparationState(c, job.id).inFlight, false);
  assert.equal(generateCalls - gen0, 0, 'a recruiter read caused a generation call');
  assert.equal(parseCalls() - parse0, 0, 'a recruiter read caused a preparation parse');
  assert.equal(broken.status, 'generated', 'a recruiter read voided a row');
  assert.equal(broken.evaluation, null);

  // The candidate's own status read is unchanged: it starts a preparation.
  const st = await call('GET', `/api/assessment/status?jobId=${job.id}`, { user: c, role: 'CANDIDATE' });
  assert.equal(st.res.status, 200, st.text);
  assert.equal(st.body.state, 'preparing');
  const until = Date.now() + 5000;
  while (svc.preparationState(c, job.id).inFlight && Date.now() < until) await new Promise((r) => setTimeout(r, 10));
  assert.ok(parseCalls() - parse0 >= 1, 'the candidate read did not reach the parser');
  // After that failure, the registry really says unavailable, and the recruiter read reports it.
  const after = await list(REC_A, job.id);
  const s1 = after.body.find((i) => i.candidate.id === c).assessment;
  assert.equal(s1.state, 'unavailable');
  assert.ok(s1.reason, 'unavailable carries the registry reason code');

  // The batched pool check's lookup error is an error too.
  db.fail.add('assessment_keys:GET');
  assertContract500(await list(REC_A, job.id), 'list with assessment_keys:GET failing');
});

// R-27 (D§7.1 W4): awaiting the assessment is the primary state, and awaiting
// applicants are ranked in their own group below scored ones.
test('R-27 W4: a ready pool reads awaiting_assessment; scored-and-assessed rank above awaiting, unscored last', async () => {
  const job = seedJob(REC_A, '[R-27 TEST] awaiting job');
  // Assessed: completed attempt, low composite.
  const cDone = seedCandidate({ first: 'Done', last: 'Assessed' });
  const appDone = apply(cDone, job);
  seedScore(cDone, job, 40);
  db.tables.assessments.push({
    id: randomUUID(), candidate_id: cDone, job_id: job.id, status: 'completed', score: 50, questions: { questions: [] },
    answers: { started_at: '2026-11-14T10:00:00.000Z', submitted_at: '2026-11-14T10:10:00.000Z', responses: [] },
    evaluation: { score: 50, results: [] }, created_at: '2026-11-14T09:59:00.000Z', completed_at: '2026-11-14T10:11:00.000Z',
  });
  // Awaiting: a ready pool, high partial composite.
  const cReady = seedCandidate({ first: 'Ready', last: 'Waiting' });
  const appReady = apply(cReady, job);
  seedScore(cReady, job, 19);
  const pool = { id: randomUUID(), candidate_id: cReady, job_id: job.id, status: 'generated', questions: [], answers: null, score: null, evaluation: null, created_at: db.stamp() };
  db.tables.assessments.push(pool);
  db.tables.assessment_keys.push({ assessment_id: pool.id, answer_key: { answers: [], pool_questions: { questions: [{ question_id: 'q1', question: 'R27-POOL-Q' }] } } });
  // Awaiting with a higher partial than the assessed one: still ranked below it.
  const cHigh = seedCandidate({ first: 'High', last: 'Partial' });
  const appHigh = apply(cHigh, job);
  seedScore(cHigh, job, 55);
  // Unscored.
  const cNone = seedCandidate({ first: 'No', last: 'Score' });
  const appNone = apply(cNone, job);

  const l = await list(REC_A, job.id);
  assert.equal(l.res.status, 200, l.text);
  assert.deepEqual(l.body.map((i) => i.id), [appDone.id, appHigh.id, appReady.id, appNone.id]);
  const by = Object.fromEntries(l.body.map((i) => [i.id, i]));
  assert.equal(by[appReady.id].assessment.state, 'ready');
  assert.equal(by[appReady.id].score_state, 'awaiting_assessment');
  assert.equal(by[appHigh.id].assessment.state, 'not_prepared');
  assert.equal(by[appHigh.id].score_state, 'awaiting_assessment');
  assert.equal(by[appDone.id].assessment.state, 'completed');
  assert.equal(by[appDone.id].score_state, 'final');
  assert.equal(by[appNone.id].score_state, 'awaiting_assessment');
  assert.equal(by[appNone.id].score, null);
  assert.ok(!l.text.includes('R27-POOL-Q'));

  const d = await detail(REC_A, appReady.id);
  assert.equal(d.res.status, 200, d.text);
  assert.equal(d.body.score_state, 'awaiting_assessment');
  assert.equal(d.body.score.verification, 'unverified');
  // A row scored before R-27 has no weights_version; it is returned as stored, never rewritten.
  assert.equal(d.body.explanation.weights_version, undefined);
});
