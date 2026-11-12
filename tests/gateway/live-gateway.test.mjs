import test from 'node:test';
import assert from 'node:assert/strict';
import { coreBaseUrl } from '../backend/lib/env.mjs';

// Live tests require core on :5001, gateway on :5000, NLP :8000, github-evidence :8001.
const GATEWAY = process.env.GATEWAY_BASE_URL || 'http://localhost:5000';
const CORE = coreBaseUrl();

test('unauthenticated protected route stops at gateway', async () => {
  const r = await fetch(`${GATEWAY}/api/jobs`);
  assert.equal(r.status, 401);
  const b = await r.json();
  // R-03 error contract: { error, message, requestId } plus the gateway marker.
  assert.equal(b.source, 'gateway');
  assert.equal(b.error, 'unauthorized');
  assert.equal(typeof b.message, 'string');
  assert.equal(b.requestId, r.headers.get('x-request-id'));
});

test('no route to github-evidence', async () => {
  const r = await fetch(`${GATEWAY}/v1/evidence`, { headers: { Cookie: 'patina_session=x' } });
  // reaches core, which returns 404
  assert.equal(r.status, 404);
});