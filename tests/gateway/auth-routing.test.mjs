import test from 'node:test';
import assert from 'node:assert/strict';
import { startStub, json, hang } from '../backend/lib/stub-server.mjs';
import { createApp, loadConfig } from '../../gateway/index.js';

// R-03: every gateway error is { error, message, requestId } plus any existing fields.
const assertContract = (body, res, expected) => {
  assert.equal(typeof body.message, 'string');
  assert.ok(body.message.length > 0);
  assert.equal(body.requestId, res.headers.get('x-request-id'));
  const { message: _m, requestId: _r, ...rest } = body;
  assert.deepEqual(rest, expected);
};

const ALLOWLIST = [
  { method: 'POST', path: '/api/auth/signup' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/logout' },
  { method: 'POST', path: '/api/auth/resend-confirmation' },
  { method: 'POST', path: '/api/auth/request-password-reset' },
  { method: 'POST', path: '/api/auth/reset-password' },
  { method: 'GET', path: '/api/health' },
];

test('allowlist entries reach core', async () => {
  const stub = await startStub({ handler: (req, res) => json(res, 200, { ok: true, path: req.url }) });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url });
  const srv = app.listen(0);
  const port = srv.address().port;
  for (const e of ALLOWLIST) {
    const r = await fetch(`http://localhost:${port}${e.path}`, { method: e.method });
    assert.notEqual(r.status, 401, `${e.method} ${e.path} got 401`);
  }
  // non-API GET also reaches static-ish (proxy); check /health gateway
  const rh = await fetch(`http://localhost:${port}/health`);
  assert.notEqual(rh.status, 401);
  await stub.close(); srv.close();
});

test('everything else needs a session', async () => {
  const stub = await startStub({ handler: (req, res) => json(res, 200, { ok: true }) });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url });
  const srv = app.listen(0);
  const port = srv.address().port;
  const before = stub.requests.length;
  const r = await fetch(`http://localhost:${port}/api/nope`);
  assert.equal(r.status, 401);
  const body = await r.json();
  assertContract(body, r, { source: 'gateway', error: 'unauthorized' });
  assert.equal(stub.requests.length, before, 'core saw a request');
  // protected route with no cookie
  const r2 = await fetch(`http://localhost:${port}/api/jobs`);
  assert.equal(r2.status, 401);
  await stub.close(); srv.close();
});

test('forward-auth sends only session cookie', async () => {
  const stub = await startStub({ handler: (req, res) => json(res, 200, { ok: true }) });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url });
  const srv = app.listen(0);
  const port = srv.address().port;
  await fetch(`http://localhost:${port}/api/jobs`, {
    headers: {
      Cookie: 'patina_session=abc; other=xyz; third=123',
      Authorization: 'Bearer token',
      'X-Request-ID': 'req-1',
    },
  });
  // R-04: the pre-check is core's in-memory GET /api/auth/session (not /api/auth/me).
  const checkReq = stub.requests.find((r) => r.path === '/api/auth/session');
  assert.ok(checkReq, 'auth check not made');
  assert.equal(stub.requests.some((r) => r.path === '/api/auth/me'), false, 'pre-check still calls /api/auth/me');
  assert.equal(checkReq.headers.cookie, 'patina_session=abc');
  assert.equal(checkReq.headers.authorization, undefined);
  // Only the session cookie and the request id are forwarded.
  assert.equal(checkReq.headers['x-request-id'], 'req-1');
  await stub.close(); srv.close();
});

test('hung auth check fails closed', async () => {
  const stub = await startStub({ handler: (req, res) => { if (req.url === '/api/auth/session') hang(); else json(res, 200, { ok: true }); } });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url });
  const srv = app.listen(0);
  const port = srv.address().port;
  const t0 = Date.now();
  const r = await fetch(`http://localhost:${port}/api/jobs`, { headers: { Cookie: 'patina_session=abc' } });
  const elapsed = Date.now() - t0;
  assert.equal(r.status, 503);
  const body = await r.json();
  assertContract(body, r, { error: 'auth_unavailable' });
  assert.ok(elapsed < 2500, `took ${elapsed}ms`);
  await stub.close(); srv.close();
});

test('core down', async () => {
  // point at a closed port
  const app = createApp({ ...loadConfig({}), CORE_URL: 'http://localhost:1' });
  const srv = app.listen(0);
  const port = srv.address().port;
  const r1 = await fetch(`http://localhost:${port}/api/auth/login`, { method: 'POST' });
  assert.equal(r1.status, 502);
  const b1 = await r1.json();
  assertContract(b1, r1, { error: 'upstream_unavailable', service: 'core' });
  const r2 = await fetch(`http://localhost:${port}/api/jobs`, { headers: { Cookie: 'patina_session=abc' } });
  assert.equal(r2.status, 503);
  const b2 = await r2.json();
  assertContract(b2, r2, { error: 'auth_unavailable' });
  srv.close();
});

test('request id is kept, replaced or echoed', async () => {
  const stub = await startStub({ handler: (req, res) => { res.setHeader('X-Request-ID', req.headers['x-request-id']); json(res, 200, { ok: true }); } });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url });
  const srv = app.listen(0);
  const port = srv.address().port;
  // valid
  const r1 = await fetch(`http://localhost:${port}/api/health`, { headers: { 'X-Request-ID': 'abc-123' } });
  assert.equal(r1.headers.get('x-request-id'), 'abc-123');
  // invalid
  const r2 = await fetch(`http://localhost:${port}/api/health`, { headers: { 'X-Request-ID': 'bad id!' } });
  const id2 = r2.headers.get('x-request-id');
  assert.ok(id2 && id2 !== 'bad id!');
  // none
  const r3 = await fetch(`http://localhost:${port}/api/health`);
  const id3 = r3.headers.get('x-request-id');
  assert.ok(id3);
  await stub.close(); srv.close();
});