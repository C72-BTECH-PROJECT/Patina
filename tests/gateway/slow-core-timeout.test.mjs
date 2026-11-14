// R-33 (offline): a gateway timeout is not a failure when the work completes.
// A slow fake core keeps working after the gateway's proxy timeout; the gateway answers
// 504 JSON that says the request may still complete, and the timeouts themselves are
// unchanged (only the 504 body is clearer). In-process gateway, loopback stub only.
//
//   node --test tests/gateway/slow-core-timeout.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { startStub, json } from '../backend/lib/stub-server.mjs';
import { createApp, loadConfig } from '../../gateway/index.js';

const CORE_WORK_MS = 2000;
const SESSION = { Cookie: 'patina_session=r33-session', 'Content-Type': 'application/json' };

const listen = (app) => new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A core that answers the session check at once and does CORE_WORK_MS of work on anything else. */
async function slowCore() {
  const finished = [];
  const stub = await startStub({
    handler: (req, res, rec) => {
      if (rec.path === '/api/auth/session') return json(res, 200, { userId: 'u-r33', role: 'CANDIDATE' });
      const delay = rec.path === '/api/fast' ? 300 : CORE_WORK_MS;
      setTimeout(() => {
        finished.push(rec.path); // the work completes whether or not anyone still waits
        if (!res.destroyed && !res.writableEnded) json(res, 201, { id: 'app-r33', saved: true });
      }, delay);
      return undefined;
    },
  });
  return { stub, finished };
}

async function post(srv, path) {
  const t0 = Date.now();
  const r = await fetch(`http://127.0.0.1:${srv.address().port}${path}`, { method: 'POST', headers: SESSION, body: '{}' });
  const text = await r.text();
  return { r, body: JSON.parse(text), elapsed: Date.now() - t0 };
}

const assertStillCompleting504 = ({ r, body, elapsed }, label) => {
  assert.equal(r.status, 504, `${label}: ${JSON.stringify(body)}`);
  assert.match(r.headers.get('content-type') || '', /application\/json/);
  assert.equal(body.error, 'upstream_timeout');
  assert.equal(body.service, 'core');
  assert.equal(body.may_still_complete, true, `${label}: the body says the work may still complete`);
  assert.match(body.message, /may still be completing/);
  assert.doesNotMatch(body.message, /failed/i);
  assert.equal(body.requestId, r.headers.get('x-request-id'));
  assert.ok(elapsed >= 900 && elapsed < CORE_WORK_MS - 200, `${label}: answered after ${elapsed} ms, expected about 1000`);
};

test('R-33: slow core on apply with a 1 s proxy timeout -> 504 JSON (may still complete); core finishes the work anyway', async () => {
  const { stub, finished } = await slowCore();
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url, PROXY_TIMEOUT_MS: '1000' });
  const srv = await listen(app);
  try {
    const path = '/api/jobs/11111111-1111-4111-8111-000000000033/apply';
    const res = await post(srv, path);
    assertStillCompleting504(res, 'apply');
    assert.ok(stub.requests.some((q) => q.path === path), 'the apply reached core');
    await sleep(CORE_WORK_MS - res.elapsed + 300);
    assert.ok(finished.includes(path), 'core completed the apply after the gateway answered 504');
  } finally {
    srv.closeAllConnections?.();
    await new Promise((r) => srv.close(() => r()));
    await stub.close();
  }
});

test('R-33: slow core on evaluate with a 1 s evaluate timeout -> 504 JSON; a fast answer inside the timeout passes through', async () => {
  const { stub } = await slowCore();
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url, PROXY_TIMEOUT_EVALUATE_MS: '1000' });
  const srv = await listen(app);
  try {
    assertStillCompleting504(await post(srv, '/api/assessment/evaluate'), 'evaluate');
    const fast = await post(srv, '/api/fast');
    assert.equal(fast.r.status, 201, 'an answer inside the timeout is passed through');
    assert.deepEqual(fast.body, { id: 'app-r33', saved: true });
  } finally {
    srv.closeAllConnections?.();
    await new Promise((r) => srv.close(() => r()));
    await stub.close();
  }
});

test('R-33: the proxy timeouts themselves are unchanged (60 s, 310 s generate, 130 s evaluate)', () => {
  const cfg = loadConfig({});
  assert.equal(cfg.PROXY_TIMEOUT_MS, '60000');
  assert.equal(cfg.PROXY_TIMEOUT_GENERATE_MS, '310000');
  assert.equal(cfg.PROXY_TIMEOUT_EVALUATE_MS, '130000');
  const env = loadConfig({ PROXY_TIMEOUT_MS: '1500', PROXY_TIMEOUT_EVALUATE_MS: '1500' });
  assert.equal(env.PROXY_TIMEOUT_MS, '1500', 'the short-timeout e2e run sets these through the environment');
  assert.equal(env.PROXY_TIMEOUT_EVALUATE_MS, '1500');
});
