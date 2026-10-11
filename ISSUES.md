Storage bucket `resumes` was created manually in the Supabase dashboard
(2026-08-31) with an allowed_mime_types allow-list. It is NOT in any
migration, so a fresh environment won't have it. Move bucket creation +
MIME config into a migration.

Noticed, not fixed (out of scope) after nlp fix

- SkillsSelector in Upload.jsx — hardcoded "Suggested Skills" chips, never wired (selectedSkills/onToggle props never passed).
- Upload.jsx "Choose File" path still doesn't validate file type (drag-drop does).
- "exponentjs" and similar apparent AI-cruft entries remain in SKILL_KEYWORDS.
- Assessment.jsx still unrouted / no backend (already tracked).