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

export const backendBaseUrl = () =>
  (process.env.BACKEND_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
