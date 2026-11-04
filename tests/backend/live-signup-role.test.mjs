// T-0029 criterion 2 (live, after the owner applies M1): I-0055.
// The fail-first gate is the static tests/backend/migration-guards.test.mjs.
//
// 1. The specific error: public.assert_signup_role(), which the trigger uses,
//    raises errcode 22023 "invalid signup role" for anything but candidate or
//    recruiter. Called through the service role, so the result does not depend
//    on whether an admin profile already exists (the single-admin index).
// 2. The function is NOT callable by anon (it is in public, so PostgREST would
//    expose it at /rest/v1/rpc/ without the revoke).
// 3. End to end through GoTrue (auth.admin.createUser, email_confirm: true, so
//    no email is sent): unknown and admin roles create no user and no profile;
//    a candidate signup still works. GoTrue hides trigger errors behind a generic
//    "Database error ..." text; the raw text is logged and, if it does carry our
//    message, asserted too.
//
//   node --test tests/backend/live-signup-role.test.mjs
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { client } from './lib/testdb.mjs';
import { anonClient } from './lib/assessment.mjs';

let sb;
try { sb = client(); } catch { sb = null; }
const skip = sb ? false : 'backend/.env has no service-role credentials';

const created = [];
const stamp = Date.now();
const user = (tag) => ({ username: `t0001_role_${tag}_${stamp}`.slice(0, 30), email: `t0001_role_${tag}_${stamp}@example.com` });

after(async () => {
  for (const id of created) {
    const { error } = await sb.auth.admin.deleteUser(id);
    if (error) console.error(`cleanup: could not delete test user ${id}: ${error.message}`);
  }
});

const expectInvalidRole = async (pRole) => {
  const { data, error } = await sb.rpc('assert_signup_role', { p_role: pRole });
  assert.ok(error, `assert_signup_role(${JSON.stringify(pRole)}) returned ${JSON.stringify(data)} instead of raising`);
  assert.equal(error.code, '22023', `wrong errcode: ${JSON.stringify(error)}`);
  assert.match(error.message, /^invalid signup role/);
};

test('assert_signup_role: admin -> 22023 invalid signup role (independent of any existing admin)', { skip }, async () => {
  await expectInvalidRole('admin');
});

test('assert_signup_role: unknown role superuser -> 22023', { skip }, async () => {
  await expectInvalidRole('superuser');
});

test('assert_signup_role: null -> 22023', { skip }, async () => {
  await expectInvalidRole(null);
});

test('assert_signup_role: candidate and recruiter are accepted', { skip }, async () => {
  for (const role of ['candidate', 'recruiter']) {
    const { data, error } = await sb.rpc('assert_signup_role', { p_role: role });
    assert.ifError(error);
    assert.equal(data, role);
  }
});

test('assert_signup_role is not callable by anon (PostgREST rpc refused)', { skip }, async () => {
  const { data, error } = await anonClient().rpc('assert_signup_role', { p_role: 'candidate' });
  assert.ok(error, `anon rpc returned ${JSON.stringify(data)}`);
  // 42501 = insufficient_privilege (permission denied for function); PGRST202 if hidden from the schema cache.
  assert.ok(['42501', 'PGRST202'].includes(error.code), `unexpected refusal: ${JSON.stringify(error)}`);
});

async function signupWithRole(tag, role, lastName = 'Test') {
  const u = user(tag);
  const { data, error } = await sb.auth.admin.createUser({
    email: u.email,
    password: `T0029-${stamp}-pw!`,
    email_confirm: true,
    user_metadata: { username: u.username, first_name: 'Role', last_name: lastName, ...(role === undefined ? {} : { role }) },
  });
  if (data?.user?.id) created.push(data.user.id);
  return { u, data, error };
}

async function noUserNoProfile(u) {
  const { data: profiles } = await sb.from('profiles').select('id').eq('username', u.username);
  assert.equal(profiles?.length ?? 0, 0, `a profile exists for ${u.username}`);
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ok(!(list?.users ?? []).some((x) => x.email === u.email), `an auth user exists for ${u.email}`);
}

for (const [tag, role] of [['super', 'superuser'], ['admin', 'admin'], ['none', undefined]]) {
  test(`end to end: signup with role ${String(role)} creates no user and no profile`, { skip }, async () => {
    const { u, error } = await signupWithRole(tag, role);
    assert.ok(error, 'createUser must fail');
    console.log(`GoTrue error for role ${String(role)}: ${error.message}`);
    if (/invalid signup role/.test(error.message)) assert.match(error.message, /invalid signup role/);
    await noUserNoProfile(u);
  });
}

test('end to end: a candidate signup still works and gets profiles.role = candidate', { skip }, async () => {
  const { u, data, error } = await signupWithRole('cand', 'candidate');
  assert.ifError(error);
  const { data: profile, error: pErr } = await sb.from('profiles').select('role, username').eq('id', data.user.id).single();
  assert.ifError(pErr);
  assert.equal(profile.role, 'candidate');
  assert.equal(profile.username, u.username);
});

// T-0031 (i): I-0016. The database half of a one-word name; a control, so it passes before and after.
test('end to end: an empty last name creates a profile with last_name = \'\'', { skip }, async () => {
  const { data, error } = await signupWithRole('oneword', 'candidate', '');
  assert.ifError(error);
  const { data: profile, error: pErr } = await sb.from('profiles').select('last_name').eq('id', data.user.id).single();
  assert.ifError(pErr);
  assert.equal(profile.last_name, '');
});

test('record: does an admin profile exist? (decides which case the end-to-end admin test proved)', { skip }, async () => {
  const { count, error } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
  assert.ifError(error);
  console.log(`admin profiles present: ${count}`);
});
