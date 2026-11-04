// T-0031 (h) (offline): I-0039. Deleted cruft stays deleted.
//
//   node --test tests/backend/backend-cruft.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';

for (const file of ['backend/Middlewares/authCand.Middleware.js', 'backend/Middlewares/authRec.Middleware.js', 'dev/null']) {
  test(`${file} is gone`, () => {
    assert.ok(!existsSync(join(REPO_DIR, file)), `${file} still exists`);
  });
}

test('bcrypt is in neither package.json nor the lockfile', () => {
  const pkg = JSON.parse(readFileSync(join(REPO_DIR, 'backend', 'package.json'), 'utf8'));
  assert.ok(!pkg.dependencies?.bcrypt, 'bcrypt is still a dependency');
  const lock = JSON.parse(readFileSync(join(REPO_DIR, 'backend', 'package-lock.json'), 'utf8'));
  assert.ok(!lock.packages?.['']?.dependencies?.bcrypt, 'bcrypt is still in the lock root');
  assert.ok(!lock.packages?.['node_modules/bcrypt'], 'bcrypt is still a locked package');
});
