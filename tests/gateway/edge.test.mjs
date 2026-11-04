import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startStub, json } from '../backend/lib/stub-server.mjs';
import { createApp, loadConfig } from '../../gateway/index.js';

test('health aggregates core, nlp, github-evidence, assessment-service', async () => {
  const core = await startStub({ handler: (req, res) => json(res, 200, { status: 'ok' }) });
  const nlp = await startStub({ handler: (req, res) => json(res, 200, { ok: true }) });
  const gh = await startStub({ handler: (req, res) => json(res, 200, { ok: true }) });
  const asm = await startStub({ handler: (req, res) => json(res, 200, { ok: true }) });
  const app = createApp({ ...loadConfig({}), CORE_URL: core.url, NLP_URL: nlp.url, GITHUB_EVIDENCE_URL: gh.url, ASSESSMENT_URL: asm.url });
  const srv = app.listen(0);
  const port = srv.address().port;
  // all up
  let r = await fetch(`http://localhost:${port}/health`);
  let b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.status, 'ok');
  // nlp down
  await nlp.close();
  r = await fetch(`http://localhost:${port}/health`);
  b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.status, 'degraded');
  // core down -> 503
  await core.close();
  r = await fetch(`http://localhost:${port}/health`);
  assert.equal(r.status, 503);
  await gh.close(); await asm.close(); srv.close();
});

test('login limit', async () => {
  const stub = await startStub({ handler: (req, res) => json(res, 200, { ok: true }) });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url, AUTH_RATE_LIMIT_MAX: '2', GLOBAL_RATE_LIMIT_MAX: '1000' });
  const srv = app.listen(0);
  const port = srv.address().port;
  // use 127.0.0.1
  for (let i = 0; i < 2; i++) {
    const r = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: 'POST' });
    assert.notEqual(r.status, 429);
  }
  const r3 = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: 'POST' });
  assert.equal(r3.status, 429);
  await stub.close(); srv.close();
});

test('cors allows only the frontend', async () => {
  const app = createApp({ ...loadConfig({}), FRONTEND_URL: 'http://localhost:3000' });
  const srv = app.listen(0);
  const port = srv.address().port;
  const r = await fetch(`http://localhost:${port}/api/health`, { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(r.headers.get('access-control-allow-credentials'), 'true');
  const r2 = await fetch(`http://localhost:${port}/api/health`, { headers: { Origin: 'http://evil.com' } });
  assert.equal(r2.headers.get('access-control-allow-origin'), null);
  // preflight
  const rp = await fetch(`http://localhost:${port}/api/health`, { method: 'OPTIONS', headers: { Origin: 'http://evil.com', 'Access-Control-Request-Method': 'GET' } });
  assert.notEqual(rp.status, 401);
  srv.close();
});

test('auth/me is never limited', async () => {
  const stub = await startStub({ handler: (req, res) => json(res, 401, { source: 'gateway' }) });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url, GLOBAL_RATE_LIMIT_MAX: '2' });
  const srv = app.listen(0);
  const port = srv.address().port;
  // exhaust global on other route
  for (let i = 0; i < 3; i++) await fetch(`http://localhost:${port}/api/jobs`);
  const r = await fetch(`http://localhost:${port}/api/auth/me`);
  assert.notEqual(r.status, 429);
  await stub.close(); srv.close();
});

test('serves the build', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<html>index</html>');
  fs.mkdirSync(path.join(dir, 'static'));
  fs.writeFileSync(path.join(dir, 'static', 'x.js'), 'console.log(1)');
  const app = createApp({ ...loadConfig({}), FRONTEND_BUILD_DIR: dir });
  const srv = app.listen(0);
  const port = srv.address().port;
  const r1 = await fetch(`http://localhost:${port}/`);
  assert.equal(await r1.text(), '<html>index</html>');
  const r2 = await fetch(`http://localhost:${port}/candidate/jobs`);
  assert.equal(await r2.text(), '<html>index</html>');
  const r3 = await fetch(`http://localhost:${port}/static/x.js`);
  assert.match(await r3.text(), /console.log/);
  srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('non-api paths 404 without build dir', async () => {
  const app = createApp({ ...loadConfig({}) });
  const srv = app.listen(0);
  const port = srv.address().port;
  const r = await fetch(`http://localhost:${port}/some/path`);
  assert.equal(r.status, 404);
  srv.close();
});