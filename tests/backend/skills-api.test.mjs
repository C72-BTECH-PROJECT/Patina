// R-32 (offline): GET /api/skills?q= and POST /api/skills/extract, the job form's skill
// search and description suggestions (backend/Controllers/skills.controller.js).
//
// Nothing leaves loopback. Core's Supabase client points at a local stub (BACKEND_ENV_FILE)
// that answers requireAuth's profile lookup; nlp-engine is a local stub whose vocabulary
// is set per test. The real router (Routes/skills.routes.js) is mounted where
// backend/index.js mounts it, so the recruiter-only rule is the one core runs.
// The real vocabulary and extractor are tested in tests/nlp/test_r32_skills_api.py.
//
//   node --test tests/backend/skills-api.test.mjs
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';
import { startStub, json, hang } from './lib/stub-server.mjs';

const backendUrl = (...parts) =>
  new URL(`file:///${join(REPO_DIR, 'backend', ...parts).replace(/\\/g, '/')}`);
const express = createRequire(join(REPO_DIR, 'backend', 'package.json'))('express');

const RECRUITER = '22222222-2222-4222-8222-222222222222';
const CANDIDATE = '33333333-3333-4333-8333-333333333333';
const NLP_LEAK = 'LEAKY-NLP-TRACEBACK File "/srv/app/main.py", line 99';

// A vocabulary that has SAS, R and statistics (the card's check: search returns them when
// they are in the vocabulary), plus skills with aliases.
const VOCABULARY = [
  { name: 'javascript', aliases: ['java script', 'js'] },
  { name: 'nodejs', aliases: ['node', 'node.js'] },
  { name: 'postgresql', aliases: ['postgre', 'postgres'] },
  { name: 'python', aliases: [] },
  { name: 'r', aliases: ['r language', 'r programming'] },
  { name: 'react', aliases: ['react.js', 'reactjs'] },
  { name: 'redis', aliases: [] },
  { name: 'rest api', aliases: ['api', 'rest', 'restful'] },
  { name: 'sas', aliases: [] },
  { name: 'sass', aliases: [] },
  { name: 'sql', aliases: [] },
  { name: 'statistics', aliases: [] },
];

let nlpMode = 'ok'; // 'ok' | 'down' | 'crash' | 'garbage' | 'hang'
let extracted = ['sas', 'r', 'statistics'];
const nlpHandler = (req, res, rec) => {
  if (nlpMode === 'hang') return hang();
  if (nlpMode === 'down') return json(res, 503, { error: 'model_loading', message: NLP_LEAK });
  if (nlpMode === 'crash') return json(res, 500, { detail: NLP_LEAK });
  if (nlpMode === 'garbage') return json(res, 200, { skills: [{ nope: NLP_LEAK }] });
  if (req.method === 'GET' && rec.path === '/skills/vocabulary') {
    return json(res, 200, { parser_version: 'nlp-engine@stub', skills: VOCABULARY });
  }
  if (req.method === 'POST' && rec.path === '/skills/extract') {
    return json(res, 200, { parser_version: 'nlp-engine@stub', skills: extracted });
  }
  return json(res, 404, { error: 'not_found' });
};

// requireAuth reads profiles.is_suspended for the session's user.
const supabaseHandler = (req, res) => {
  const url = new URL(req.url, 'http://stub');
  if (url.pathname === '/rest/v1/profiles') {
    const row = { is_suspended: false };
    return /vnd\.pgrst\.object/.test(req.headers.accept || '') ? json(res, 200, row) : json(res, 200, [row]);
  }
  return json(res, 404, { message: 'stub: no route' });
};

let supa;
let nlp;
let envDir;
let server;
let base;
let skills;

const nlpCalls = (path) => nlp.requests.filter((r) => r.path === path).length;

const fakeServiceKey = () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'service_role' })}.sig`;
};

before(async () => {
  supa = await startStub({ handler: supabaseHandler });
  nlp = await startStub({ handler: nlpHandler });
  envDir = mkdtempSync(join(tmpdir(), 'patina-r32-'));
  const envFile = join(envDir, 'backend.env');
  writeFileSync(envFile, [
    `SUPABASE_URL=${supa.url}`,
    `SUPABASE_SERVICE_ROLE_KEY=${fakeServiceKey()}`,
    'SUPABASE_ANON_KEY=stub-anon-key',
    'SESSION_SECRET=r32-offline-test-secret-r32-offline',
    'SUPABASE_TIMEOUT_MS=3000',
    `NLP_PARSE_URL=${nlp.url}/parse`,
    'NLP_SKILLS_TIMEOUT_MS=500',
  ].join('\n'));
  process.env.BACKEND_ENV_FILE = envFile;

  const errors = await import(backendUrl('Middlewares', 'errorHandler.js'));
  const requestId = await import(backendUrl('Middlewares', 'requestId.js'));
  const skillsRoutes = (await import(backendUrl('Routes', 'skills.routes.js'))).default;
  skills = await import(backendUrl('Controllers', 'skills.controller.js'));
  assert.equal(process.env.SUPABASE_URL, supa.url, 'Supabase client is not pointed at the local stub');
  assert.equal(process.env.NLP_PARSE_URL, `${nlp.url}/parse`, 'nlp-engine is not the local stub');

  const app = express();
  app.use(requestId.requestIdMiddleware);
  app.use(errors.errorContract);
  app.use(express.json());
  app.use((req, _res, next) => {
    const user = req.get('X-Test-User');
    req.session = user ? { userId: user, role: req.get('X-Test-Role') || 'RECRUITER' } : {};
    next();
  });
  app.use('/api/skills', skillsRoutes); // as in backend/index.js
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
  await Promise.all([supa?.close(), nlp?.close()]);
  if (envDir) rmSync(envDir, { recursive: true, force: true });
});

beforeEach(() => {
  nlpMode = 'ok';
  extracted = ['sas', 'r', 'statistics'];
  skills.resetSkillVocabularyCache();
});

const call = async (method, path, { user = RECRUITER, role = 'RECRUITER', body } = {}) => {
  const headers = { 'X-Test-Role': role };
  if (user) headers['X-Test-User'] = user;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, body: parsed, text };
};
const search = (q, opts) => call('GET', `/api/skills?q=${encodeURIComponent(q)}`, opts);

test('search returns sas, r and statistics when they are in the vocabulary', async () => {
  for (const q of ['sas', 'r', 'statistics']) {
    const { status, body } = await search(q);
    assert.equal(status, 200, q);
    assert.equal(body.skills[0].name, q, `"${q}" is the first result`);
    assert.equal(body.skills[0].exact, true);
    assert.equal(body.skills.filter((s) => s.exact).length, 1, 'one exact match');
  }
  const stat = await search('Stat');
  assert.deepEqual(stat.body.skills.map((s) => s.name), ['statistics']);
  assert.equal(stat.body.skills[0].exact, false, 'a prefix is not an exact match');
  assert.equal(stat.body.parser_version, 'nlp-engine@stub');
});

test('a query that is an alias resolves to its canonical skill', async () => {
  const pg = await search('  Postgres ');
  assert.equal(pg.body.skills[0].name, 'postgresql');
  assert.equal(pg.body.skills[0].exact, true);
  const js = await search('JS');
  assert.equal(js.body.skills[0].name, 'javascript');
  assert.equal(js.body.skills[0].exact, true);
  const node = await search('Node.js');
  assert.equal(node.body.skills[0].name, 'nodejs');
});

test('results are ranked: exact, name prefix, alias prefix, then contains', async () => {
  const { body } = await search('re');
  const names = body.skills.map((s) => s.name);
  assert.deepEqual(names.slice(0, 3), ['react', 'redis', 'rest api'], 'name prefixes, shorter first');
  assert.ok(names.includes('postgresql'), '"postgresql" contains "re"');
  assert.ok(names.indexOf('postgresql') > names.indexOf('rest api'));
  assert.ok(body.skills.length <= skills.SEARCH_RESULT_LIMIT);
});

test('an unknown skill returns no match, and an empty query returns nothing', async () => {
  assert.deepEqual((await search('Apache Kafka Streams')).body.skills, []);
  assert.deepEqual((await search('')).body.skills, []);
  assert.deepEqual((await call('GET', '/api/skills')).body.skills, []);
});

test('the vocabulary is read once and then served from the cache', async () => {
  const before = nlpCalls('/skills/vocabulary');
  await Promise.all([search('py'), search('sq'), search('re')]);
  await search('sas');
  assert.equal(nlpCalls('/skills/vocabulary') - before, 1);
});

test('recruiter-only: no session is 401, a candidate is 403, and nlp-engine is not called', async () => {
  const vBefore = nlpCalls('/skills/vocabulary');
  const eBefore = nlpCalls('/skills/extract');
  assert.equal((await search('sas', { user: null })).status, 401);
  assert.equal((await search('sas', { user: CANDIDATE, role: 'CANDIDATE' })).status, 403);
  assert.equal((await search('sas', { user: RECRUITER, role: 'ADMIN' })).status, 403);
  assert.equal((await call('POST', '/api/skills/extract', { user: null, body: { text: 'SAS' } })).status, 401);
  assert.equal((await call('POST', '/api/skills/extract', { user: CANDIDATE, role: 'CANDIDATE', body: { text: 'SAS' } })).status, 403);
  assert.equal(nlpCalls('/skills/vocabulary'), vBefore);
  assert.equal(nlpCalls('/skills/extract'), eBefore);
});

test('nlp-engine down, crashing, hung or off-contract: 503 suggestions_unavailable, no upstream text', async () => {
  for (const mode of ['down', 'crash', 'garbage', 'hang']) {
    nlpMode = mode;
    skills.resetSkillVocabularyCache();
    const s = await search('sas');
    assert.equal(s.status, 503, `search, ${mode}`);
    assert.equal(s.body.error, 'suggestions_unavailable');
    assert.match(s.body.message, /You can still type a skill/);
    assert.ok(!s.text.includes('LEAKY'), `search, ${mode}: upstream text leaked`);
    const e = await call('POST', '/api/skills/extract', { body: { text: 'We use SAS.' } });
    assert.equal(e.status, 503, `extract, ${mode}`);
    assert.equal(e.body.error, 'suggestions_unavailable');
    assert.ok(!e.text.includes('LEAKY'), `extract, ${mode}: upstream text leaked`);
  }
});

test('a failed vocabulary read is not cached', async () => {
  nlpMode = 'down';
  assert.equal((await search('sas')).status, 503);
  nlpMode = 'ok';
  const { status, body } = await search('sas');
  assert.equal(status, 200);
  assert.equal(body.skills[0].name, 'sas');
});

test('extract forwards the description and returns the skills nlp-engine found', async () => {
  const text = 'Analyst: SAS, R and statistics.';
  const { status, body } = await call('POST', '/api/skills/extract', { body: { text } });
  assert.equal(status, 200);
  assert.deepEqual(body.skills, ['sas', 'r', 'statistics']);
  assert.equal(body.parser_version, 'nlp-engine@stub');
  const sent = nlp.requests.filter((r) => r.path === '/skills/extract').pop();
  assert.deepEqual(sent.body, { text });
});

test('extract: empty text needs no call; a non-string or over-long text is 400 and never sent', async () => {
  const before = nlpCalls('/skills/extract');
  const empty = await call('POST', '/api/skills/extract', { body: { text: '   ' } });
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.skills, []);
  for (const body of [{}, { text: 12 }, { text: ['SAS'] }]) {
    const r = await call('POST', '/api/skills/extract', { body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.body.error, 'invalid_request');
  }
  const long = await call('POST', '/api/skills/extract', { body: { text: 'x'.repeat(skills.EXTRACT_TEXT_LIMIT + 1) } });
  assert.equal(long.status, 400);
  assert.equal(long.body.error, 'text_too_long');
  assert.equal(nlpCalls('/skills/extract'), before);
});

test('search: an over-long or repeated q is 400', async () => {
  assert.equal((await search('x'.repeat(skills.SEARCH_QUERY_LIMIT + 1))).status, 400);
  const twice = await call('GET', '/api/skills?q=a&q=b');
  assert.equal(twice.status, 400);
  assert.equal(twice.body.error, 'invalid_query');
});

test('basicSkillForm is normalize_skill without the aliases', () => {
  assert.equal(skills.basicSkillForm('  Apache   Kafka Streams. '), 'apache kafka streams');
  assert.equal(skills.basicSkillForm('(Statistics)'), 'statistics');
  assert.equal(skills.basicSkillForm('C++'), 'c++');
  assert.equal(skills.basicSkillForm('C#'), 'c#');
  assert.equal(skills.basicSkillForm(' - '), '');
});
