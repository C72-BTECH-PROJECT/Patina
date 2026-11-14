// Remove résumé files in the `resumes` storage bucket whose owner no longer has an account.
// Written 2026-11-13 (TASKS O-9). Run by Anthony, never by an agent.
//
//   node tests/backend/purge-orphan-resume-files.mjs           dry run: lists the files, deletes nothing
//   node tests/backend/purge-orphan-resume-files.mjs --apply   deletes exactly the files the dry run lists
//
// Why they exist: deleting a profile or an auth user cascades through every table, but nothing
// removes the stored files, so a deleted account's résumé stays in the bucket.
//
// A file is listed only when ALL of these hold:
//   - it sits in an owner folder, `candidates/<uuid>/` (current form) or `<uuid>/` (old form);
//   - that uuid is not the id of any auth user;
//   - that uuid is not the id of any profile row;
//   - no `resumes` row belongs to that uuid.
// Anything else in the bucket (files at the top level, folders whose name is not a uuid) is
// reported as "not touched" and never deleted. The script stops without deleting if the auth
// user list or the profile list cannot be read, or if more than MAX_FILES files would go.
import { client } from './lib/testdb.mjs';

const BUCKET = 'resumes';
const MAX_FILES = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const apply = process.argv.includes('--apply');
const sb = client();

async function authUserIds() {
  const ids = new Set();
  for (let page = 1; ; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth user list failed: ${error.message}`);
    for (const user of data.users) ids.add(user.id);
    if (data.users.length < 1000) return ids;
  }
}

async function columnValues(table, column) {
  const values = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(column).range(from, from + 999);
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    for (const row of data) values.add(row[column]);
    if (data.length < 1000) return values;
  }
}

async function list(prefix) {
  const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`storage list "${prefix}" failed: ${error.message}`);
  return data ?? [];
}

const [authIds, profileIds, resumeOwnerIds] = await Promise.all([
  authUserIds(), columnValues('profiles', 'id'), columnValues('resumes', 'candidate_id'),
]);
if (authIds.size === 0 || profileIds.size === 0) {
  throw new Error('guard: the auth user list or the profile list is empty; refusing to judge any file an orphan');
}

const ownerFolders = [];
const notTouched = [];
for (const entry of await list('')) {
  if (entry.id) { notTouched.push(entry.name); continue; }
  if (entry.name === 'candidates') {
    for (const child of await list('candidates')) {
      if (!child.id && UUID.test(child.name)) ownerFolders.push({ prefix: `candidates/${child.name}`, owner: child.name });
      else notTouched.push(`candidates/${child.name}`);
    }
  } else if (UUID.test(entry.name)) ownerFolders.push({ prefix: entry.name, owner: entry.name });
  else notTouched.push(`${entry.name}/`);
}

const orphans = [];
let keptFolders = 0;
for (const { prefix, owner } of ownerFolders) {
  if (authIds.has(owner) || profileIds.has(owner) || resumeOwnerIds.has(owner)) { keptFolders += 1; continue; }
  for (const object of await list(prefix)) {
    if (object.id) orphans.push(`${prefix}/${object.name}`);
    else notTouched.push(`${prefix}/${object.name}/`);
  }
}

console.log(`Owner folders: ${ownerFolders.length}; with a live account or a resumes row (kept): ${keptFolders}.`);
console.log(`Files whose owner has no auth user, no profile and no resumes row: ${orphans.length}`);
for (const path of orphans) console.log(`  ${path}`);
if (notTouched.length) console.log(`Not touched (not an owner folder or file): ${notTouched.join(', ')}`);

if (!apply) {
  console.log('\nDry run: nothing was deleted. Re-run with --apply to delete exactly the files listed above.');
  process.exit(0);
}
if (orphans.length === 0) { console.log('\nNothing to delete.'); process.exit(0); }
if (orphans.length > MAX_FILES) throw new Error(`guard: ${orphans.length} files would be deleted (limit ${MAX_FILES}); nothing deleted`);

const { data: removed, error } = await sb.storage.from(BUCKET).remove(orphans);
if (error) throw new Error(`storage remove failed: ${error.message}`);
console.log(`\nDeleted ${removed?.length ?? 0} of ${orphans.length} files.`);
process.exit((removed?.length ?? 0) === orphans.length ? 0 : 1);
