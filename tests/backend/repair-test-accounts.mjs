// Recreate the t0001_ test accounts (auth user + profile row), already email-confirmed.
// Written 2026-11-13 after the accounts were found missing from both Authentication and
// public.profiles. Run by Anthony, never by an agent.
//
//   node tests/backend/repair-test-accounts.mjs           dry run: says what it would do, writes nothing
//   node tests/backend/repair-test-accounts.mjs --apply   creates what is missing
//
// What it touches: only accounts whose username is configured in tests/.env AND starts with
// "t0001_". It never deletes anything and never changes an account that is already complete.
// For each configured account:
//   - auth user and profile both present  -> left alone
//   - auth user present, profile missing  -> profile row inserted for that auth user
//   - both missing                        -> auth user created with email_confirm = true (no email
//                                            is sent); the on_auth_user_created trigger inserts
//                                            the profile row
// Passwords come from tests/.env and are never printed. Email addresses default to
// <username>@<TEST_EMAIL_DOMAIN or example.com>; set TEST_EMAIL_DOMAIN in tests/.env (or the
// shell) if Supabase rejects the default domain.
// Afterwards run: node tests/backend/sweep.mjs --check   (it rewrites the profile snapshot,
// whose saved ids belong to the deleted accounts).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { client, liveConfig } from './lib/testdb.mjs';
import { TESTS_DIR, testEnv } from './lib/env.mjs';

const PREFIX = 't0001_';
const apply = process.argv.includes('--apply');
const env = testEnv();
const cfg = liveConfig();
const domain = env.TEST_EMAIL_DOMAIN || 'example.com';

const accounts = [
  { username: cfg.candidateUsername, password: cfg.candidatePassword, role: 'candidate' },
  { username: cfg.recruiterUsername, password: cfg.recruiterPassword, role: 'recruiter' },
  { username: cfg.recruiter2Username, password: cfg.recruiter2Password, role: 'recruiter' },
  { username: cfg.candidate2Username, password: cfg.candidate2Password, role: 'candidate' },
].filter((a) => a.username);

const snapshotFile = join(TESTS_DIR, '.out', 't0001-profile-snapshots.json');
const snapshots = existsSync(snapshotFile) ? JSON.parse(readFileSync(snapshotFile, 'utf8')) : {};

const sb = client();

async function listAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth user list failed: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

// Profile fields worth carrying over from the old snapshot (never the id or timestamps).
function profileFields(account) {
  const snap = snapshots[account.username] ?? {};
  return {
    first_name: snap.first_name || 'Test',
    last_name: snap.last_name || (account.role === 'recruiter' ? 'Recruiter' : 'Candidate'),
    onboarding_completed: snap.onboarding_completed ?? true,
    company_name: snap.company_name ?? null,
  };
}

const authUsers = await listAuthUsers();
let failed = false;

for (const account of accounts) {
  const { username, password, role } = account;
  const say = (msg) => console.log(`${username}: ${msg}`);
  try {
    if (!username.startsWith(PREFIX)) throw new Error(`guard: username must start with "${PREFIX}"`);

    const { data: profiles, error: profileError } = await sb
      .from('profiles').select('id, role').eq('username', username);
    if (profileError) throw new Error(`profile lookup failed: ${profileError.message}`);
    if (profiles.length > 1) throw new Error(`guard: ${profiles.length} profile rows share this username`);

    const authUser = authUsers.find(
      (u) => (u.user_metadata?.username || '').toLowerCase() === username.toLowerCase(),
    );
    const profile = profiles[0];
    const fields = profileFields(account);

    if (profile) {
      if (profile.role !== role) throw new Error(`guard: profile role is "${profile.role}", expected "${role}"`);
      if (!authUsers.some((u) => u.id === profile.id)) throw new Error('guard: profile exists without an auth user');
      say('complete, left alone');
      continue;
    }

    if (authUser) {
      if (!apply) { say('auth user present, profile missing: would insert the profile row'); continue; }
      const { error } = await sb.from('profiles').insert({ id: authUser.id, username, role, ...fields });
      if (error) throw new Error(`profile insert failed: ${error.message}`);
      say('profile row inserted for the existing auth user');
      continue;
    }

    if (!password) throw new Error('no password for this account in tests/.env');
    if (!apply) { say(`missing from Authentication and profiles: would create it, confirmed, as ${username}@${domain}`); continue; }

    const { data: created, error: createError } = await sb.auth.admin.createUser({
      email: `${username}@${domain}`.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { username, first_name: fields.first_name, last_name: fields.last_name, role },
    });
    if (createError) throw new Error(`auth user create failed: ${createError.message}`);

    const { data: made, error: readError } = await sb
      .from('profiles').select('id, role').eq('id', created.user.id).maybeSingle();
    if (readError) throw new Error(`profile read-back failed: ${readError.message}`);
    if (!made) throw new Error('auth user created but the trigger made no profile row');
    if (made.role !== role) throw new Error(`created profile has role "${made.role}", expected "${role}"`);

    const { error: updateError } = await sb.from('profiles')
      .update({ onboarding_completed: fields.onboarding_completed, company_name: fields.company_name })
      .eq('id', created.user.id);
    if (updateError) throw new Error(`profile update failed: ${updateError.message}`);
    say('created (auth user confirmed, profile row present)');
  } catch (err) {
    failed = true;
    say(`FAILED: ${err.message}`);
  }
}

if (!apply) console.log('\nDry run: nothing was written. Re-run with --apply to make the changes.');
else console.log('\nNext: node tests/backend/sweep.mjs --check   (refreshes the profile snapshot)');
process.exit(failed ? 1 : 0);
