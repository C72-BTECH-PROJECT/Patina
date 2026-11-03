// T-0029 (offline): I-0058 + I-0017. Signup succeeds only when the trigger
// created a profiles row; otherwise the auth user is deleted. No database: the
// Supabase admin client is a fake passed in as a parameter.
//
//   node --test tests/backend/signup-profile.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';

const modUrl = new URL(`file:///${join(REPO_DIR, 'backend', 'Services', 'signupProfile.js').replace(/\\/g, '/')}`);
const load = () => import(modUrl);

// Fake service-role client: profiles select -> { data, error }; admin.deleteUser recorded.
function fakeAdmin({ profile = null, selectError = null, deleteError = null } = {}) {
  const calls = { deleted: [], selects: 0 };
  const client = {
    from(table) {
      assert.equal(table, 'profiles');
      const q = {
        select() { return q; },
        eq() { return q; },
        maybeSingle: async () => { calls.selects += 1; return { data: profile, error: selectError }; },
      };
      return q;
    },
    auth: {
      admin: {
        deleteUser: async (id) => { calls.deleted.push(id); return { data: null, error: deleteError }; },
      },
    },
  };
  return { client, calls };
}

const USER = { id: '11111111-1111-4111-8111-111111111111', identities: [{ id: 'x' }] };

test('profile present -> ok, user kept', async () => {
  const { ensureProfileOrRollback } = await load();
  const { client, calls } = fakeAdmin({ profile: { id: USER.id } });
  assert.deepEqual(await ensureProfileOrRollback(client, USER), { ok: true });
  assert.deepEqual(calls.deleted, []);
});

test('profile missing -> auth user deleted once, not ok', async () => {
  const { ensureProfileOrRollback } = await load();
  const { client, calls } = fakeAdmin({ profile: null });
  const r = await ensureProfileOrRollback(client, USER);
  assert.equal(r.ok, false);
  assert.deepEqual(calls.deleted, [USER.id]);
});

test('profile select errors -> rolled back as well', async () => {
  const { ensureProfileOrRollback } = await load();
  const { client, calls } = fakeAdmin({ selectError: { message: 'boom' } });
  const r = await ensureProfileOrRollback(client, USER);
  assert.equal(r.ok, false);
  assert.deepEqual(calls.deleted, [USER.id]);
});

test('deleteUser fails -> still not ok, nothing thrown', async () => {
  const { ensureProfileOrRollback } = await load();
  const { client, calls } = fakeAdmin({ profile: null, deleteError: { message: 'nope' } });
  const r = await ensureProfileOrRollback(client, USER);
  assert.equal(r.ok, false);
  assert.equal(calls.deleted.length, 1);
});

test('already-registered email (GoTrue returns a user with no identities) -> no lookup, no delete, ok', async () => {
  // GoTrue answers a signup for an existing confirmed email with an obfuscated
  // user (identities: []). It is not a new account: never delete anything.
  const { ensureProfileOrRollback } = await load();
  const { client, calls } = fakeAdmin({ profile: null });
  const r = await ensureProfileOrRollback(client, { id: '22222222-2222-4222-8222-222222222222', identities: [] });
  assert.deepEqual(r, { ok: true, existingAccount: true });
  assert.deepEqual(calls.deleted, []);
  assert.equal(calls.selects, 0);
});

test('I-0017 source guard: signup() no longer inserts into profiles itself', () => {
  const src = readFileSync(join(REPO_DIR, 'backend', 'Controllers', 'auth.controller.js'), 'utf8');
  assert.doesNotMatch(src, /from\(\s*'profiles'\s*\)\s*\.insert\(/, 'the trigger is the only profiles writer');
  assert.match(src, /ensureProfileOrRollback\(/, 'signup must verify the profile');
});
