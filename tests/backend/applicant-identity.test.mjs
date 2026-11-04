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

const captureErrors = async (fn) => {
  const original = console.error;
  const lines = [];
  console.error = (...args) => lines.push(args.join(' '));
  try { return { result: await fn(), lines }; } finally { console.error = original; }
};

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

test('an RPC error is logged, the email stays blank, and nothing throws', async () => {
  const { loadApplicantIdentities } = await load();
  const client = fakeClient({
    profiles: [{ id: A, first_name: 'Asha', last_name: 'Rao' }],
    rpcError: { message: 'permission denied for function applicant_emails', code: '42501' },
  });
  const { result, lines } = await captureErrors(() => loadApplicantIdentities(client, [A]));

  assert.deepEqual(result.get(A), { name: 'Asha Rao', email: '' });
  assert.equal(lines.length, 1, 'the RPC error must be logged once');
  assert.match(lines[0], /applicant_emails/);
});

test('a profile with no name falls back to "Candidate"; a candidate with no profile row still gets an entry', async () => {
  const { loadApplicantIdentities } = await load();
  const client = fakeClient({
    profiles: [{ id: A, first_name: '', last_name: '' }],
    emails: [{ id: B, email: 'b@example.com' }],
  });
  const identities = await loadApplicantIdentities(client, [A, B]);
  assert.deepEqual(identities.get(A), { name: 'Candidate', email: '' });
  assert.deepEqual(identities.get(B), { name: 'Candidate', email: 'b@example.com' });
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
