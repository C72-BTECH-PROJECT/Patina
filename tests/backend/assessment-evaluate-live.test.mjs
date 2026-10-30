// T-0025 live evaluate guards: authenticated input validation for
// POST /api/assessment/evaluate. No LLM call and no writes — malformed or
// unknown inputs are rejected before the assessment service is touched.
//
// Requires: -Live suite credentials in tests\.env and the assessments
// migration applied. Run with:
//   $env:BACKEND_BASE_URL='http://localhost:5100'
//   node --test tests/backend/assessment-evaluate-live.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backendBaseUrl } from './lib/env.mjs';
import { login, api } from './lib/session.mjs';
import { liveConfig } from './lib/testdb.mjs';

const BASE = backendBaseUrl();
const cfg = liveConfig();

test('evaluate input validation (candidate session)', async (t) => {
  if (cfg.missing.length) {
    t.skip(`tests/.env missing: ${cfg.missing.join(', ')}`);
    return;
  }
  const cookie = await login(cfg.candidateUsername, cfg.candidatePassword);

  await t.test('missing assessmentId -> 400', async () => {
    const { status, body } = await api(cookie, 'POST', '/api/assessment/evaluate', { answers: [] });
    assert.equal(status, 400);
    assert.ok(body?.message);
  });

  await t.test('empty answers -> 400', async () => {
    const { status, body } = await api(cookie, 'POST', '/api/assessment/evaluate', {
      assessmentId: '00000000-0000-0000-0000-000000000000',
      answers: [],
    });
    assert.equal(status, 400);
    assert.ok(body?.message);
  });

  await t.test('malformed answer entries -> 400', async () => {
    const { status } = await api(cookie, 'POST', '/api/assessment/evaluate', {
      assessmentId: '00000000-0000-0000-0000-000000000000',
      answers: [{ question_id: 'q1', response: '   ' }],
    });
    assert.equal(status, 400);
  });

  await t.test('unknown assessmentId -> 404 (no brute-forceable 500)', async () => {
    const { status, body } = await api(cookie, 'POST', '/api/assessment/evaluate', {
      assessmentId: '00000000-0000-0000-0000-000000000000',
      answers: [{ question_id: 'q1', response: 'A' }],
    });
    assert.equal(status, 404);
    assert.ok(body?.message);
  });
});
