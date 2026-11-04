// T-0029 (offline, static): guards over supabase/migrations/*.sql.
// Reads the files only; no database. Comments are stripped before matching, so a
// rule mentioned in a comment never satisfies a check.
//
//   node --test tests/backend/migration-guards.test.mjs
//
// T-0030 (B2) added the 14-digit, rename-table, bucket and comment checks; T-0020 extends it next.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';

const DIR = join(REPO_DIR, 'supabase', 'migrations');
const stripComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
const norm = (sql) => stripComments(sql).replace(/\s+/g, ' ').toLowerCase();

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => {
    const prefix = f.split('_')[0];
    return { file: f, prefix, sortKey: prefix.padEnd(14, '0'), sql: norm(readFileSync(join(DIR, f), 'utf8')) };
  })
  .sort((a, b) => (a.sortKey === b.sortKey ? a.file.localeCompare(b.file) : a.sortKey.localeCompare(b.sortKey)));

const byName = (suffix) => files.find((f) => f.file.endsWith(suffix));
const T0029 = {
  role: '20261103120000_restrict_signup_role.sql',
  keys: '20261103120100_create_assessment_keys.sql',
  claim: '20261103120200_assessment_grading_claim.sql',
  drop: '20261103120300_drop_assessments_answer_key.sql',
};
const need = (name) => {
  const f = files.find((x) => x.file === name);
  assert.ok(f, `missing migration ${name}`);
  return f.sql;
};

test('every migration has a unique 14-digit version (I-0057, T-0030)', () => {
  for (const name of Object.values(T0029)) assert.ok(byName(name), `missing migration ${name}`);
  const seen = new Map();
  for (const f of files) {
    assert.match(f.prefix, /^\d{14}$/, `${f.file}: version must be 14 digits (no 8-digit file may remain)`);
    assert.ok(!seen.has(f.prefix), `duplicate version ${f.prefix}: ${seen.get(f.prefix)} and ${f.file}`);
    seen.set(f.prefix, f.file);
  }
});

// The rename table approved in tasks/T-0030-migrations-batch.md. The 20261015 pair takes
// the versions the remote history already records (R1), so no repair touches them.
const RENAMED = [
  '20260823000000_create_profiles.sql',
  '20260830000000_create_jobs_and_applications.sql',
  '20260831000000_add_single_admin_role.sql',
  '20260831000100_add_single_admin_index.sql',
  '20260901000000_add_profile_suspension.sql',
  '20260903000000_create_notifications.sql',
  '20260903000100_create_resumes_and_scores.sql',
  '20261015004738_create_assessments.sql',
  '20261015034725_allow_five_assessment_attempts.sql',
];

test('B2 renames match the approved table, in dependency order (I-0057, T-0030)', () => {
  const order = files.map((f) => f.file);
  for (const name of RENAMED) assert.ok(order.includes(name), `missing renamed migration ${name}`);
  const idx = RENAMED.map((n) => order.indexOf(n));
  assert.deepEqual([...idx].sort((a, b) => a - b), idx, 'renamed files must sort in the approved order');
  assert.ok(order.indexOf('20261015004738_create_assessments.sql') < order.indexOf(T0029.keys),
    'assessments must exist before the T-0029 migrations');
});

test('a file that adds an enum value does nothing else in that transaction (T-0030, SQLSTATE 55P04)', () => {
  // The CLI runs each file as one transaction, and Postgres cannot use an enum value
  // in the transaction that added it. So an `add value` file holds only `add value`s.
  const adders = files.filter((f) => /alter type [\w.]+ add value/.test(f.sql));
  assert.ok(adders.length, 'expected at least the admin enum migration');
  for (const f of adders) {
    const stmts = f.sql.split(';').map((x) => x.trim()).filter(Boolean);
    for (const st of stmts) assert.match(st, /^alter type [\w.]+ add value /, `${f.file}: "${st.slice(0, 60)}" must move to its own file`);
  }
  assert.match(need('20260831000100_add_single_admin_index.sql'),
    /create unique index if not exists profiles_single_admin_role on public\.profiles \(role\) where role = 'admin'/);
});

test('resumes bucket limits live in a migration, mirroring the live bucket (I-0001, T-0030)', () => {
  const sql = need('20261104120000_resumes_bucket_limits.sql');
  assert.match(sql, /update storage\.buckets set file_size_limit = 10485760, allowed_mime_types = array\[ ?'application\/pdf', 'application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document' ?\]::text\[\] where id = 'resumes'/);
});

test('scores.subscores has a database comment describing the stored shape (I-0041, T-0030)', () => {
  const sql = need('20261104120100_scores_subscores_comment.sql');
  assert.match(sql, /comment on column public\.scores\.subscores is '/);
  for (const field of ['key', 'label', 'available', 'value', 'weight', 'reason', 'components', 'evidence']) {
    assert.match(sql, new RegExp(`\\b${field}\\b`), `comment must name the ${field} field`);
  }
});

test('latest handle_new_user() takes its role from assert_signup_role (I-0055)', () => {
  const defs = files.filter((f) => /create (or replace )?function public\.handle_new_user\(/.test(f.sql));
  assert.ok(defs.length, 'no migration defines public.handle_new_user');
  const latest = defs[defs.length - 1];
  const body = latest.sql.slice(latest.sql.indexOf('function public.handle_new_user('));
  assert.match(body, /public\.assert_signup_role\(\s*new\.raw_user_meta_data ->> 'role'\s*\)/,
    `${latest.file}: role must come from public.assert_signup_role(...)`);
  assert.doesNotMatch(body.slice(0, body.indexOf('$$;', body.indexOf('$$') + 2) + 3),
    /\(new\.raw_user_meta_data ->> 'role'\)::public\.patina_user_role/,
    `${latest.file}: the direct metadata cast must be gone`);
});

test('assert_signup_role allows only candidate and recruiter, raises 22023, not callable by anon (I-0055)', () => {
  const sql = need(T0029.role);
  assert.match(sql, /create or replace function public\.assert_signup_role\(p_role text\)/);
  assert.match(sql, /p_role is null or p_role not in \('candidate', 'recruiter'\)/);
  assert.match(sql, /raise exception 'invalid signup role/);
  assert.match(sql, /errcode = '22023'/);
  assert.match(sql, /revoke execute on function public\.assert_signup_role\(text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.assert_signup_role\(text\) to service_role/);
});

test('M2 creates assessment_keys with RLS on, no policy, no anon/authenticated grant, and verifies the copy (I-0066)', () => {
  const sql = need(T0029.keys);
  assert.match(sql, /create table (if not exists )?public\.assessment_keys/);
  assert.match(sql, /assessment_id uuid primary key references public\.assessments\(id\) on delete cascade/);
  assert.match(sql, /alter table public\.assessment_keys enable row level security/);
  assert.doesNotMatch(sql, /create policy/, 'assessment_keys must have no policy');
  assert.match(sql, /revoke all on (table )?public\.assessment_keys from anon, authenticated/);
  assert.match(sql, /insert into public\.assessment_keys \(assessment_id, answer_key\) select id, answer_key from public\.assessments/);
  assert.match(sql, /raise exception 'assessment_keys copy mismatch/);
  assert.match(sql, /alter table public\.assessments alter column answer_key drop not null/);
  assert.doesNotMatch(sql, /drop column/, 'M2 must not drop anything');
});

test('M4 re-copies, re-verifies, then drops assessments.answer_key (I-0066)', () => {
  const sql = need(T0029.drop);
  const recopy = sql.indexOf('insert into public.assessment_keys');
  const verify = sql.indexOf("raise exception 'assessment_keys incomplete");
  const drop = sql.indexOf('alter table public.assessments drop column answer_key');
  assert.ok(recopy >= 0 && verify > recopy && drop > verify, 'order must be re-copy, verify, drop');
});

test('M3 adds the grading claim: status, open index, atomic claim function (I-0069)', () => {
  const sql = need(T0029.claim);
  assert.match(sql, /check \(status in \('generated', 'grading', 'completed'\)\)/);
  assert.match(sql, /add column (if not exists )?grading_started_at timestamptz/);
  assert.match(sql, /create unique index assessments_candidate_job_open_idx on public\.assessments\s?\(candidate_id, job_id\) where status in \('generated', 'grading'\)/);
  assert.match(sql, /create or replace function public\.claim_assessment_for_grading\(/);
  assert.match(sql, /set status = 'grading', grading_started_at = now\(\)/);
  assert.match(sql, /a\.status = 'generated' or \(a\.status = 'grading' and a\.grading_started_at < now\(\) - p_stale_after\)/);
  assert.match(sql, /returning /);
  assert.match(sql, /revoke execute on function public\.claim_assessment_for_grading\(uuid, uuid, interval\) from public, anon, authenticated/);
});

// T-0030: function bodies are stored byte for byte, so line endings matter to `db diff`.
const RAW = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => ({ file: f, raw: readFileSync(join(DIR, f), 'utf8') }));
const FN_RE = /create (?:or replace )?function public\.(\w+)\s*\([\s\S]*?\$\$[\s\S]*?\$\$;/gi;

test('applicant_emails reads auth.users as security definer, service role only (T-0031, D1)', () => {
  const f = byName('_applicant_emails.sql');
  assert.ok(f, 'missing the applicant_emails migration');
  const { sql } = f;
  assert.match(sql, /create or replace function public\.applicant_emails\(p_candidate_ids uuid\[\]\)/);
  assert.match(sql, /returns table ?\(id uuid, email text\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /from auth\.users \w+ where \w+\.id = any\(p_candidate_ids\)/);
  assert.match(sql, /revoke execute on function public\.applicant_emails\(uuid\[\]\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.applicant_emails\(uuid\[\]\) to service_role/);
  const grants = sql.match(/grant [^;]*;/g) ?? [];
  assert.deepEqual(grants, ['grant execute on function public.applicant_emails(uuid[]) to service_role;']);
});

test('no migration file contains a carriage return (T-0030, .gitattributes eol=lf)', () => {
  for (const { file, raw } of RAW) assert.ok(!raw.includes('\r'), `${file}: CRLF line endings`);
});

test('20261104120200 re-creates every public function verbatim from its latest earlier definition (T-0030)', () => {
  const target = '20261104120200_function_bodies_lf.sql';
  const latest = new Map();
  for (const { file, raw } of RAW) {
    if (file >= target) continue;
    for (const m of raw.matchAll(FN_RE)) latest.set(m[1], m[0].replace(/^create function/i, 'create or replace function'));
  }
  const recreated = new Map([...RAW.find((r) => r.file === target).raw.matchAll(FN_RE)].map((m) => [m[1], m[0]]));
  assert.deepEqual([...recreated.keys()].sort(), [...latest.keys()].sort(), 'must cover every public function');
  for (const [name, stmt] of latest) assert.equal(recreated.get(name), stmt, `${name} must be byte-identical`);
});
