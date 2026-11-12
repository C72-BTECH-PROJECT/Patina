// R-04 (offline): the gateway's auth rate limits and session pre-check
// (REBUILD/DECISIONS.md §2). In-process gateway in front of a loopback core stub.
//
//   node --test tests/gateway/auth-limits.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { startStub, json } from '../backend/lib/stub-server.mjs';
import { createApp, loadConfig } from '../../gateway/index.js';

const listen = (app) => new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const closeAll = async (srv, ...stubs) => {
  srv?.closeAllConnections?.();
  await new Promise((r) => (srv ? srv.close(() => r()) : r()));
  await Promise.all(stubs.map((s) => s?.close()));
};

// Core stub: a login succeeds when the client sends X-Test-Outcome: ok, otherwise 401.
const coreStub = () => startStub({
  handler: (req, res) => {
    if (req.headers['x-test-outcome'] === 'ok') return json(res, 200, { user: { id: 'u1' } });
    return json(res, 401, { error: 'unauthorized', message: 'Invalid username or password.' });
  },
});

const gateway = async (core, extra = {}) => {
  const app = createApp({ ...loadConfig({}), CORE_URL: core.url, GLOBAL_RATE_LIMIT_MAX: '1000', ...extra });
  const srv = await listen(app);
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
};

const login = (base, path = '/api/auth/login', ok = false) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(ok ? { 'X-Test-Outcome': 'ok' } : {}) },
    body: '{}',
  }).then(async (r) => { await r.arrayBuffer(); return r.status; });

test('30 successful logins from one IP -> no 429 (successes do not count)', async () => {
  const core = await coreStub();
  const { srv, base } = await gateway(core);
  try {
    for (let i = 0; i < 30; i += 1) assert.equal(await login(base, '/api/auth/login', true), 200, `login ${i + 1}`);
    // The failure budget is still whole: 20 failures are answered by core.
    for (let i = 0; i < 20; i += 1) assert.equal(await login(base), 401, `failure ${i + 1}`);
  } finally {
    await closeAll(srv, core);
  }
});

test('21 failed logins -> the 21st is 429', async () => {
  const core = await coreStub();
  const { srv, base } = await gateway(core);
  try {
    for (let i = 0; i < 20; i += 1) assert.equal(await login(base), 401, `failure ${i + 1}`);
    assert.equal(await login(base), 429);
    // A correct password is refused too while the IP is limited.
    assert.equal(await login(base, '/api/auth/login', true), 429);
  } finally {
    await closeAll(srv, core);
  }
});

test('/api/auth/Login and /api/auth/login/ count toward the same limit', async () => {
  const core = await coreStub();
  const { srv, base } = await gateway(core);
  try {
    for (let i = 0; i < 10; i += 1) assert.equal(await login(base, '/api/auth/login'), 401);
    for (let i = 0; i < 5; i += 1) assert.equal(await login(base, '/api/auth/Login'), 401);
    for (let i = 0; i < 5; i += 1) assert.equal(await login(base, '/api/auth/LOGIN/'), 401);
    assert.equal(await login(base, '/api/auth/login'), 429);
    assert.equal(await login(base, '/api/auth/Login'), 429);
    assert.equal(await login(base, '/api/auth/login/'), 429);
    // signup shares the counter (same limiter), whatever its case.
    assert.equal(await login(base, '/api/auth/SignUp'), 429);
  } finally {
    await closeAll(srv, core);
  }
});

test('password-reset requests count even when they succeed (5 per window)', async () => {
  const core = await startStub({ handler: (req, res) => json(res, 200, { message: 'generic' }) });
  const { srv, base } = await gateway(core);
  try {
    for (let i = 0; i < 5; i += 1) assert.equal(await login(base, '/api/auth/request-password-reset'), 200);
    assert.equal(await login(base, '/api/auth/Request-Password-Reset'), 429);
  } finally {
    await closeAll(srv, core);
  }
});

test('the pre-check calls GET /api/auth/session with only the cookie and request id', async () => {
  const core = await startStub({
    handler: (req, res) => (req.url === '/api/auth/session'
      ? json(res, 200, { userId: 'u1', role: 'CANDIDATE' })
      : json(res, 200, { ok: true })),
  });
  const { srv, base } = await gateway(core);
  try {
    const r = await fetch(`${base}/api/jobs`, { headers: { Cookie: 'patina_session=abc; other=1', 'X-Request-ID': 'pre-1' } });
    assert.equal(r.status, 200);
    const paths = core.requests.map((q) => q.path);
    assert.deepEqual(paths, ['/api/auth/session', '/api/jobs']);
    assert.equal(core.requests[0].headers.cookie, 'patina_session=abc');
    assert.equal(core.requests[0].headers['x-request-id'], 'pre-1');
  } finally {
    await closeAll(srv, core);
  }
});
