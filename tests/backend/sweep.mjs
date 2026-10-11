// Standalone sweep for the T-0001 test accounts (run after MANUAL_SMOKE.md or
// after an interrupted live test).
//
//   node tests/backend/sweep.mjs             delete test-account rows/objects, then print counts
//   node tests/backend/sweep.mjs --check     read-only: print counts, exit 1 if any are non-zero
//   node tests/backend/sweep.mjs --seed-job  sweep, then insert one published "[T-0001 TEST]" job
//                                            owned by t0001_recr (for MANUAL_SMOKE.md)
import { client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, sweep } from './lib/testdb.mjs';

const checkOnly = process.argv.includes('--check');
const seedJob = process.argv.includes('--seed-job');
const cfg = liveConfig();
if (cfg.missing.length) {
  console.error(`tests/.env is missing: ${cfg.missing.join(', ')}`);
  process.exit(2);
}

const sb = client();
const ids = await resolveAccounts(sb, cfg);
if (!checkOnly) console.log('removed:', await sweep(sb, ids));
if (seedJob) {
  const jobId = await insertTestJob(sb, ids.R);
  console.log(`seeded job ${jobId} ("[T-0001 TEST] harness job"); run without flags afterwards to clean up`);
  process.exit(0);
}
const after = await counts(sb, ids);
console.log('remaining:', after);
process.exit(isZero(after) ? 0 : 1);
