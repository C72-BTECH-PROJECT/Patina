// T-0014 criteria 1-3 (offline): core's github-evidence client against a local
// stub (lib/stub-server.mjs), never the real service and never GitHub.
//
//   node --test tests/backend/github-evidence-client.test.mjs
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR, TESTS_DIR } from './lib/env.mjs';
import { hang, json, raw, reset, startStub } from './lib/stub-server.mjs';

const { normaliseGithubLogin, fetchGithubEvidence } = await import(
  new URL(`file:///${join(REPO_DIR, 'backend', 'Services', 'githubEvidence.js').replace(/\\/g, '/')}`)
);
const { postJson } = await import(
  new URL(`file:///${join(REPO_DIR, 'backend', 'Services', 'internalHttp.js').replace(/\\/g, '/')}`)
);

const FIXTURE = JSON.parse(
  readFileSync(join(TESTS_DIR, 'backend', 'fixtures', 'github-evidence-example-mokafor.json'), 'utf8')
);
const LINK = 'github.com/example-mokafor';
const SENTINEL = 'SENTINEL-t0014-upstream-body';

const savedEnv = {};
beforeEach(() => {
  for (const k of ['GITHUB_EVIDENCE_URL', 'GITHUB_EVIDENCE_TIMEOUT_MS']) savedEnv[k] = process.env[k];
  process.env.GITHUB_EVIDENCE_TIMEOUT_MS = '3000';
});
afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

/** Collect every console line written while `fn` runs. */
async function captureConsole(fn) {
  const lines = [];
  const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  for (const name of Object.keys(orig)) {
    console[name] = (...args) => lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a) ?? String(a))).join(' '));
  }
  try {
    return { value: await fn(), lines };
  } finally {
    Object.assign(console, orig);
  }
}

async function withStub(handler, fn) {
  const stub = await startStub({ handler });
  process.env.GITHUB_EVIDENCE_URL = stub.url;
  try {
    return await fn(stub);
  } finally {
    await stub.close();
  }
}

const call = (extra = {}) =>
  fetchGithubEvidence({ githubLink: LINK, claimedSkills: ['python', 'react'], requestId: 't0014-unit', ...extra });

test('normalises GitHub links', () => {
  for (const link of [
    'github.com/example-mokafor',
    'https://www.github.com/example-mokafor/',
    'http://github.com/example-mokafor/ledgerly',
  ]) {
    assert.equal(normaliseGithubLogin(link), 'example-mokafor', link);
  }
  for (const link of ['github.com/orgs/acme', 'github.com/features', 'github.com/-bad', '', null, undefined]) {
    assert.equal(normaliseGithubLogin(link), null, String(link));
  }
});

test('maps every service outcome', async (t) => {
  const subUnavailable = (code) => ({
    ...FIXTURE,
    sub_score: { ...FIXTURE.sub_score, available: false, value: null, reason_code: code },
  });
  const cases = [
    ['200', (q, s) => json(s, 200, FIXTURE), null],
    ['404 github_user_not_found', (q, s) => json(s, 404, { error: 'github_user_not_found', message: 'x' }), 'github_user_not_found'],
    ['404 other route (D3)', (q, s) => json(s, 404, { error: 'not_found', message: 'x' }), 'service_error'],
    ['503 github_rate_limited', (q, s) => json(s, 503, { error: 'github_rate_limited', message: 'x' }, { 'retry-after': '60' }), 'github_rate_limited'],
    ['503 other', (q, s) => json(s, 503, { error: 'github_auth_failed', message: 'x' }), 'service_unavailable'],
    ['502', (q, s) => json(s, 502, { error: 'github_upstream_error', message: 'x' }), 'service_unavailable'],
    ['400', (q, s) => json(s, 400, { error: 'invalid_request', message: 'x' }), 'service_error'],
    ['504', (q, s) => json(s, 504, { error: 'github_timeout', message: 'x' }), 'service_error'],
    ['500', (q, s) => json(s, 500, { error: 'internal_error', message: 'x' }), 'service_error'],
    ['200 invalid JSON', (q, s) => raw(s, 200, '{"contract_version": "1", '), 'service_error'],
    ['200 without sub_score', (q, s) => json(s, 200, { contract_version: '1' }), 'service_error'],
    ['200 sub_score unavailable: no_public_repositories', (q, s) => json(s, 200, subUnavailable('no_public_repositories')), 'no_public_repositories'],
    ['200 sub_score unavailable: insufficient_evidence (D1)', (q, s) => json(s, 200, subUnavailable('insufficient_evidence')), 'insufficient_evidence'],
  ];
  for (const [name, handler, expected] of cases) {
    await t.test(name, () =>
      withStub(handler, async (stub) => {
        const r = await call();
        assert.equal(stub.requests.length, 1, 'exactly one request (no retry on an HTTP answer)');
        if (expected === null) {
          assert.equal(r.ok, true);
          assert.equal(r.evidence.username, 'example-mokafor');
          assert.equal(r.requestId, 't0014-unit');
        } else {
          assert.deepEqual(r, { ok: false, reasonCode: expected });
        }
      })
    );
  }

  await t.test('connection refused, after exactly one retry', async () => {
    const stub = await startStub({ handler: hang });
    const url = stub.url;
    await stub.close();
    process.env.GITHUB_EVIDENCE_URL = url;
    const { value, lines } = await captureConsole(() => call());
    assert.deepEqual(value, { ok: false, reasonCode: 'service_unavailable' });
    assert.equal(lines.filter((l) => /retrying once/.test(l)).length, 1, `one retry line: ${JSON.stringify(lines)}`);
  });

  await t.test('connection reset: the stub sees exactly two attempts', () =>
    withStub(reset, async (stub) => {
      const r = await captureConsole(() => call());
      assert.deepEqual(r.value, { ok: false, reasonCode: 'service_unavailable' });
      assert.equal(stub.requests.length, 2);
    })
  );

  await t.test('hanging service: timeout, no retry', () =>
    withStub(hang, async (stub) => {
      process.env.GITHUB_EVIDENCE_TIMEOUT_MS = '300';
      const started = Date.now();
      const r = await call();
      const ms = Date.now() - started;
      assert.deepEqual(r, { ok: false, reasonCode: 'timeout' });
      assert.ok(ms < 1300, `took ${ms} ms`);
      assert.equal(stub.requests.length, 1, 'no retry after a timeout');
    })
  );

  for (const [name, link, expected] of [
    ['empty link', '', 'no_github_link'],
    ['null link', null, 'no_github_link'],
    ['invalid link', 'github.com/orgs/acme', 'invalid_github_link'],
  ]) {
    await t.test(`${name}: zero requests`, () =>
      withStub((q, s) => json(s, 200, FIXTURE), async (stub) => {
        assert.deepEqual(await call({ githubLink: link }), { ok: false, reasonCode: expected });
        assert.equal(stub.connections, 0);
      })
    );
  }

  await t.test('GITHUB_EVIDENCE_URL="" is service_disabled with zero requests', () =>
    withStub((q, s) => json(s, 200, FIXTURE), async (stub) => {
      process.env.GITHUB_EVIDENCE_URL = '';
      assert.deepEqual(await call(), { ok: false, reasonCode: 'service_disabled' });
      assert.equal(stub.connections, 0);
    })
  );
});

test('forwards the request id and leaks nothing', async (t) => {
  await t.test('body and X-Request-ID arrive unchanged', () =>
    withStub((q, s) => json(s, 200, FIXTURE), async (stub) => {
      await call({ requestId: 't0014-Abc-123', claimedSkills: ['python', 'React', 'docker'] });
      const [rec] = stub.requests;
      assert.equal(rec.method, 'POST');
      assert.equal(rec.path, '/v1/evidence');
      assert.equal(rec.headers['x-request-id'], 't0014-Abc-123');
      assert.deepEqual(rec.body, { username: 'example-mokafor', claimed_skills: ['python', 'React', 'docker'], window_days: 365 });
    })
  );

  const leaky = [
    ['502 with a body', (q, s) => json(s, 502, { error: 'github_upstream_error', message: SENTINEL })],
    ['500 with a text body', (q, s) => raw(s, 500, `boom ${SENTINEL}`, 'text/plain')],
    ['200 invalid JSON', (q, s) => raw(s, 200, `{"x": "${SENTINEL}"`)],
    ['404 with an unsafe error code', (q, s) => json(s, 404, { error: `${SENTINEL} <b>`, message: SENTINEL })],
  ];
  for (const [name, handler] of leaky) {
    await t.test(`${name}: no body or URL in the result, the error or the logs`, () =>
      withStub(handler, async (stub) => {
        const { value, lines } = await captureConsole(() => call());
        const out = JSON.stringify(value) + lines.join('\n');
        assert.ok(!out.includes(SENTINEL), `leaked body: ${out}`);
        assert.ok(!out.includes(String(stub.port)), `leaked URL: ${out}`);

        let thrown;
        try {
          await postJson(`${stub.url}/v1/evidence`, {}, { timeoutMs: 2000, requestId: 't0014-unit' });
        } catch (err) {
          thrown = err;
        }
        assert.ok(thrown, 'postJson must throw for this answer');
        const dump = `${thrown.message} ${thrown.stack} ${JSON.stringify(thrown)} ${JSON.stringify(Object.entries(thrown))}`;
        assert.ok(!dump.includes(SENTINEL), `error carries the body: ${dump}`);
        assert.ok(!dump.includes(String(stub.port)), `error carries the URL: ${dump}`);
      })
    );
  }
});
