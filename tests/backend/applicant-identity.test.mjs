// T-0031 (a) (offline): I-0063, I-0028. Applicant names and emails load in one
// profiles query plus one RPC, with the client passed in, so this runs on a fake.
//
//   node --test tests/backend/applicant-identity.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';

const load = () => import(
  new URL(`file:///${join(REPO_DIR, 'backend', 'Services', 'applicantIdentity.js').replace(/\\/g, '/')}`)
);

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

function fakeClient({ profiles = [], profilesError = null, emails = [], rpcError = null } = {}) {
  const calls = { profileQueries: 0, rpc: [], getUserById: 0, profileIds: null };
  return {
    calls,
    from(table) {
      assert.equal(table, 'profiles');
      return {
        select: () => ({
          in: async (column, ids) => {
            assert.equal(column, 'id');
            calls.profileQueries += 1;
            calls.profileIds = ids;
            return { data: profilesError ? null : profiles, error: profilesError };
          },
        }),
      };
    },
    rpc: async (name, args) => {
      calls.rpc.push({ name, args });
      return { data: rpcError ? null : emails, error: rpcError };
    },
    auth: { admin: { getUserById: async () => { calls.getUserById += 1; return { data: { user: null } }; } } },
  };
}

test('one profiles query, one RPC, zero getUserById, for any number of applicants', async () => {
  const { loadApplicantIdentities } = await load();
  const client = fakeClient({
    profiles: [{ id: A, first_name: 'Asha', last_name: 'Rao' }, { id: B, first_name: 'Bo', last_name: '' }],
    emails: [{ id: A, email: 'a@example.com' }, { id: B, email: 'b@example.com' }],
  });
  const identities = await loadApplicantIdentities(client, [A, B, A]);

  assert.equal(client.calls.profileQueries, 1);
  assert.deepEqual(client.calls.rpc, [{ name: 'applicant_emails', args: { p_candidate_ids: [A, B] } }]);
  assert.equal(client.calls.getUserById, 0);
  assert.deepEqual(identities.get(A), { name: 'Asha Rao', email: 'a@example.com' });
  assert.deepEqual(identities.get(B), { name: 'Bo', email: 'b@example.com' });
});

// R-13 (B8): an email lookup error is an error, never a blank email.
test('an RPC error throws, so the handler answers an error instead of blank emails', async () => {
  const { loadApplicantIdentities } = await load();
  const client = fakeClient({
    profiles: [{ id: A, first_name: 'Asha', last_name: 'Rao' }],
    rpcError: { message: 'permission denied for function applicant_emails', code: '42501' },
  });
  await assert.rejects(() => loadApplicantIdentities(client, [A]), (err) => {
    assert.equal(err.code, 'database_error');
    assert.match(err.message, /applicant emails/);
    assert.ok(!err.message.includes('permission denied'), 'the database text stays in `cause`');
    return true;
  });
});

// R-13 (B3): no "Candidate" placeholder; a missing name or email is null.
test('a profile with no name gives name null; a candidate with no profile row still gets an entry', async () => {
  const { loadApplicantIdentities } = await load();
  const client = fakeClient({
    profiles: [{ id: A, first_name: '', last_name: '  ' }],
    emails: [{ id: B, email: 'b@example.com' }],
  });
  const identities = await loadApplicantIdentities(client, [A, B]);
  assert.deepEqual(identities.get(A), { name: null, email: null });
  assert.deepEqual(identities.get(B), { name: null, email: 'b@example.com' });
});

test('a profiles error throws, so the handler answers an error instead of a list of blank names', async () => {
  const { loadApplicantIdentities } = await load();
  const client = fakeClient({ profilesError: { message: 'boom' } });
  await assert.rejects(() => loadApplicantIdentities(client, [A]), /applicant profiles/);
  assert.equal(client.calls.rpc.length, 0);
});

test('no candidates: no query at all', async () => {
  const { loadApplicantIdentities } = await load();
  const client = fakeClient();
  const identities = await loadApplicantIdentities(client, []);
  assert.equal(identities.size, 0);
  assert.equal(client.calls.profileQueries, 0);
  assert.equal(client.calls.rpc.length, 0);
});
