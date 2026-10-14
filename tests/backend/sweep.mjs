// Standalone sweep for the T-0001 test accounts (run after MANUAL_SMOKE.md or
// after an interrupted live test).
//
//   node tests/backend/sweep.mjs                    delete test-account rows/objects, then print counts
//   node tests/backend/sweep.mjs --check            read-only: print counts, exit 1 if any are non-zero
//                                                   (a missing t0001_ profile counts as non-zero)
//   node tests/backend/sweep.mjs --restore-profiles re-insert t0001_ profile rows from
//                                                   tests/.out/t0001-profile-snapshots.json (idempotent),
//                                                   then print counts
//   node tests/backend/sweep.mjs --seed-job         sweep, then insert one published "[T-0001 TEST]" job
//                                                   owned by t0001_recr (for MANUAL_SMOKE.md)
import {
  client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, restoreProfiles, snapshotProfiles, sweep,
} from './lib/testdb.mjs';

const checkOnly = process.argv.includes('--check');
const restore = process.argv.includes('--restore-profiles');
const seedJob = process.argv.includes('--seed-job');
const cfg = liveConfig();
if (cfg.missing.length) {
  console.error(`tests/.env is missing: ${cfg.missing.join(', ')}`);
  process.exit(2);
}

const sb = client();
if (restore) console.log('restored profiles:', await restoreProfiles(sb));
const ids = await resolveAccounts(sb, cfg);
if (!ids._meta.missing.length) await snapshotProfiles(sb, ids);
if (!checkOnly && !restore) console.log('removed:', await sweep(sb, ids));
if (seedJob) {
  const jobId = await insertTestJob(sb, ids.R);
  console.log(`seeded job ${jobId} ("[T-0001 TEST] harness job"); run without flags afterwards to clean up`);
  process.exit(0);
}
const after = await counts(sb, ids);
console.log('remaining:', after);
process.exit(isZero(after) ? 0 : 1);
