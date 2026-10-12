// Service-role access to the shared Supabase project, scoped to the t0001_
// test accounts. Every delete is filtered by the test accounts' ids: candidate
// ids (C, C2) for scores/resumes/applications/storage, recruiter ids (R, R2)
// AND the "[T-0001 TEST]" title tag for jobs, and every test id for
// notifications. Nothing broader is ever deleted.
//
// Credentials: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are read from
// backend/.env (never copied, never logged). Test usernames come from
// tests/.env (git-ignored).
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR, TESTS_DIR, readEnvFile, testEnv } from './env.mjs';

const requireFromBackend = createRequire(join(REPO_DIR, 'backend', 'package.json'));
const { createClient } = requireFromBackend('@supabase/supabase-js');

export const JOB_TAG = '[T-0001 TEST]';
const USERNAME_PREFIX = 't0001_';
const MAX_ROWS = 50;
const BUCKET = 'resumes';
const SNAPSHOT_FILE = join(TESTS_DIR, '.out', 't0001-profile-snapshots.json');

export function client() {
  const be = readEnvFile(join(REPO_DIR, 'backend', '.env'));
  if (!be.SUPABASE_URL || !be.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('backend/.env is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(be.SUPABASE_URL, be.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// candidate/recruiter are required; the "2" accounts are optional and are only
// resolved (and swept) when their usernames are configured.
export function liveConfig() {
  const env = testEnv();
  const cfg = {
    candidateUsername: env.TEST_CANDIDATE_USERNAME,
    candidatePassword: env.TEST_CANDIDATE_PASSWORD,
    recruiterUsername: env.TEST_RECRUITER_USERNAME,
  };
  const missing = Object.entries(cfg).filter(([, v]) => !v).map(([k]) => k);
  return {
    ...cfg,
    recruiterPassword: env.TEST_RECRUITER_PASSWORD,
    recruiter2Username: env.TEST_RECRUITER2_USERNAME,
    recruiter2Password: env.TEST_RECRUITER2_PASSWORD,
    candidate2Username: env.TEST_CANDIDATE2_USERNAME,
    candidate2Password: env.TEST_CANDIDATE2_PASSWORD,
    missing,
  };
}

// Every configured account, in resolve order.
const accountList = (cfg) => [
  { key: 'C', username: cfg.candidateUsername, role: 'candidate' },
  { key: 'R', username: cfg.recruiterUsername, role: 'recruiter' },
  ...(cfg.recruiter2Username ? [{ key: 'R2', username: cfg.recruiter2Username, role: 'recruiter' }] : []),
  ...(cfg.candidate2Username ? [{ key: 'C2', username: cfg.candidate2Username, role: 'candidate' }] : []),
];

function readSnapshots() {
  if (!existsSync(SNAPSHOT_FILE)) return {};
  return JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'));
}

async function resolveOne(sb, { username, role }, snapshots) {
  if (!username?.startsWith(USERNAME_PREFIX)) {
    throw new Error(`guard: test username must start with "${USERNAME_PREFIX}" (got "${username}")`);
  }
  const { data, error } = await sb.from('profiles').select('id, role').eq('username', username);
  if (error) throw new Error(`profiles lookup failed for ${username}: ${error.message}`);
  if (data && data.length > 1) throw new Error(`guard: expected exactly 1 profile for ${username}, found ${data.length}`);
  if (!data || data.length === 0) {
    // A missing profile is reported (counts() -> profile-missing:*) and recoverable
    // from the snapshot; without a snapshot we cannot know the id, so stop.
    const snap = snapshots[username];
    if (!snap) throw new Error(`guard: no profile for ${username} and no snapshot to recover from`);
    if (String(snap.role).toLowerCase() !== role) throw new Error(`guard: snapshot role for ${username} is "${snap.role}", expected "${role}"`);
    return { id: snap.id, missing: true };
  }
  if (String(data[0].role).toLowerCase() !== role) {
    throw new Error(`guard: ${username} has role "${data[0].role}", expected "${role}"`);
  }
  return { id: data[0].id, missing: false };
}

// Resolve C, R (+ R2, C2 when configured) with all guards applied.
// Result also carries non-enumerable-ish bookkeeping under `_meta`.
export async function resolveAccounts(sb, cfg = liveConfig()) {
  const snapshots = readSnapshots();
  const out = {};
  const usernames = {};
  const missing = [];
  for (const acct of accountList(cfg)) {
    const { id, missing: isMissing } = await resolveOne(sb, acct, snapshots);
    out[acct.key] = id;
    usernames[acct.key] = acct.username;
    if (isMissing) missing.push(acct.username);
  }
  Object.defineProperty(out, '_meta', { value: { usernames, missing }, enumerable: false });
  return out;
}

const candidateIds = (ids) => [ids.C, ids.C2].filter(Boolean);
const recruiterIds = (ids) => [ids.R, ids.R2].filter(Boolean);
const allIds = (ids) => [...candidateIds(ids), ...recruiterIds(ids)];

// Filters, kept in one place so count() and delete() can never diverge.
// Order respects FKs (scores -> resumes; applications -> jobs).
const TABLE_FILTERS = (ids) => [
  { table: 'notifications', apply: (q) => q.in('user_id', allIds(ids)) },
  { table: 'scores', apply: (q) => q.in('candidate_id', candidateIds(ids)) },
  { table: 'resumes', apply: (q) => q.in('candidate_id', candidateIds(ids)) },
  { table: 'applications', apply: (q) => q.in('candidate_id', candidateIds(ids)) },
  { table: 'jobs', apply: (q) => q.in('recruiter_id', recruiterIds(ids)).like('title', `${JOB_TAG}%`) },
];

// Baseline stores `${C}/<uuid><ext>`, HEAD stores `candidates/${C}/resume<ext>`.
const STORAGE_PREFIXES = (ids) =>
  [['C', ids.C], ['C2', ids.C2]]
    .filter(([, id]) => id)
    .flatMap(([k, id]) => [
      { prefix: id, label: `storage:<${k}>/` },
      { prefix: `candidates/${id}`, label: `storage:candidates/<${k}>/` },
    ]);

async function listObjects(sb, prefix) {
  const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 100 });
  if (error) throw new Error(`storage list ${prefix} failed: ${error.message}`);
  // Folder placeholders have id === null; only real objects are removable.
  return (data ?? []).filter((o) => o.id).map((o) => `${prefix}/${o.name}`);
}

// Read-only: what the sweep would remove right now, plus whether every
// configured t0001_ profile still exists (1 = missing, so isZero() fails).
export async function counts(sb, ids) {
  const out = {};
  for (const { table, apply } of TABLE_FILTERS(ids)) {
    const { count, error } = await apply(sb.from(table).select('*', { count: 'exact', head: true }));
    // A missing table (I-0007 / I-0013 in a fresh project) is reported, not fatal.
    out[table] = error ? `error: ${error.message}` : count;
  }
  for (const { prefix, label } of STORAGE_PREFIXES(ids)) {
    out[label] = (await listObjects(sb, prefix)).length;
  }
  const missing = ids._meta?.missing ?? [];
  for (const username of Object.values(ids._meta?.usernames ?? {})) {
    out[`profile-missing:${username}`] = missing.includes(username) ? 1 : 0;
  }
  return out;
}

// Delete everything owned by the test accounts.
export async function sweep(sb, ids) {
  const removed = {};
  for (const { table, apply } of TABLE_FILTERS(ids)) {
    const { count, error: countErr } = await apply(sb.from(table).select('*', { count: 'exact', head: true }));
    if (countErr) {
      // Table absent in this project: nothing to delete.
      removed[table] = `skipped (${countErr.message})`;
      continue;
    }
    if (count > MAX_ROWS) throw new Error(`guard: ${table} delete would remove ${count} rows (> ${MAX_ROWS}); aborting`);
    if (count > 0) {
      const { error } = await apply(sb.from(table).delete());
      if (error) throw new Error(`${table} delete failed: ${error.message}`);
    }
    removed[table] = count;
  }
  for (const { prefix, label } of STORAGE_PREFIXES(ids)) {
    const paths = await listObjects(sb, prefix);
    if (paths.length > MAX_ROWS) throw new Error(`guard: storage ${prefix} has ${paths.length} objects (> ${MAX_ROWS}); aborting`);
    if (paths.length) {
      const { error } = await sb.storage.from(BUCKET).remove(paths);
      if (error) throw new Error(`storage remove under ${prefix} failed: ${error.message}`);
    }
    removed[label] = paths.length;
  }
  return removed;
}

// Save the full profile row of every configured t0001_ account to
// tests/.out/ (git-ignored) so a deleted row can be put back. Only rows that
// currently exist are written; an older snapshot is kept for rows that don't.
export async function snapshotProfiles(sb, ids) {
  const ownedIds = Object.values(ids).filter(Boolean);
  const { data, error } = await sb.from('profiles').select('*').in('id', ownedIds);
  if (error) throw new Error(`profile snapshot failed: ${error.message}`);
  const snapshots = readSnapshots();
  for (const row of data ?? []) {
    if (!row.username?.startsWith(USERNAME_PREFIX)) throw new Error(`guard: refusing to snapshot "${row.username}"`);
    snapshots[row.username] = row;
  }
  mkdirSync(join(TESTS_DIR, '.out'), { recursive: true });
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshots, null, 2));
  return Object.keys(snapshots);
}

// Idempotent: upsert every snapshotted t0001_ profile (a present row is
// overwritten with its own saved values).
export async function restoreProfiles(sb) {
  const snapshots = readSnapshots();
  const restored = [];
  for (const [username, row] of Object.entries(snapshots)) {
    if (!username.startsWith(USERNAME_PREFIX) || row.username !== username) {
      throw new Error(`guard: bad snapshot entry "${username}"`);
    }
    const { error } = await sb.from('profiles').upsert(row, { onConflict: 'id' });
    if (error) throw new Error(`profile restore failed for ${username}: ${error.message}`);
    restored.push(username);
  }
  return restored;
}

// Test-only: delete one t0001_ profile row, guarded by id + username + no
// dependent rows. Used by the fail-closed test (T-0006).
export async function deleteTestProfile(sb, ids, key) {
  const username = ids._meta.usernames[key];
  if (!username?.startsWith(USERNAME_PREFIX)) throw new Error(`guard: ${key} is not a t0001_ account`);
  for (const [table, col] of [['jobs', 'recruiter_id'], ['applications', 'candidate_id'], ['notifications', 'user_id']]) {
    const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true }).eq(col, ids[key]);
    if (error) throw new Error(`guard: could not check ${table} for ${username}: ${error.message}`);
    if (count > 0) throw new Error(`guard: ${username} has ${count} ${table} rows; refusing to delete its profile`);
  }
  const { error } = await sb.from('profiles').delete().eq('id', ids[key]).eq('username', username);
  if (error) throw new Error(`profile delete failed for ${username}: ${error.message}`);
}

export async function insertTestJob(sb, R) {
  const { data, error } = await sb
    .from('jobs')
    .insert({
      recruiter_id: R,
      title: `${JOB_TAG} harness job`,
      description:
        'Synthetic job created by the T-0001 test harness and deleted in teardown. '
        + 'Backend engineer: Python, SQL, PostgreSQL, Docker, Git, REST API design.',
      required_skills: ['python', 'sql', 'postgresql', 'docker', 'git', 'rest api'],
      preferred_skills: ['react', 'redis', 'aws'],
      experience_level: 'mid',
      location: 'Remote',
      status: 'published',
    })
    .select('id')
    .single();
  if (error) throw new Error(`test job insert failed: ${error.message}`);
  return data.id;
}

// Strict: an errored count is not "zero" — it must be looked at.
export const isZero = (c) => Object.values(c).every((v) => v === 0);
