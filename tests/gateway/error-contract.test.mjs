// R-03 (offline): the gateway's JSON error contract, proxy timeouts, security
// headers, request log line and health (REBUILD/DECISIONS.md §9, §10).
// In-process gateway against loopback stubs; nothing else is contacted.
//
//   node --test tests/gateway/error-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startStub, json, hang } from '../backend/lib/stub-server.mjs';
import { createApp, loadConfig } from '../../gateway/index.js';
import { errorContract, errorHandler, requestIdMiddleware } from '../../gateway/requestId.js';

const GATEWAY_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'gateway');
const express = createRequire(path.join(GATEWAY_DIR, 'package.json'))('express');

const listen = (app) => new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const closeAll = async (srv, ...stubs) => {
  srv?.closeAllConnections?.();
  await new Promise((r) => (srv ? srv.close(() => r()) : r()));
  await Promise.all(stubs.map((s) => s?.close()));
};

const assertContract = (body, res, status, error) => {
  assert.equal(res.status, status);
  assert.match(res.headers.get('content-type') || '', /application\/json/);
  assert.equal(body.error, error);
  assert.equal(typeof body.message, 'string');
  assert.ok(body.message.length > 0);
  assert.equal(body.requestId, res.headers.get('x-request-id'));
};

test('default CORE_URL is the literal loopback address', () => {
  assert.equal(loadConfig({}).CORE_URL, 'http://127.0.0.1:5001');
});

test('proxy timeout -> 504 JSON upstream_timeout', async () => {
  const stub = await startStub({ handler: () => hang() });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url, PROXY_TIMEOUT_MS: '300' });
  const srv = await listen(app);
  try {
    const t0 = Date.now();
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/auth/login`, { method: 'POST' });
    const elapsed = Date.now() - t0;
    const body = await r.json();
    assertContract(body, r, 504, 'upstream_timeout');
    assert.equal(body.service, 'core');
    assert.ok(elapsed >= 250 && elapsed < 3000, `took ${elapsed} ms`);
  } finally {
    await closeAll(srv, stub);
  }
});

test('assessment generation gets its own, longer proxy timeout', async () => {
  // Session check answers at once; the generate call itself hangs.
  const stub = await startStub({
    handler: (req, res) => (req.url === '/api/auth/session' ? json(res, 200, { userId: 'u1', role: 'CANDIDATE' }) : hang()),
  });
  const app = createApp({
    ...loadConfig({}), CORE_URL: stub.url, PROXY_TIMEOUT_MS: '200', PROXY_TIMEOUT_GENERATE_MS: '900',
  });
  const srv = await listen(app);
  try {
    const t0 = Date.now();
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/assessment/generate`, {
      method: 'POST', headers: { Cookie: 'patina_session=abc', 'Content-Type': 'application/json' }, body: '{}',
    });
    const elapsed = Date.now() - t0;
    const body = await r.json();
    assertContract(body, r, 504, 'upstream_timeout');
    assert.ok(elapsed >= 850, `generate used the short timeout (${elapsed} ms)`);
  } finally {
    await closeAll(srv, stub);
  }
});

test('core down -> 502 JSON upstream_unavailable', async () => {
  const app = createApp({ ...loadConfig({}), CORE_URL: 'http://127.0.0.1:1' });
  const srv = await listen(app);
  try {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/auth/login`, { method: 'POST' });
    assertContract(await r.json(), r, 502, 'upstream_unavailable');
  } finally {
    await closeAll(srv);
  }
});

test('error handler: a thrown error -> 500 JSON, no exception text', async () => {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(errorContract);
  app.get('/boom', () => { throw new Error('SECRET-INTERNAL-DETAIL at /srv/x.js:1'); });
  app.use(errorHandler);
  const srv = await listen(app);
  try {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/boom`);
    const text = await r.text();
    const body = JSON.parse(text);
    assertContract(body, r, 500, 'internal_error');
    assert.ok(!text.includes('SECRET-INTERNAL-DETAIL') && !/"stack"/.test(text) && !/\n\s+at /.test(text), text);
  } finally {
    await closeAll(srv);
  }
});

test('unknown non-API route that nothing serves -> JSON 404', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<html>index</html>');
  const app = createApp({ ...loadConfig({}), FRONTEND_BUILD_DIR: dir });
  const srv = await listen(app);
  try {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/no/such/thing`, { method: 'POST' });
    assertContract(await r.json(), r, 404, 'not_found');
  } finally {
    await closeAll(srv);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rate-limit answer follows the contract', async () => {
  // R-04: only failed logins count toward the limit.
  const stub = await startStub({ handler: (req, res) => json(res, 401, { error: 'unauthorized' }) });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url, AUTH_RATE_LIMIT_MAX: '1', GLOBAL_RATE_LIMIT_MAX: '1000' });
  const srv = await listen(app);
  try {
    const url = `http://127.0.0.1:${srv.address().port}/api/auth/login`;
    await fetch(url, { method: 'POST' });
    const r = await fetch(url, { method: 'POST' });
    assertContract(await r.json(), r, 429, 'too_many_requests');
  } finally {
    await closeAll(srv, stub);
  }
});

test('security headers on, x-powered-by off (gateway answers and proxied answers)', async () => {
  const stub = await startStub({ handler: (req, res) => json(res, 200, { ok: true }, { 'X-Powered-By': 'Express' }) });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url, NLP_URL: stub.url, GITHUB_EVIDENCE_URL: stub.url, ASSESSMENT_URL: stub.url });
  const srv = await listen(app);
  try {
    const base = `http://127.0.0.1:${srv.address().port}`;
    for (const r of [await fetch(`${base}/health`), await fetch(`${base}/api/jobs`)]) {
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(r.headers.get('content-security-policy'), 'no CSP header');
      assert.ok(r.headers.get('x-frame-options'), 'no X-Frame-Options header');
      await r.arrayBuffer();
    }
    const own = await fetch(`${base}/health`);
    assert.equal(own.headers.get('x-powered-by'), null);
  } finally {
    await closeAll(srv, stub);
  }
});

test('one log line per request: id, method, path, status, latency; no query string or cookie', async () => {
  const stub = await startStub({ handler: (req, res) => json(res, 200, { ok: true }) });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url });
  const srv = await listen(app);
  const lines = [];
  const original = console.log;
  console.log = (...args) => { lines.push(args.join(' ')); };
  try {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/auth/reset-password?token=SECRET-TOKEN`, {
      method: 'POST', headers: { 'X-Request-ID': 'log-test-1', Cookie: 'patina_session=SECRET-COOKIE' },
    });
    await r.arrayBuffer();
    await new Promise((res) => setTimeout(res, 50));
  } finally {
    console.log = original;
    await closeAll(srv, stub);
  }
  const mine = lines.filter((l) => l.includes('request_id=log-test-1'));
  assert.equal(mine.length, 1, `expected one line, got ${JSON.stringify(lines)}`);
  assert.match(mine[0], /^\[gateway\] request_id=log-test-1 POST \/api\/auth\/reset-password 200 \d+ms$/);
  assert.ok(!lines.join('\n').includes('SECRET-TOKEN') && !lines.join('\n').includes('SECRET-COOKIE'));
});

test('health: core degraded -> 200 degraded; core down -> 503 with the contract', async () => {
  const core = await startStub({ handler: (req, res) => json(res, 200, { status: 'degraded', checks: { database: 'unavailable' } }) });
  const up = await startStub({ handler: (req, res) => json(res, 200, { status: 'ok' }) });
  const app = createApp({ ...loadConfig({}), CORE_URL: core.url, NLP_URL: up.url, GITHUB_EVIDENCE_URL: up.url, ASSESSMENT_URL: up.url });
  const srv = await listen(app);
  try {
    const base = `http://127.0.0.1:${srv.address().port}`;
    let r = await fetch(`${base}/health`);
    let b = await r.json();
    assert.equal(r.status, 200);
    assert.equal(b.status, 'degraded');
    assert.equal(b.services.core, false);
    assert.equal(b.services.nlp, true);
    await core.close();
    r = await fetch(`${base}/health`);
    b = await r.json();
    assert.equal(r.status, 503);
    assert.equal(b.status, 'error');
    assert.equal(b.services.core, false);
    assertContract(b, r, 503, 'core_unavailable');
  } finally {
    await closeAll(srv, up);
  }
});
