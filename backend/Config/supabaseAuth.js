import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(configDirectory, '../.env');

dotenv.config({ path: envPath, override: true });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY. Add them to backend/.env.'
  );
}

// Dedicated client for USER-LEVEL auth operations (signUp, signInWithPassword,
// resend). A successful sign-in stores that user's JWT in this client's
// in-memory session. This client must therefore NEVER be used for privileged
// (service-role) work: sharing it would silently send the last logged-in
// user's token instead of the service key, and Storage/DB writes would start
// failing with "new row violates row-level security policy".
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default supabaseAuth;