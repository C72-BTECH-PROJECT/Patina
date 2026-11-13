// R-11 (offline), closing a gap left by R-10: the Y1 condition holds even when
// scoreApplication itself throws, and when starting the background assessment
// preparation throws. Apply still answers 201 with the saved application.
//
// Uses node:test module mocks, so it needs the flag (backend/package.json and
// tests/run-suite.ps1 pass it):
//   node --test --experimental-test-module-mocks tests/backend/apply-scoring-throws.test.mjs
import { after, before, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_DIR, TESTS_DIR } from './lib/env.mjs';
import { startStub } from './lib/stub-server.mjs';
import { createSupabaseStub, fakeServiceKey } from './lib/supabase-stub.mjs';

const backendHref = (...parts) => `file:///${join(REPO_DIR, 'backend', ...parts).replace(/\\/g, '/')}`;
const express = createRequire(join(REPO_DIR, 'backend', 'package.json'))('express');
const F1 = readFileSync(join(TESTS_DIR, 'fixtures', 'f1_dev_github.pdf'));

const db = createSupabaseStub();
let supa;
let envDir;
let server;
let base;
let scoringCalls = 0;
let triggerCalls = [];
let triggerThrows = false;

before(async () => {
  if (typeof mock.module !== 'function') throw new Error('run with --experimental-test-module-mocks');
  supa = await startStub({ handler: db.handler });
  envDir = mkdtempSync(join(tmpdir(), 'patina-r11-throw-'));
  const envFile = join(envDir, 'backend.env');
  writeFileSync(envFile, [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${fakeServiceKey()}`,
    'SUPABASE_ANON_KEY=stub-anon-key',
    'SESSION_SECRET=r11-offline-test-secret-r11-offline',
    'SUPABASE_TIMEOUT_MS=3000',
  ].join('\n'));
  process.env.BACKEND_ENV_FILE = envFile;

  // Forced failures, before jobs.controller.js is loaded.
  mock.module(backendHref('Services', 'scoringPipeline.js'), {
    namedExports: {
      scoreApplication: async () => { scoringCalls += 1; throw new Error('R-11 forced: scoreApplication threw'); },
      // Same contract as the real one (scoringPipeline.js).
      scoringSummary: (r) => ({ status: r?.status === 'scored' ? 'scored' : 'failed', reason: r?.status === 'scored' ? null : (r?.reason || 'internal_error') }),
    },
  });
  mock.module(backendHref('Services', 'assessmentService.js'), {
    namedExports: {
      prepareOnApply: () => true,
      triggerPreparation: (...args) => {
        triggerCalls.push(args);
        if (triggerThrows) throw new Error('R-11 forced: preparation trigger threw');
      },
    },
  });

  const errors = await import(backendHref('Middlewares', 'errorHandler.js'));
  const requestId = await import(backendHref('Middlewares', 'requestId.js'));
  const jobsRoutes = (await import(backendHref('Routes', 'jobs.routes.js'))).default;
  const app = express();
  app.use(requestId.requestIdMiddleware);
  app.use(errors.errorContract);
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { userId: req.get('X-Test-User'), role: 'CANDIDATE' }; next(); });
  app.use('/api/jobs', jobsRoutes);
  app.use(errors.notFoundHandler);
  app.use(errors.errorHandler);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  mock.restoreAll();
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  await supa?.close();
  if (envDir) rmSync(envDir, { recursive: true, force: true });
});

const ready = () => {
  const c = `11111111-1111-4111-8111-${String(Math.floor(Math.random() * 1e12)).padStart(12, '0')}`;
  const job = { id: randomUUID(), recruiter_id: randomUUID(), title: 'R-11', description: 'x', required_skills: ['python'], preferred_skills: [], status: 'published', created_at: db.stamp() };
  db.tables.jobs.push(job);
  db.store.set(`candidates/${c}/resume.pdf`, { bytes: F1, contentType: 'application/pdf', updated_at: db.stamp() });
  return { c, job };
};
const apply = async (c, jobId) => {
  const res = await fetch(`${base}/api/jobs/${jobId}/apply`, { method: 'POST', headers: { 'X-Test-User': c } });
  const text = await res.text();
  return { res, text, body: JSON.parse(text) };
};

test('scoreApplication throws inside apply -> still 201, application saved, scoring failed internal_error; preparation triggered after', async () => {
  const { c, job } = ready();
  const calls = scoringCalls;
  const r = await apply(c, job.id);
  assert.equal(scoringCalls, calls + 1, 'the forced scoreApplication ran');
  assert.equal(r.res.status, 201, r.text);
  assert.deepEqual(r.body.scoring, { status: 'failed', reason: 'internal_error' });
  assert.ok(!r.text.includes('forced'), 'the exception text reached the client');
  const saved = db.tables.applications.find((a) => a.candidate_id === c && a.job_id === job.id);
  assert.ok(saved, 'the application row exists');
  assert.equal(r.body.id, saved.id);
  assert.deepEqual(triggerCalls.at(-1).slice(0, 2), [c, job.id], 'preparation was triggered for this candidate and job');
});

test('the preparation trigger throws -> apply is still 201 with the same body shape', async () => {
  const { c, job } = ready();
  triggerThrows = true;
  try {
    const r = await apply(c, job.id);
    assert.equal(r.res.status, 201, r.text);
    assert.deepEqual(r.body.scoring, { status: 'failed', reason: 'internal_error' });
    assert.ok(db.tables.applications.find((a) => a.candidate_id === c && a.job_id === job.id));
  } finally {
    triggerThrows = false;
  }
});
