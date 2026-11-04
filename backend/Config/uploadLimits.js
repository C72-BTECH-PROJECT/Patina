// The one resume size limit in core (I-0025). It must equal `file_size_limit` of
// the `resumes` bucket (supabase/migrations/20261104120000_resumes_bucket_limits.sql);
// tests/backend/upload-limits.test.mjs fails if they differ.
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
