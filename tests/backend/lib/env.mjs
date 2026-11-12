// Minimal KEY=VALUE .env reader (no dependency on the backend's dotenv).
// Values are returned, never logged.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TESTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPO_DIR = resolve(TESTS_DIR, '..');

export function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

export const testEnv = () => ({ ...readEnvFile(join(TESTS_DIR, '.env')), ...process.env });

// Ports (I-0080, kept by the rebuild): the gateway owns :5000 and is the only public entry;
// backend core listens on 127.0.0.1:5001. Core binds loopback only, so its default is the
// literal 127.0.0.1, not "localhost" (which may resolve to ::1 first).
export const coreBaseUrl = () =>
  (process.env.CORE_BASE_URL || 'http://127.0.0.1:5001').replace(/\/+$/, '');
export const gatewayBaseUrl = () =>
  (process.env.GATEWAY_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
// The black-box backend tests (smoke, assessment smoke, live-*) assert core's own behaviour,
// so they target core directly. Through the gateway, deny-by-default answers 401 first and
// those assertions prove nothing about core. Set BACKEND_BASE_URL only to point them elsewhere
// (e.g. the baseline worktree's backend on :5100).
export const backendBaseUrl = () =>
  (process.env.BACKEND_BASE_URL || coreBaseUrl()).replace(/\/+$/, '');
