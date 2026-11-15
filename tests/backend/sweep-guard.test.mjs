// Offline: the row ceiling of testdb.sweep() (tests/backend/lib/testdb.mjs), against a fake
// Supabase client. Nothing leaves the process and no row is touched.
//
// Before 2026-11-15 the ceiling was checked table by table while deleting, so a run that hit it
// at `scores` had already deleted `notifications` and `assessments`. Now every table and storage
// prefix is counted first and nothing is deleted if one is over the ceiling.
//
//   node --test tests/backend/sweep-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MAX_ROWS, sweep } from './lib/testdb.mjs';

// The counts `node tests/backend/sweep.mjs --check` showed on 2026-11-15.
const COUNTS = { notifications: 12, assessments: 36, scores: 52, resumes: 133, applications: 36, jobs: 3 };
const STORED = 24;

function fakeClient(counts = COUNTS) {
  const deletes = [];
  const query = (table, mode) => {
    const q = {
      in: () => q,
      like: () => q,
      then: (resolve) => resolve(mode === 'delete'
        ? (deletes.push(table), { error: null })
        : { count: counts[table] ?? 0, error: null }),
    };
    return q;
  };
  return {
    deletes,
    from: (table) => ({ select: () => query(table, 'count'), delete: () => query(table, 'delete') }),
    storage: {
      from: () => ({
        list: async () => ({ data: Array.from({ length: STORED }, (_, i) => ({ id: `o${i}`, name: `f${i}` })), error: null }),
        remove: async () => (deletes.push('storage'), { error: null }),
      }),
    },
  };
}
const ids = { C: 'candidate-id', R: 'recruiter-id' };

test('default ceiling is 50 and an over-limit table aborts before anything is deleted', async () => {
  assert.equal(DEFAULT_MAX_ROWS, 50);
  const sb = fakeClient();
  await assert.rejects(sweep(sb, ids), /exceed 50 rows per table \(scores=52, resumes=133\); nothing deleted/);
  assert.deepEqual(sb.deletes, [], 'no table was deleted');
});

test('a raised ceiling deletes every scoped table, in FK order, then storage', async () => {
  const sb = fakeClient();
  const removed = await sweep(sb, ids, { maxRows: 150 });
  assert.equal(removed.scores, 52);
  assert.equal(removed.resumes, 133);
  assert.deepEqual(sb.deletes.slice(0, 5), ['notifications', 'assessments', 'scores', 'resumes', 'applications']);
  assert.ok(sb.deletes.includes('storage'));
});

test('a ceiling that is not a positive integer is refused before any count', async () => {
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    const sb = fakeClient();
    await assert.rejects(sweep(sb, ids, { maxRows: bad }), /maxRows must be a positive integer/);
    assert.deepEqual(sb.deletes, []);
  }
});
