import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { createTimeoutFetch } from '../Services/internalHttp.js';
import { markDatabaseTimeout } from '../Middlewares/errorHandler.js';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
// BACKEND_ENV_FILE lets the offline tests (tests/backend/error-contract.test.mjs)
// point this client at a local stub instead of the real project.
const envPath = process.env.BACKEND_ENV_FILE || path.resolve(configDirectory, '../.env');

// R-04: a SESSION_SECRET given in the process environment wins over the file
// (tests/run-suite.ps1 gives core a test-only one). Captured before any .env load:
// this is the first module that loads one, and Config/supabaseAuth.js reloads the
// file with override later, so process.env alone cannot carry it. index.js reads
// configuredSessionSecret() and enforces the >= 32 character rule.
const sessionSecretFromProcess = process.env.SESSION_SECRET;

// The local API must use this project's credentials. Inherited Windows/VS Code
// variables can otherwise supply an old anon key: public jobs still load, but
// RLS hides profiles and makes the admin dashboard show zero users.
dotenv.config({ path: envPath, override: true, quiet: true });

const sessionSecretFromFile = process.env.SESSION_SECRET;
/** The session secret core must use: the process environment's, else backend/.env's. */
export const configuredSessionSecret = () => sessionSecretFromProcess || sessionSecretFromFile;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to backend/.env.'
  );
}

// The server relies on the service-role key to bypass RLS on every write
// (resumes, scores, storage, profiles). If an anon key lands in this slot —
// easy to do by copy/paste — reads still mostly work but every insert fails
// with "new row violates row-level security policy".
const decodeKeyRole = (jwt) => {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString()).role || null;
  } catch {
    return null;
  }
};

const keyRole = decodeKeyRole(supabaseServiceRoleKey);

// One unambiguous boot line: the role of the key this client is actually built
// with. If this ever says anything but "service_role", RLS errors on insert are
// explained. R-03: the project URL is not logged.
console.log(`[supabase] service client key role: ${keyRole ?? 'undecodable'}`);
if (keyRole && keyRole !== 'service_role') {
  console.warn(
    `[WARNING] SUPABASE_SERVICE_ROLE_KEY is a "${keyRole}" key, not "service_role". ` +
      'Database and storage writes will fail RLS.'
  );
}

// Pin the service-role key as the Authorization header for every REST/storage
// request. supabase-js otherwise swaps in an in-memory session token whenever
// one exists on this client (e.g. after auth.signInWithPassword), silently
// downgrading writes to the caller's RLS context. This client must never leave
// service-role context, so the header is fixed here and auth flows use their
// own short-lived clients instead (see auth.controller.js).
//
// R-03 (D§9): every call has a timeout (SUPABASE_TIMEOUT_MS, default 10 s) over
// headers and body. A timeout marks the request, so its error response becomes a
// 503 `database_timeout` (Middlewares/errorHandler.js) instead of hanging.
//
// R-04 follow-up A: the timeout is the whole budget of a client call. postgrest-js
// 2.112 retries GETs that fail or answer 503/520 (up to 3 more attempts, 1/2/4 s
// back-off, Retry-After honoured without a cap), each with a fresh timer, which
// stretched a call to ~47 s. Its supported option `db.retry: false` turns that off,
// so every call is exactly one attempt. Nothing in core retries a Supabase call
// (writes included). A 503/520 answer (PostgREST / Cloudflare "unavailable") is
// treated like a timeout: the request's error response becomes 503 database_timeout.
const SUPABASE_TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS) > 0 ? Number(process.env.SUPABASE_TIMEOUT_MS) : 10000;

const timeoutFetch = createTimeoutFetch({
  timeoutMs: SUPABASE_TIMEOUT_MS,
  onTimeout: markDatabaseTimeout,
  timeoutCode: 'SUPABASE_TIMEOUT',
  label: 'Supabase request',
});

const supabaseFetch = async (input, init) => {
  const res = await timeoutFetch(input, init);
  if (res.status === 503 || res.status === 520) markDatabaseTimeout();
  return res;
};

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { retry: false },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      apikey: supabaseServiceRoleKey,
    },
    fetch: supabaseFetch,
  },
});

/**
 * Health probe for GET /api/health: one cheap HEAD read. Resolves true when the
 * database answered; never throws, never returns error text.
 */
export async function probeDatabase(signal) {
  try {
    const { error } = await supabase.from('profiles').select('id', { head: true }).limit(1).abortSignal(signal);
    return !error;
  } catch {
    return false;
  }
}

export default supabase;
