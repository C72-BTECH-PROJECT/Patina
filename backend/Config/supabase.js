import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(configDirectory, '../.env');

// The local API must use this project's credentials. Inherited Windows/VS Code
// variables can otherwise supply an old anon key: public jobs still load, but
// RLS hides profiles and makes the admin dashboard show zero users.
dotenv.config({ path: envPath, override: true });

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
// explained.
console.log(`[supabase] service client key role: ${keyRole ?? 'undecodable'} (project ${supabaseUrl})`);
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
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      apikey: supabaseServiceRoleKey,
    },
  },
});

export default supabase;
