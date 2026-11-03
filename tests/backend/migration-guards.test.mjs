// T-0029 (offline, static): guards over supabase/migrations/*.sql.
// Reads the files only; no database. Comments are stripped before matching, so a
// rule mentioned in a comment never satisfies a check.
//
//   node --test tests/backend/migration-guards.test.mjs
//
// B2 (ROADMAP P0-2) and T-0020 extend this file (idempotency, score-on-apply).
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

test('migration version prefixes are unique (T-0029 files use 14 digits)', () => {
  for (const name of Object.values(T0029)) assert.ok(byName(name), `missing migration ${name}`);
  const long = files.filter((f) => /^\d{14}$/.test(f.prefix));
  const seen = new Map();
  for (const f of long) {
    assert.ok(!seen.has(f.prefix), `duplicate 14-digit version ${f.prefix}: ${seen.get(f.prefix)} and ${f.file}`);
    seen.set(f.prefix, f.file);
  }
  // Lengths differ, so an 8-digit version can never equal a 14-digit one; new files
  // must not reuse the old 8-digit form at all (owner decision 7).
  for (const f of files) {
    assert.match(f.prefix, /^(\d{8}|\d{14})$/, `${f.file}: version prefix must be 8 or 14 digits`);
    if (f.prefix.length === 8) assert.ok(f.sortKey < '20261103000000', `${f.file}: new migrations need a 14-digit prefix`);
  }
});

test('8-digit duplicate prefixes (I-0057, fixed in B2)', { todo: 'I-0057: 20260903 x2 and 20261015 x2; B2 (ROADMAP P0-2)' }, () => {
  const short = files.filter((f) => f.prefix.length === 8).map((f) => f.prefix);
  assert.equal(new Set(short).size, short.length);
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
