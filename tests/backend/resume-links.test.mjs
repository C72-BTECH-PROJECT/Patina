// R-30 follow-up (offline): the stored résumé's web links and education entries reach
// the candidate's result read (GET /api/applications/:id/result, serializeCandidate in
// backend/Controllers/analysis.controller.js) for both shapes a stored row can hold:
// a row parsed by nlp-engine >= 2.1.0 (every link in `project_links`, education objects)
// and a row parsed before it (GitHub and LinkedIn only, education strings).
//
// Core's real routers run in process against the in-memory Supabase stub
// (lib/supabase-stub.mjs). Nothing leaves loopback.
//
//   node --test --experimental-test-module-mocks tests/backend/resume-links.test.mjs
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';
import { json, startStub } from './lib/stub-server.mjs';
import { createSupabaseStub, fakeServiceKey } from './lib/supabase-stub.mjs';

const backendUrl = (...parts) =>
  new URL(`file:///${join(REPO_DIR, 'backend', ...parts).replace(/\\/g, '/')}`);
const express = createRequire(join(REPO_DIR, 'backend', 'package.json'))('express');

const REC = '22222222-2222-4222-8222-0000000030f1';
const db = createSupabaseStub();
let supa; let refuse; let envDir; let server; let base;

before(async () => {
  supa = await startStub({ handler: db.handler });
  refuse = await startStub({ handler: (_req, res) => json(res, 503, { error: 'stub_down' }) });

  envDir = mkdtempSync(join(tmpdir(), 'patina-r30f-'));
  const envFile = join(envDir, 'backend.env');
  writeFileSync(envFile, [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${fakeServiceKey()}`,
    'SUPABASE_ANON_KEY=stub-anon-key',
    'SESSION_SECRET=r30f-offline-test-secret-r30f-offline',
    'SUPABASE_TIMEOUT_MS=3000',
  ].join('\n'));
  process.env.BACKEND_ENV_FILE = envFile;
  process.env.NLP_PARSE_URL = `${refuse.url}/parse`;
  process.env.GITHUB_EVIDENCE_URL = refuse.url;
  process.env.ASSESSMENT_SERVICE_URL = refuse.url;
  process.env.ASSESSMENT_PREPARE_ON_APPLY = 'false';

  const errors = await import(backendUrl('Middlewares', 'errorHandler.js'));
  const requestId = await import(backendUrl('Middlewares', 'requestId.js'));
  const analysisRoutes = (await import(backendUrl('Routes', 'analysis.routes.js'))).default;
  assert.equal(process.env.SUPABASE_URL, supa.url, 'Supabase client is not pointed at the local stub');

  const app = express();
  app.use(requestId.requestIdMiddleware);
  app.use(errors.errorContract);
  app.use(express.json());
  app.use((req, _res, next) => {
    const user = req.get('X-Test-User');
    req.session = user ? { userId: user, role: 'CANDIDATE' } : {};
    next();
  });
  app.use('/api', analysisRoutes);
  app.use(errors.notFoundHandler);
  app.use(errors.errorHandler);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  await Promise.all([supa?.close(), refuse?.close()]);
  if (envDir) rmSync(envDir, { recursive: true, force: true });
});

const EDUCATION_OBJECT = {
  institution: 'Example Institute of Technology, Pune',
  degree: 'Bachelor of Technology in Computer Engineering',
  dates: '2021 – 2025',
  graduation_year: 2025,
  grade: 'CGPA: 8.72/10',
  honours: 'Honours in Artificial Intelligence',
  text: 'Example Institute of Technology, Pune · Bachelor of Technology in Computer Engineering · 2021 - 2025 | CGPA: 8.72/10 · Honours in Artificial Intelligence',
};

// One candidate, one application, one score on a résumé row of the given shape.
const seed = (resumeFields) => {
  const candidateId = randomUUID();
  const job = {
    id: randomUUID(), recruiter_id: REC, title: '[R-30 TEST] Job', description: 'Backend engineer.',
    required_skills: ['python'], preferred_skills: [], status: 'published', created_at: db.stamp(),
  };
  db.tables.jobs.push(job);
  const application = { id: randomUUID(), candidate_id: candidateId, job_id: job.id, status: 'submitted', submitted_at: db.stamp() };
  db.tables.applications.push(application);
  const resume = {
    id: randomUUID(), candidate_id: candidateId, skills: ['python'], experience: [], projects: [],
    file_name: 'cv.pdf', created_at: db.stamp(), ...resumeFields,
  };
  db.tables.resumes.push(resume);
  db.tables.scores.push({
    id: randomUUID(), resume_id: resume.id, candidate_id: candidateId, job_id: job.id, composite_score: 50,
    subscores: {}, weights: {}, explanation: null, evidence_limited: true, created_at: db.stamp(),
  });
  return { candidateId, applicationId: application.id };
};

const result = async ({ candidateId, applicationId }) => {
  const res = await fetch(`${base}/api/applications/${applicationId}/result`, { headers: { 'X-Test-User': candidateId } });
  const text = await res.text();
  assert.equal(res.status, 200, text);
  return JSON.parse(text).score;
};

test('a row parsed by nlp-engine 2.1.0: every stored link and the education objects reach the result', async () => {
  const links = [
    'https://github.com/example-plinkwell',
    'https://www.linkedin.com/in/example-priya-linkwell',
    'https://plinkwell.example.com/portfolio',
  ];
  const score = await result(seed({
    contact: { candidate_name: 'Priya Linkwell', github: links[0], linkedin: links[1] },
    project_links: links,
    education: [EDUCATION_OBJECT],
    parser_version: 'nlp-engine@2.1.0',
  }));
  assert.deepEqual(score.candidate.links, links);
  assert.equal(score.candidate.github, links[0]);
  assert.equal(score.candidate.linkedin, links[1]);
  assert.deepEqual(score.education, [EDUCATION_OBJECT]);
});

test('a row parsed before 2.1.0: GitHub and LinkedIn only, education strings as they are', async () => {
  const score = await result(seed({
    contact: { candidate_name: 'Maya Okafor', github: 'github.com/example-mokafor', linkedin: 'linkedin.com/in/example-maya-okafor' },
    project_links: ['github.com/example-mokafor', 'linkedin.com/in/example-maya-okafor'],
    education: ['B.Tech in Computer Science - Example Institute of Technology (2018 - 2022)'],
    parser_version: 'nlp-engine@2.0.0',
  }));
  assert.deepEqual(score.candidate.links, ['github.com/example-mokafor', 'linkedin.com/in/example-maya-okafor']);
  assert.deepEqual(score.education, ['B.Tech in Computer Science - Example Institute of Technology (2018 - 2022)']);
});

test('a row without project_links, or with blank entries, gives a list of addresses only, never null', async () => {
  const none = await result(seed({ contact: {}, education: [] }));
  assert.deepEqual(none.candidate.links, []);
  const blanks = await result(seed({ contact: {}, education: [], project_links: ['  ', 'example.dev/me '] }));
  assert.deepEqual(blanks.candidate.links, ['example.dev/me']);
});
