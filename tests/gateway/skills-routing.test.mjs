// R-32: the job form's skill routes go through the gateway like every other /api route:
// no new prefix is registered (gateway/index.js proxies all of /api), they are not on the
// public allowlist (gateway/public-routes.js), and with a session the query string and the
// JSON body reach core unchanged. Offline: core is a local stub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startStub, json } from '../backend/lib/stub-server.mjs';
import { createApp, loadConfig } from '../../gateway/index.js';
import { isPublicRoute } from '../../gateway/public-routes.js';

const withGateway = async (fn) => {
  const stub = await startStub({ handler: (req, res, rec) => json(res, 200, { ok: true, path: rec.path, body: rec.body }) });
  const app = createApp({ ...loadConfig({}), CORE_URL: stub.url });
  const srv = app.listen(0);
  try {
    await fn(`http://localhost:${srv.address().port}`, stub);
  } finally {
    await stub.close();
    srv.close();
  }
};

test('the skill routes are not public', () => {
  assert.equal(isPublicRoute('GET', '/api/skills'), false);
  assert.equal(isPublicRoute('POST', '/api/skills/extract'), false);
});

test('without a session the gateway answers 401 and core never sees the call', async () => {
  await withGateway(async (base, stub) => {
    const r1 = await fetch(`${base}/api/skills?q=sas`);
    const r2 = await fetch(`${base}/api/skills/extract`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'SAS' }),
    });
    assert.equal(r1.status, 401);
    assert.equal(r2.status, 401);
    assert.equal(stub.requests.filter((r) => r.path.startsWith('/api/skills')).length, 0);
  });
});

test('with a session the query string and the body reach core unchanged', async () => {
  await withGateway(async (base, stub) => {
    const cookie = { Cookie: 'patina_session=abc' };
    const r1 = await fetch(`${base}/api/skills?q=${encodeURIComponent('C++')}`, { headers: cookie });
    assert.equal(r1.status, 200);
    assert.equal((await r1.json()).path, '/api/skills?q=C%2B%2B');
    const text = 'Analyst: SAS, R and statistics.';
    const r2 = await fetch(`${base}/api/skills/extract`, {
      method: 'POST', headers: { ...cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
    });
    assert.equal(r2.status, 200);
    const got = await r2.json();
    assert.equal(got.path, '/api/skills/extract');
    assert.deepEqual(got.body, { text });
    // The session pre-check ran before each forwarded call.
    assert.equal(stub.requests.filter((r) => r.path === '/api/auth/session').length, 2);
  });
});
