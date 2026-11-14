// R-16 (offline): the candidate's per-application result read and the enriched
// "my applications" list (REBUILD/DECISIONS.md §8.2 "Results is per application";
// lead's ruling on R-16's backend gap).
//
//   GET /api/applications/:id/result   owner only; others (and unknown ids) get 404
//   GET /api/jobs/my-applications      rows carry job_title and score { composite, band, verification } | null
//
// Core's real routers and auth middleware run in process against the in-memory
// Supabase stub (lib/supabase-stub.mjs). Nothing leaves loopback; no LLM is called.
//
//   node --test --experimental-test-module-mocks tests/backend/candidate-results.test.mjs
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';
import { json, startStub } from './lib/stub-server.mjs';
import { LEAK, createSupabaseStub, fakeServiceKey } from './lib/supabase-stub.mjs';

const backendUrl = (...parts) =>
  new URL(`file:///${join(REPO_DIR, 'backend', ...parts).replace(/\\/g, '/')}`);
const express = createRequire(join(REPO_DIR, 'backend', 'package.json'))('express');

const REC = '22222222-2222-4222-8222-0000000016b1';
let seq = 0;
const newId = () => `11111111-1111-4111-8111-${String(1600 + ++seq).padStart(12, '0')}`;

const db = createSupabaseStub();
let supa; let refuse; let envDir; let svc; let server; let base;
const seen = []; // every request the Supabase stub received, as 'METHOD /path'

before(async () => {
  supa = await startStub({
    handler: (req, res, rec) => {
      seen.push(`${req.method} ${new URL(req.url, 'http://stub').pathname}`);
      return db.handler(req, res, rec);
    },
  });
  refuse = await startStub({ handler: (_req, res) => json(res, 503, { error: 'stub_down' }) });

  envDir = mkdtempSync(join(tmpdir(), 'patina-r16-'));
  const envFile = join(envDir, 'backend.env');
  writeFileSync(envFile, [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${fakeServiceKey()}`,
    'SUPABASE_ANON_KEY=stub-anon-key',
    'SESSION_SECRET=r16-offline-test-secret-r16-offline',
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
  svc = await import(backendUrl('Services', 'assessmentService.js'));
  assert.equal(process.env.SUPABASE_URL, supa.url, 'Supabase client is not pointed at the local stub');
  svc.configurePreparation({ sleep: async () => {}, generate: async () => { throw new Error('no generation in R-16 tests'); } });

  const app = express();
  app.use(requestId.requestIdMiddleware);
  app.use(errors.errorContract);
  app.use(express.json());
  app.use((req, _res, next) => {
    const user = req.get('X-Test-User');
    req.session = user ? { userId: user, role: req.get('X-Test-Role') || 'CANDIDATE' } : {};
    next();
  });
  // The same mounts as backend/index.js.
  app.use('/api/jobs', jobsRoutes);
  app.use('/api', analysisRoutes);
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
const seedJob = (title, status = 'published') => {
  const job = {
    id: randomUUID(), recruiter_id: REC, title, description: 'Backend engineer: Python and SQL.',
    required_skills: ['python'], preferred_skills: [], experience_level: 'mid', location: 'Pune',
    status, created_at: db.stamp(),
  };
  db.tables.jobs.push(job);
  return job;
};
const apply = (candidateId, job) => {
  const row = { id: randomUUID(), candidate_id: candidateId, job_id: job.id, status: 'submitted', submitted_at: db.stamp() };
  db.tables.applications.push(row);
  return row;
};

// Recruiter-only and answer-key material that must never reach a candidate response.
const RECRUITER_FEEDBACK = 'RECRUITER-ONLY-FEEDBACK do not show the candidate';
const KEY_SECRET = 'ANSWER-KEY-SECRET correct option is C';

const SUBS = (parsing) => ({
  parsing_semantic_alignment: { key: 'parsing_semantic_alignment', label: 'Resume parsing', available: true, value: parsing, weight: 0.6, reason: null, components: {}, evidence: [] },
  github_evidence: { key: 'github_evidence', label: 'GitHub evidence', available: false, value: null, weight: 0, reason: 'No GitHub profile link was found on the resume.', components: null, evidence: [] },
  assessment_results: {
    key: 'assessment_results', label: 'Assessment', available: true, value: 50, weight: 0.4, reason: null,
    components: { question_outcomes: [{ question_id: 'q1', question_type: 'mcq', skill: 'python', correct: true, points: 1, max_points: 1 }] },
    evidence: [],
  },
});
const seedScore = (candidateId, job, composite, skills = ['python', 'sql']) => {
  const resume = { id: randomUUID(), candidate_id: candidateId, skills, experience: [], education: ['B.Tech'], projects: [], contact: { candidate_name: 'Asha Rao', email: 'asha@example.test' }, file_name: 'cv.pdf', created_at: db.stamp() };
  db.tables.resumes.push(resume);
  const row = {
    id: randomUUID(), resume_id: resume.id, candidate_id: candidateId, job_id: job.id, composite_score: composite,
    subscores: SUBS(composite), weights: { parsing_semantic_alignment: 0.6, github_evidence: 0, assessment_results: 0.4 },
    explanation: { version: 1, composite, summary: `Composite ${composite}.`, factors: [], skill_evidence: [], github_account: { source: 'resume_link', ownership_verified: false } },
    evidence_limited: true, created_at: db.stamp(),
  };
  db.tables.scores.push(row);
  return row;
};
// A graded attempt whose key row holds recruiter feedback and the answer key.
const seedGradedAttempt = (candidateId, job) => {
  const id = randomUUID();
  db.tables.assessments.push({
    id, candidate_id: candidateId, job_id: job.id, status: 'completed', score: 50,
    answers: { started_at: db.stamp(), submitted_at: db.stamp(), responses: [] },
    evaluation: { score: 50, results: [{ question_id: 'q1', correct: true, points: 1, max_points: 1 }] },
    questions: { questions: [{ question_id: 'q1', question: 'Which is a list?' }] },
    created_at: db.stamp(), completed_at: db.stamp(),
  });
  db.tables.assessment_keys.push({
    assessment_id: id,
    answer_key: { answers: { q1: KEY_SECRET }, recruiter_results: [{ question_id: 'q1', recruiter_feedback: RECRUITER_FEEDBACK }] },
  });
};

const call = async (method, path, { user, role = 'CANDIDATE' } = {}) => {
  const headers = { 'X-Test-Role': role };
  if (user) headers['X-Test-User'] = user;
  const res = await fetch(`${base}${path}`, { method, headers });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not JSON */ }
  return { res, text, body: parsed };
};
const result = (user, id, role) => call('GET', `/api/applications/${id}/result`, { user, role });
const mine = (user) => call('GET', '/api/jobs/my-applications', { user });
const assertContract500 = (r, what) => {
  assert.equal(r.res.status, 500, `${what}: ${r.text}`);
  assert.match(r.res.headers.get('content-type') || '', /application\/json/);
  assert.equal(typeof r.body.error, 'string');
  assert.equal(typeof r.body.message, 'string');
  assert.ok(r.body.requestId, `${what}: no requestId`);
  assert.ok(!r.text.includes(LEAK), `${what}: leaked stub text`);
  assert.equal(r.body.score, undefined, `${what}: answered as "no score"`);
};

// ---- fixtures: one candidate with two applications, each with its own scores ----
const cand = newId();
const other = newId();
const jobA = seedJob('[R-16 TEST] Job A');
const jobB = seedJob('[R-16 TEST] Job B, closed later', 'closed');
const jobC = seedJob('[R-16 TEST] Job C, never scored');
const appA = apply(cand, jobA);
const appB = apply(cand, jobB);
const appC = apply(cand, jobC);
seedScore(cand, jobA, 91.5); // older row for A
const newestA = seedScore(cand, jobA, 62.25, ['python', 'docker']);
const newestB = seedScore(cand, jobB, 74);
seedGradedAttempt(cand, jobA);

test('the owner gets their newest score for that application, in the candidate-analysis shape', async () => {
  const r = await result(cand, appA.id);
  assert.equal(r.res.status, 200, r.text);
  assert.deepEqual(r.body.application, {
    id: appA.id, job_id: jobA.id, job_title: jobA.title, status: 'submitted', submitted_at: appA.submitted_at,
  });
  assert.deepEqual(r.body.scoring, { state: 'scored' });
  const s = r.body.score;
  assert.equal(s.id, newestA.id, 'the newest row, not the older 91.5');
  assert.equal(s.jobId, jobA.id);
  assert.equal(s.jobTitle, jobA.title);
  assert.equal(s.credibilityScore, 62.25);
  assert.equal(s.band, 'medium');
  // R-27 (D§7.1 W3, W5): verification from the stored sub-scores (résumé + assessment);
  // a row written before W5 has no weights version (the v1 rule).
  assert.equal(s.verification, 'partly_verified');
  assert.equal(s.weightsVersion, null);
  assert.equal(s.evidenceLimited, true);
  assert.deepEqual(s.extractedSkills, ['python', 'docker'], 'skills of the resume the score was computed from');
  assert.equal(s.explanation.summary, 'Composite 62.25.');
  assert.equal(s.githubScore, null, 'an unavailable source is null, never 0');
  assert.equal(s.nlpScore, 62.25);
});

test('two applications by one candidate each return their own job\'s score', async () => {
  const a = await result(cand, appA.id);
  const b = await result(cand, appB.id);
  assert.equal(b.res.status, 200, b.text);
  assert.equal(a.body.score.jobId, jobA.id);
  assert.equal(b.body.score.jobId, jobB.id);
  assert.equal(b.body.score.id, newestB.id);
  assert.equal(b.body.score.credibilityScore, 74);
  assert.equal(b.body.application.job_title, jobB.title, 'a closed job still has its title');
});

test('no score row gives score: null and scoring state pending', async () => {
  const r = await result(cand, appC.id);
  assert.equal(r.res.status, 200, r.text);
  assert.equal(r.body.score, null);
  assert.deepEqual(r.body.scoring, { state: 'pending' });
  assert.equal(r.body.application.id, appC.id);
});

test('another candidate, an unknown id and a malformed id cannot read it', async () => {
  const theirs = await result(other, appA.id);
  assert.equal(theirs.res.status, 404, theirs.text);
  assert.equal(theirs.body.error, 'not_found');
  for (const leak of [jobA.title, newestA.id, '62.25']) assert.ok(!theirs.text.includes(leak), `404 leaks ${leak}`);

  const unknown = await result(cand, randomUUID());
  assert.equal(unknown.res.status, 404);
  const { requestId: _a, ...unknownBody } = unknown.body;
  const { requestId: _b, ...theirsBody } = theirs.body;
  assert.deepEqual(unknownBody, theirsBody, 'unknown and not-yours read the same');

  assert.equal((await result(cand, 'not-a-uuid')).res.status, 400);
  assert.equal((await result(REC, appA.id, 'RECRUITER')).res.status, 403, 'role guard: not for recruiters');
  assert.equal((await result(undefined, appA.id)).res.status, 401, 'role guard: signed out');
});

test('no recruiter-only feedback or answer-key material in either response', async () => {
  for (const r of [await result(cand, appA.id), await mine(cand)]) {
    assert.equal(r.res.status, 200, r.text);
    for (const s of [RECRUITER_FEEDBACK, KEY_SECRET, 'recruiter_feedback', 'recruiter_results', 'answer_key', 'ideal_answer', 'correct_option', 'key_points']) {
      assert.ok(!r.text.includes(s), `response contains ${s}`);
    }
  }
});

test('a lookup error is a 500 JSON error, never "no score"', async () => {
  for (const key of ['applications:GET', 'scores:GET', 'resumes:GET']) {
    db.fail.clear();
    db.fail.add(key);
    assertContract500(await result(cand, appA.id), `result with ${key} failing`);
  }
  for (const key of ['applications:GET', 'scores:GET']) {
    db.fail.clear();
    db.fail.add(key);
    const r = await mine(cand);
    assert.equal(r.res.status, 500, `my-applications with ${key} failing: ${r.text}`);
    assert.ok(!Array.isArray(r.body), 'answered a list');
    assert.ok(!r.text.includes(LEAK));
  }
});

test('my-applications rows carry job_title and the newest score { composite, band, verification } in one scores query', async () => {
  seen.length = 0;
  const r = await mine(cand);
  assert.equal(r.res.status, 200, r.text);
  assert.equal(seen.filter((s) => s === 'GET /rest/v1/scores').length, 1, `one scores query for all rows: ${seen.join(', ')}`);
  assert.equal(seen.filter((s) => s === 'GET /rest/v1/jobs').length, 0, 'titles come from the applications embed');
  const byId = new Map(r.body.map((row) => [row.id, row]));
  assert.deepEqual(Object.keys(byId.get(appA.id)).sort(), ['id', 'job_id', 'job_title', 'score', 'scoring', 'status', 'submitted_at']);
  // R-28 (D§7.1 W3): the verification state goes wherever the band does (SUBS: assessment only).
  assert.deepEqual(byId.get(appA.id).score, { composite: 62.25, band: 'medium', verification: 'partly_verified' });
  assert.deepEqual(byId.get(appA.id).scoring, { state: 'scored' });
  assert.equal(byId.get(appA.id).job_title, jobA.title);
  assert.deepEqual(byId.get(appB.id).score, { composite: 74, band: 'medium', verification: 'partly_verified' });
  assert.equal(byId.get(appB.id).job_title, jobB.title, 'closed job keeps its title');
  assert.equal(byId.get(appC.id).score, null);
  assert.deepEqual(byId.get(appC.id).scoring, { state: 'pending' });
  assert.ok(!r.text.includes(other));
});
