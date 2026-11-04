-- Patina T-0030 (I-0001): the `resumes` bucket's limits, in a migration.
--
-- The bucket row is created by 20260903000100_create_resumes_and_scores.sql
-- (private). Its size cap and MIME allow-list were set by hand in the dashboard
-- and existed in no migration, so a fresh environment got a bucket without them.
--
-- Values mirror the live bucket exactly (read 2026-11-04, T-0030 step B4):
--   file_size_limit    = 10485760 (10 MB)
--   allowed_mime_types = application/pdf, the DOCX type
-- On the live project this update changes nothing. The backend's multer cap uses
-- the same 10 MB (I-0025, B3).
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array[
         'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ]::text[]
 where id = 'resumes';
