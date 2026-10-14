// T-0006 / I-0021 (live): requireAuth must fail closed. A session whose
// profile row is missing must be rejected (401), not waved through.
//
// This test TEMPORARILY DELETES the profile row of t0001_recr2 (a throwaway
// account with no jobs/applications/notifications; lib/testdb.mjs
// deleteTestProfile refuses otherwise). Safety net:
//   - the row is written to tests/.out/t0001-profile-snapshots.json first;
//   - it is restored in `finally` (upsert) and asserted afterwards;
//   - if the process dies mid-test, `node tests/backend/sweep.mjs --check`
//     exits 1 with `profile-missing:t0001_recr2: 1` and
//     `node tests/backend/sweep.mjs --restore-profiles` puts it back.
//
//   BACKEND_BASE_URL=http://localhost:5000 node --test tests/backend/live-auth-failclosed.test.mjs
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, login } from './lib/session.mjs';
import {
  client, counts, deleteTestProfile, isZero, liveConfig, resolveAccounts, restoreProfiles, snapshotProfiles, sweep,
} from './lib/testdb.mjs';

const cfg = liveConfig();
const missing = [
  ...cfg.missing,
  ...(cfg.recruiter2Username ? [] : ['TEST_RECRUITER2_USERNAME']),
  ...(cfg.recruiter2Password ? [] : ['TEST_RECRUITER2_PASSWORD']),
];
const skip = missing.length ? `tests/.env missing ${missing.join(', ')}` : false;

let sb;
let ids;

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  assert.deepEqual(ids._meta.missing, [], 'a t0001_ profile is already missing; run sweep.mjs --restore-profiles first');
  await snapshotProfiles(sb, ids);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
});

after(async () => {
  if (skip || !sb || !ids) return;
  // Belt and braces: whatever happened, put every snapshotted profile back.
  await restoreProfiles(sb);
  const fresh = await resolveAccounts(sb, cfg);
  console.log('teardown sweep removed:', await sweep(sb, fresh));
  const remaining = await counts(sb, fresh);
  console.log('remaining after teardown:', remaining);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

test('I-0021: a session whose profile row is missing is rejected with 401 (and works again once restored)', { skip }, async () => {
  const cookie = await login(cfg.recruiter2Username, cfg.recruiter2Password);

  const before401 = await api(cookie, 'GET', '/api/jobs/mine');
  assert.equal(before401.status, 200, `control before delete: HTTP ${before401.status} ${before401.text.slice(0, 200)}`);

  let during;
  try {
    await deleteTestProfile(sb, ids, 'R2');
    during = {
      jobsMine: (await api(cookie, 'GET', '/api/jobs/mine')).status,
      notifications: (await api(cookie, 'GET', '/api/notifications')).status,
    };
  } finally {
    await restoreProfiles(sb);
  }

  const { data: restored } = await sb.from('profiles').select('id, username').eq('id', ids.R2);
  assert.equal(restored?.length, 1, 'profile row was not restored');
  assert.equal(restored[0].username, cfg.recruiter2Username);

  assert.deepEqual(during, { jobsMine: 401, notifications: 401 }, `with the profile missing got ${JSON.stringify(during)}`);

  // Same cookie, row back: proves the 401 was caused by the missing profile
  // (and that the session was not destroyed by it).
  const afterRestore = await api(cookie, 'GET', '/api/jobs/mine');
  assert.equal(afterRestore.status, 200, `control after restore: HTTP ${afterRestore.status}`);
});
