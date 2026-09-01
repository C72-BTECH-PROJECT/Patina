import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Local Windows sessions can retain old SUPABASE_* system variables. In
// development, the project-specific backend/.env must be authoritative so the
// API and local verification queries always target the same Supabase project.
dotenv.config({ override: process.env.NODE_ENV !== 'production' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to backend/.env.'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default supabase;
