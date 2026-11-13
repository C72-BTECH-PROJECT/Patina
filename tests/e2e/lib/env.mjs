// R-19: URLs, paths and test accounts for the browser checks.
// Accounts come from tests/.env exactly as the backend live tests read them
// (tests/backend/lib/env.mjs testEnv(): tests/.env, then the process environment wins).
// Values are returned, never logged: errors name the missing variable, not its value.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TESTS_DIR, REPO_DIR, testEnv, gatewayBaseUrl } from '../../backend/lib/env.mjs';

export { TESTS_DIR, REPO_DIR, gatewayBaseUrl };

export const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUTPUT_DIR = join(E2E_DIR, 'output');

// The frontend dev server from scripts/start-all.ps1 (:3000). E2E_BASE_URL overrides it.
export const frontendBaseUrl = () =>
  (process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

const ACCOUNT_VARS = {
  candidate: ['TEST_CANDIDATE_USERNAME', 'TEST_CANDIDATE_PASSWORD'],
  recruiter: ['TEST_RECRUITER_USERNAME', 'TEST_RECRUITER_PASSWORD'],
};

export const ROLES = Object.freeze(Object.keys(ACCOUNT_VARS));

// { username, password } for the test candidate or test recruiter. Throws, naming only the
// variable, when tests/.env does not set it.
export function account(role) {
  const vars = ACCOUNT_VARS[role];
  if (!vars) throw new Error(`Unknown role "${role}"; expected one of: ${ROLES.join(', ')}`);
  const env = testEnv();
  const missing = vars.filter((v) => !env[v]);
  if (missing.length) {
    throw new Error(`tests/.env does not set ${missing.join(' and ')} (see tests/.env.example)`);
  }
  return { username: env[vars[0]], password: env[vars[1]] };
}
