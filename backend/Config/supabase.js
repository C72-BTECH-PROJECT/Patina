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

// Startup guard: prove which role the configured key actually carries. An
// anon/other key here silently breaks privileged writes (e.g. Storage uploads
// fail with "new row violates row-level security policy") while public reads
// keep working, which makes the bug very hard to trace from symptoms alone.
const keyRoleClaim = (() => {
  try {
    const payloadPart = supabaseServiceRoleKey.split('.')[1];
    const payload = JSON.parse(
      Buffer.from(payloadPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    return payload.role || 'unknown';
  } catch {
    return 'not-a-jwt';
  }
})();
console.log(
  `[supabase] url=${supabaseUrl} key-role=${keyRoleClaim} key=...${supabaseServiceRoleKey.slice(-6)}`
);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default supabase;
