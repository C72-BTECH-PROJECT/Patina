// R-04 (offline): login, the in-memory session check, exact username lookup and
// the SESSION_SECRET start rule (REBUILD/DECISIONS.md §2).
//
// Nothing leaves loopback and backend/.env is never read:
//   - the service client points at a local PostgREST/GoTrue stub (BACKEND_ENV_FILE);
//   - Config/supabaseAuth.js (which would load backend/.env) is replaced, through a
//     module resolve hook, by a fake whose signInWithPassword is local.
// The test asserts the stub is in use before anything runs.
//
//   node --test tests/backend/auth-session.test.mjs
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire, registerHooks } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_DIR } from './lib/env.mjs';
import { startStub, json } from './lib/stub-server.mjs';

const backendUrl = (...parts) => pathToFileURL(join(REPO_DIR, 'backend', ...parts));
const requireBackend = createRequire(join(REPO_DIR, 'backend', 'package.json'));
const express = requireBackend('express');
const session = requireBackend('express-session');

const TEST_SECRET = 'r04-offline-test-session-secret-0123456789';
const PASSWORD = 'right-password';

// Fake profiles table. `a_b` exists; `aXb` would match an unescaped `a_b` pattern.
let profiles = [];
const setProfiles = (names) => {
  profiles = names.map((username, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i + 1}`,
    username,
    role: 'candidate',
    is_suspended: false,
    first_name: 'Test',
    last_name: username,
  }));
};

let delayMs = 0;
let supa;
let workDir;
let mods;
let core;
let coreBase;
let gw;
let gwBase;

// PostgREST LIKE semantics: `\` escapes, `%` and `*` (PostgREST alias) any run, `_` one char.
const likeToRegex = (pattern) => {
  let re = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) { i += 1; re += pattern[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    else if (c === '%' || c === '*') re += '.*';
    else if (c === '_') re += '.';
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'is');
};

const supabaseHandler = (req, res) => {
  const reply = () => {
    const url = new URL(req.url, 'http://stub');
    if (url.pathname.startsWith('/auth/v1/admin/users/')) {
      const id = url.pathname.split('/').pop();
      const p = profiles.find((x) => x.id === id);
      return p ? json(res, 200, { id, email: `${p.username.toLowerCase()}@example.test`, aud: 'authenticated' })
        : json(res, 404, { msg: 'User not found' });
    }
    if (url.pathname === '/rest/v1/profiles') {
      const username = url.searchParams.get('username');
      const id = url.searchParams.get('id');
      let rows = profiles;
      if (username?.startsWith('ilike.')) rows = rows.filter((p) => likeToRegex(username.slice(6)).test(p.username));
      else if (username?.startsWith('eq.')) rows = rows.filter((p) => p.username === username.slice(3));
      if (id?.startsWith('eq.')) rows = rows.filter((p) => p.id === id.slice(3));
      if (/vnd\.pgrst\.object/.test(req.headers.accept || '')) {
        return rows.length === 1 ? json(res, 200, rows[0]) : json(res, 406, { code: 'PGRST116', message: 'not one row' });
      }
      return json(res, 200, rows);
    }
    return json(res, 404, { message: 'no such stub route' });
  };
  if (delayMs > 0) setTimeout(reply, delayMs); else reply();
};

const fakeAuthSource = `
export const getSupabaseAuth = () => {
  if (!globalThis.__patinaFakeAuth) throw new Error('fake supabaseAuth: not configured');
  return globalThis.__patinaFakeAuth;
};
`;
const hooksSource = (fakeUrl) => `
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    const r = nextResolve(specifier, context);
    if (r.url.endsWith('/Config/supabaseAuth.js')) return { url: ${JSON.stringify(fakeUrl)}, shortCircuit: true };
    return r;
  },
});
`;

const listen = (app) => new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });

before(async () => {
  supa = await startStub({ handler: supabaseHandler });
  workDir = mkdtempSync(join(tmpdir(), 'patina-r04-'));
  const fakeAuthFile = join(workDir, 'fake-supabaseAuth.mjs');
  writeFileSync(fakeAuthFile, fakeAuthSource);
  writeFileSync(join(workDir, 'hooks.mjs'), hooksSource(pathToFileURL(fakeAuthFile).href));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  writeFileSync(join(workDir, 'backend.env'), [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${b64({ alg: 'HS256' })}.${b64({ role: 'service_role' })}.sig`,
    'SUPABASE_ANON_KEY=stub-anon-key',
  ].join('\n'));
  process.env.BACKEND_ENV_FILE = join(workDir, 'backend.env');

  // Same redirect in this process, before any backend module is imported.
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const r = nextResolve(specifier, context);
      if (r.url.endsWith('/Config/supabaseAuth.js')) return { url: pathToFileURL(fakeAuthFile).href, shortCircuit: true };
      return r;
    },
  });
  globalThis.__patinaFakeAuth = {
    auth: {
      signInWithPassword: async ({ email, password }) => {
        const p = profiles.find((x) => `${x.username.toLowerCase()}@example.test` === email);
        if (!p || password !== PASSWORD) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } };
        }
        return { data: { user: { id: p.id, email }, session: null }, error: null };
      },
      resetPasswordForEmail: async () => ({ error: null }),
    },
  };

  mods = {
    requestId: await import(backendUrl('Middlewares', 'requestId.js')),
    errors: await import(backendUrl('Middlewares', 'errorHandler.js')),
    authRoutes: (await import(backendUrl('Routes', 'auth.routes.js'))).default,
  };
  assert.equal(process.env.SUPABASE_URL, supa.url, 'Supabase client is not pointed at the local stub');

  // A core-shaped app: the real auth router behind the same middleware order as index.js.
  const app = express();
  app.use(mods.requestId.requestIdMiddleware);
  app.use(mods.errors.errorContract);
  app.use(express.json());
  app.use(session({ name: 'patina_session', secret: TEST_SECRET, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax' } }));
  app.post('/t/touch', (req, res) => { req.session.visited = true; res.json({ ok: true }); });
  app.get('/api/ping', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', mods.authRoutes);
  app.use(mods.errors.notFoundHandler);
  app.use(mods.errors.errorHandler);
  core = await listen(app);
  coreBase = `http://127.0.0.1:${core.address().port}`;

  const { createApp, loadConfig } = await import(pathToFileURL(join(REPO_DIR, 'gateway', 'index.js')));
  gw = await listen(createApp({ ...loadConfig({}), CORE_URL: coreBase }));
  gwBase = `http://127.0.0.1:${gw.address().port}`;
});

after(async () => {
  for (const s of [gw, core]) {
    if (!s) continue;
    s.closeAllConnections?.();
    await new Promise((r) => s.close(() => r()));
  }
  await supa?.close();
  delete globalThis.__patinaFakeAuth;
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

const sidOf = (res) => {
  const c = (res.headers.getSetCookie?.() ?? []).find((x) => x.startsWith('patina_session='));
  return c ? c.split(';')[0] : null;
};

const doLogin = (username, password = PASSWORD, cookie) => fetch(`${coreBase}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify({ username, password }),
});

const sessionOf = async (cookie) => {
  const r = await fetch(`${coreBase}/api/auth/session`, { headers: cookie ? { Cookie: cookie } : {} });
  return { status: r.status, body: await r.json() };
};

test('GET /api/auth/session without a session -> 401 contract', async () => {
  const r = await sessionOf(null);
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'unauthorized');
  assert.ok(r.body.requestId);
});

test('login issues a new session id (fixation) and /api/auth/session answers { userId, role }', async () => {
  setProfiles(['a_b']);
  delayMs = 0;
  const touch = await fetch(`${coreBase}/t/touch`, { method: 'POST' });
  const before = sidOf(touch);
  assert.ok(before, 'no pre-login session cookie');

  const r = await doLogin('a_b', PASSWORD, before);
  assert.equal(r.status, 200);
  const afterSid = sidOf(r);
  assert.ok(afterSid, 'login set no session cookie');
  assert.notEqual(afterSid, before, 'session id unchanged by login');

  const fresh = await sessionOf(afterSid);
  assert.equal(fresh.status, 200);
  assert.deepEqual(fresh.body, { userId: profiles[0].id, role: 'CANDIDATE' });
  // The pre-login id carries no identity.
  assert.equal((await sessionOf(before)).status, 401);
});

test('a username with _ matches only itself (no LIKE wildcard)', async () => {
  // Only aXb exists: an unescaped `a_b` pattern would match it.
  setProfiles(['aXb']);
  let r = await doLogin('a_b');
  assert.equal(r.status, 401);
  const q = supa.requests.filter((x) => x.path.startsWith('/rest/v1/profiles?')).pop();
  assert.match(decodeURIComponent(q.path), /username=ilike\.a\\_b(&|$)/);

  // Both exist: a_b logs in as a_b (not a 503 from two matches), case-insensitively.
  setProfiles(['a_b', 'aXb']);
  for (const name of ['a_b', 'A_B']) {
    r = await doLogin(name);
    assert.equal(r.status, 200, `${name}: ${r.status}`);
    assert.equal((await sessionOf(sidOf(r))).body.userId, profiles[0].id);
  }
  r = await doLogin('axb');
  assert.equal(r.status, 200);
  assert.equal((await sessionOf(sidOf(r))).body.userId, profiles[1].id);
});

test('a username with % matches nothing and never reaches the database', async () => {
  setProfiles(['a_b', 'aXb']);
  const beforeCount = supa.requests.length;
  for (const name of ['%', 'a%', '%_%']) {
    const r = await doLogin(name);
    assert.equal(r.status, 401, name);
  }
  assert.equal(supa.requests.length, beforeCount, 'a % username was sent to the database');
});

test('password reset: a username with _ looks up only itself', async () => {
  setProfiles(['aXb']);
  const beforeCount = supa.requests.length;
  const r = await fetch(`${coreBase}/api/auth/request-password-reset`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'a_b' }),
  });
  assert.equal(r.status, 200);
  const calls = supa.requests.slice(beforeCount).map((x) => x.path);
  assert.ok(calls.some((p) => p.startsWith('/rest/v1/profiles?')), 'no profile lookup');
  assert.ok(!calls.some((p) => p.startsWith('/auth/v1/admin/users/')), 'reset resolved a different user');
});

test('Supabase delayed 3 s: the gateway pre-check still answers in under 200 ms', async () => {
  setProfiles(['a_b']);
  delayMs = 0;
  const cookie = sidOf(await doLogin('a_b'));
  assert.ok(cookie);
  delayMs = 3000;
  try {
    const t0 = Date.now();
    const s = await fetch(`${coreBase}/api/auth/session`, { headers: { Cookie: cookie } });
    const tSession = Date.now() - t0;
    assert.equal(s.status, 200);
    await s.arrayBuffer();

    const t1 = Date.now();
    const r = await fetch(`${gwBase}/api/ping`, { headers: { Cookie: cookie } });
    const tGateway = Date.now() - t1;
    assert.equal(r.status, 200, 'gateway pre-check refused a live session');
    await r.arrayBuffer();
    assert.ok(tSession < 200, `session check took ${tSession} ms`);
    assert.ok(tGateway < 200, `gateway pre-check + proxy took ${tGateway} ms`);
  } finally {
    delayMs = 0;
  }
});

// --- Start rule: spawn core itself with a stubbed environment ---------------
const runCore = (secret) => new Promise((resolve) => {
  const env = { ...process.env, BACKEND_ENV_FILE: join(workDir, 'backend.env'), PORT: '0', HOST: '127.0.0.1' };
  delete env.SESSION_SECRET;
  if (secret !== undefined) env.SESSION_SECRET = secret;
  const child = spawn(process.execPath, ['--import', pathToFileURL(join(workDir, 'hooks.mjs')).href, 'index.js'], {
    cwd: join(REPO_DIR, 'backend'), env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; if (/Server running on/.test(out)) child.kill(); });
  child.stderr.on('data', (d) => { out += d; });
  const timer = setTimeout(() => child.kill(), 15000);
  child.on('exit', (code) => { clearTimeout(timer); resolve({ code, out }); });
});

test('core refuses to start without SESSION_SECRET, or with one shorter than 32 characters', async () => {
  let r = await runCore(undefined);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /cannot start: SESSION_SECRET is not set.*at least 32 characters/);

  const short = 'short-secret-r04-xyz';
  r = await runCore(short);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /cannot start: SESSION_SECRET is too short\. It must be at least 32 characters/);
  assert.ok(!r.out.includes(short), 'the secret was printed');
  assert.ok(!/\b20\b/.test(r.out), 'the secret length was printed');

  r = await runCore(TEST_SECRET);
  assert.match(r.out, /Server running on http:\/\/127\.0\.0\.1:/, r.out);
  assert.ok(!r.out.includes(TEST_SECRET), 'the secret was printed');
});
