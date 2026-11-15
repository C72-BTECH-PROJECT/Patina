// Standalone sweep for the T-0001 test accounts (run after MANUAL_SMOKE.md or
// after an interrupted live test).
//
//   node tests/backend/sweep.mjs                    print the scoped counts, delete test-account rows/objects,
//                                                   then print what remains
//   node tests/backend/sweep.mjs --max-rows N       same, with the per-table ceiling raised from 50 to N.
//                                                   Only the ceiling changes: every delete is still filtered
//                                                   by the t0001_ account ids (and test title tags for jobs)
//   node tests/backend/sweep.mjs --check            read-only: print counts, exit 1 if any are non-zero
//                                                   (a missing t0001_ profile counts as non-zero)
//   node tests/backend/sweep.mjs --restore-profiles re-insert t0001_ profile rows from
//                                                   tests/.out/t0001-profile-snapshots.json (idempotent),
//                                                   then print counts
//   node tests/backend/sweep.mjs --seed-job         sweep, then insert one published "[T-0001 TEST]" job
//                                                   owned by t0001_recr (for MANUAL_SMOKE.md)
import {
  DEFAULT_MAX_ROWS, client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, restoreProfiles,
  snapshotProfiles, sweep,
} from './lib/testdb.mjs';

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const restore = argv.includes('--restore-profiles');
const seedJob = argv.includes('--seed-job');

let maxRows = DEFAULT_MAX_ROWS;
const maxIdx = argv.indexOf('--max-rows');
if (maxIdx !== -1) {
  const raw = argv[maxIdx + 1];
  maxRows = Number(raw);
  if (!/^\d+$/.test(raw ?? '') || maxRows < 1) {
    console.error(`--max-rows needs a positive integer (got "${raw ?? ''}")`);
    process.exit(2);
  }
}

const cfg = liveConfig();
if (cfg.missing.length) {
  console.error(`tests/.env is missing: ${cfg.missing.join(', ')}`);
  process.exit(2);
}

const sb = client();
if (restore) console.log('restored profiles:', await restoreProfiles(sb));
const ids = await resolveAccounts(sb, cfg);
if (!ids._meta.missing.length) await snapshotProfiles(sb, ids);
if (!checkOnly && !restore) {
  console.log(`scoped to t0001_ accounts (${Object.values(ids._meta.usernames).join(', ')}); ceiling ${maxRows} rows per table`);
  console.log('would remove:', await counts(sb, ids));
  try {
    console.log('removed:', await sweep(sb, ids, { maxRows }));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
if (seedJob) {
  const jobId = await insertTestJob(sb, ids.R);
  console.log(`seeded job ${jobId} ("[T-0001 TEST] harness job"); run without flags afterwards to clean up`);
  process.exit(0);
}
const after = await counts(sb, ids);
console.log('remaining:', after);
process.exit(isZero(after) ? 0 : 1);
