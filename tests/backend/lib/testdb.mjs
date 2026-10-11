// Service-role access to the shared Supabase project, scoped to the T-0001
// test accounts. Every delete is filtered by the test candidate's id (C), or by
// the test recruiter's id (R) AND the "[T-0001 TEST]" title tag. Nothing
// broader is ever deleted.
//
// Credentials: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are read from
// backend/.env (never copied, never logged). Test usernames come from
// tests/.env (git-ignored).
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { REPO_DIR, readEnvFile, testEnv } from './env.mjs';

const requireFromBackend = createRequire(join(REPO_DIR, 'backend', 'package.json'));
const { createClient } = requireFromBackend('@supabase/supabase-js');

export const JOB_TAG = '[T-0001 TEST]';
const USERNAME_PREFIX = 't0001_';
const MAX_ROWS = 50;
const BUCKET = 'resumes';

export function client() {
  const be = readEnvFile(join(REPO_DIR, 'backend', '.env'));
  if (!be.SUPABASE_URL || !be.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('backend/.env is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(be.SUPABASE_URL, be.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function liveConfig() {
  const env = testEnv();
  const cfg = {
    candidateUsername: env.TEST_CANDIDATE_USERNAME,
    candidatePassword: env.TEST_CANDIDATE_PASSWORD,
    recruiterUsername: env.TEST_RECRUITER_USERNAME,
  };
  const missing = Object.entries(cfg).filter(([, v]) => !v).map(([k]) => k);
  return { ...cfg, missing };
}

async function profileId(sb, username, expectedRole) {
  if (!username?.startsWith(USERNAME_PREFIX)) {
    throw new Error(`guard: test username must start with "${USERNAME_PREFIX}" (got "${username}")`);
  }
  const { data, error } = await sb.from('profiles').select('id, role').eq('username', username);
  if (error) throw new Error(`profiles lookup failed for ${username}: ${error.message}`);
  if (!data || data.length !== 1) throw new Error(`guard: expected exactly 1 profile for ${username}, found ${data?.length ?? 0}`);
  if (String(data[0].role).toLowerCase() !== expectedRole) {
    throw new Error(`guard: ${username} has role "${data[0].role}", expected "${expectedRole}"`);
  }
  return data[0].id;
}

// Resolve C and R with all guards applied.
export async function resolveAccounts(sb, cfg = liveConfig()) {
  const C = await profileId(sb, cfg.candidateUsername, 'candidate');
  const R = await profileId(sb, cfg.recruiterUsername, 'recruiter');
  return { C, R };
}

// Filters, kept in one place so count() and delete() can never diverge.
const TABLE_FILTERS = (C, R) => [
  { table: 'scores', apply: (q) => q.eq('candidate_id', C) },
  { table: 'resumes', apply: (q) => q.eq('candidate_id', C) },
  { table: 'applications', apply: (q) => q.eq('candidate_id', C) },
  { table: 'jobs', apply: (q) => q.eq('recruiter_id', R).like('title', `${JOB_TAG}%`) },
];

// Baseline stores `${C}/<uuid><ext>`, HEAD stores `candidates/${C}/resume<ext>`.
const STORAGE_PREFIXES = (C) => [C, `candidates/${C}`];

async function listObjects(sb, prefix) {
  const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 100 });
  if (error) throw new Error(`storage list ${prefix} failed: ${error.message}`);
  // Folder placeholders have id === null; only real objects are removable.
  return (data ?? []).filter((o) => o.id).map((o) => `${prefix}/${o.name}`);
}

// Read-only: what the sweep would remove right now.
export async function counts(sb, { C, R }) {
  const out = {};
  for (const { table, apply } of TABLE_FILTERS(C, R)) {
    const { count, error } = await apply(sb.from(table).select('*', { count: 'exact', head: true }));
    // A missing table (I-0007 / I-0013 in a fresh project) is reported, not fatal.
    out[table] = error ? `error: ${error.message}` : count;
  }
  for (const prefix of STORAGE_PREFIXES(C)) {
    out[`storage:${prefix === C ? '<C>/' : 'candidates/<C>/'}`] = (await listObjects(sb, prefix)).length;
  }
  return out;
}

// Delete everything owned by the test accounts. Order respects FKs
// (scores -> resumes; applications -> jobs).
export async function sweep(sb, ids) {
  const { C, R } = ids;
  const removed = {};
  for (const { table, apply } of TABLE_FILTERS(C, R)) {
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
  for (const prefix of STORAGE_PREFIXES(C)) {
    const paths = await listObjects(sb, prefix);
    if (paths.length > MAX_ROWS) throw new Error(`guard: storage ${prefix} has ${paths.length} objects (> ${MAX_ROWS}); aborting`);
    if (paths.length) {
      const { error } = await sb.storage.from(BUCKET).remove(paths);
      if (error) throw new Error(`storage remove under ${prefix} failed: ${error.message}`);
    }
    removed[`storage:${prefix === C ? '<C>/' : 'candidates/<C>/'}`] = paths.length;
  }
  return removed;
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
