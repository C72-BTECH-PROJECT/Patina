# REVIEW_BRIEF.md — Guide Review Preparation

_Every claim here traces to `AUDIT.md` or `CODE_MAP.md`. Where a module is
specced but unbuilt, this brief says so and pivots to design rationale — it
never implies the module works. No accuracy, F1, latency, or correlation
figures appear anywhere because **no formal evaluation has been run**
(`AUDIT.md` Module 6 — every row MISSING)._

Ground truth in one breath:
- Live: **resume parsing → semantic alignment → persisted, auditable credibility score**, end to end.
- Designed, not built: GitHub evidence validation (Module 2), Generative AI assessment (Module 3).
- Score today ≈ `round(parsing similarity × 100)` because parsing is the only evidence source feeding it (`AUDIT.md` §4.1, Module 4 note).
- Auth is Supabase email/password + Express session, **not OAuth 2.0** (`AUDIT.md` §0.4).
- No OCR, no custom-trained NER model, no test suite, no benchmarks (`AUDIT.md` §1.2, §1.5, §1.11–1.13).

---

## 1. SPOKEN STATE-OF-PROJECT SCRIPT (~2–3 minutes, read aloud)

Patina reframes resume screening from keyword matching to evidence-based skill
validation. The system is built as a three-tier microservice split: a React
front end, a Node/Express application layer that owns routing, sessions and
role-based authorization, and an independently deployable Python FastAPI
service that does the actual natural-language work. Persistence is Supabase
Postgres, with row-level-security policies defined on every table and a private
storage bucket holding the raw resume files. The design target is a four-part
pipeline — resume parsing, GitHub evidence validation, an LLM-generated
technical assessment, and a unified credibility score with a full
explainability layer. What is live today is the first of those four: the
parsing and semantic-alignment engine, working end to end, from file upload to
a persisted and auditable score.

Concretely, a candidate uploads a PDF or DOCX and selects the job they are
applying to. The Node layer looks that job up and forwards the file, together
with the job's structured required-skills and preferred-skills arrays and its
description text, to the FastAPI engine. There, pdfplumber or python-docx
extracts the raw text, spaCy runs a preprocessing pass, and a section-scoped
NER stage segments the document into experience, education and projects and
extracts entities only from the section they belong to. That scoping is a
deliberate fix: it means a phone number can no longer be misread as an
employment date, and an action-verb bullet can no longer be promoted into a
fake job title — the extractor now returns an empty list where a section is
genuinely absent, rather than inventing content. Skills are matched against a
curated technical vocabulary and then normalised, so that "Node.js", "nodejs"
and "node js" collapse to a single canonical token on both the resume side and
the job side before they are compared. Then a MiniLM sentence-transformer
encodes the candidate's skill evidence and the job description into embeddings
and computes a real cosine similarity — that is the semantic layer, and it is
there to catch vocabulary the fixed keyword list would miss. The engine returns
matched and missing skills, a skill-coverage ratio measured against the
structured job requirements, and that semantic score, blended into one parsing
sub-score.

That sub-score is handed to a dedicated explainability service in the Node
layer. It normalises every evidence source onto a common zero-to-one-hundred
scale, applies a documented and configurable weighting scheme, and then
redistributes weight across only the evidence sources that actually produced
data. GitHub validation and the AI assessment are specced and designed but not
yet built, so today they report "evidence not available" with a stored reason,
their weight is zero, and that weight is redistributed to parsing rather than
being counted as a zero score against the candidate. That is a deliberate
property of the scoring model — it comes straight from the guide feedback that
GitHub must be optional and that a missing source must never be scored as
zero-competence — and not something we are papering over. Every score is
persisted with its full factor breakdown, its per-skill evidence, and the exact
weighting scheme used, so a recruiter can drill from the composite number down
to the individual matched skill or similarity metric that produced it.

I want to be straightforward about status. Parsing is the only live evidence
source. The NER stage is section-scoping plus regex-and-dictionary matching
over a stock spaCy model — not a custom-trained model yet. There is no OCR
path, so a scanned image-only resume currently yields no text. We have run no
formal evaluation, so I will not quote accuracy, F1 or latency numbers. What is
real and working is the architecture, the parse-to-score-to-explanation loop,
and an explainability layer that is genuinely built to absorb the remaining two
evidence sources as they come online.

---

## 2. END-TO-END TRACE (narrate this over the live demo)

One resume upload, file and function at each hop. Sources: `CODE_MAP.md` §1–§4,
`AUDIT.md` "Data flow that actually runs".

| # | Hop | File → function | What happens |
|---|---|---|---|
| 1 | Pick file + job | `frontend/src/pages/candidate/Upload.jsx` → `handleFileChange` / `handleDrop`; `GET http://localhost:5000/api/jobs` populates the job `<select>` | Candidate selects a PDF/DOCX and a job. Drag-drop validates file type; the "Choose File" path does not (`CODE_MAP.md` §3.4). "Analyze Resume" → `handleAnalyze` → `navigate('/candidate/processing', { state: { file, jobId } })`. No upload yet. |
| 2 | Submit | `frontend/src/pages/candidate/Processing.jsx` → analyze effect | Reads `location.state.{file, jobId}`. Builds `FormData` with `resume` (the file) + `jobId`. **`XMLHttpRequest`** `POST ${API_BASE_URL}/api/analyze`, `xhr.withCredentials = true`, real `upload.onprogress` for the upload bar, then an indeterminate "analyzing" state. |
| 3 | Route + auth | `backend/index.js` (mounts `/api` → analysis routes) → `backend/Routes/analysis.routes.js` → `requireRole('CANDIDATE')` → `backend/Middlewares/auth.Middleware.js` → `requireAuth` | Session cookie `patina_session` checked; one `profiles.select('is_suspended')` round-trip; role must be `CANDIDATE`. |
| 4 | Controller entry | `backend/Controllers/analysis.controller.js` → `analyzeResume` = `[ upload.single('resume'), handler ]` | multer memory-storage buffers the file. `candidateId = req.session.userId`. 400 if no file / no `jobId`. |
| 5 | Job lookup | same file, `analyzeResume` | `supabase.from('jobs').select('id, title, description, required_skills, preferred_skills, experience_level, location').eq('id', jobId).eq('status','published').maybeSingle()` → 404 if none. |
| 6 | Forward to NLP | same file, `analyzeResume` | `form-data`: `resume` = buffer, `jd` = `job.description`, `required_skills` = `JSON.stringify(job.required_skills ?? [])`, `preferred_skills` = same. `fetch(NLP_PARSE_URL)` (default `http://localhost:8000/parse`). Non-OK → HTTP 502, pipeline stops. |
| 7 | NLP entry | `nlp-engine/app/main.py` → `parse_resume` | Saves upload to `uploads/<uuid>.<ext>`; orchestrates the four stages below; deletes the temp file in `finally`. No try/except → any error is HTTP 500. |
| 8 | Text extraction | `nlp-engine/app/extractor.py` → `extract_text` → `extract_from_pdf` (pdfplumber) / `extract_from_docx` (python-docx) | Concatenates page/paragraph text. **No OCR** — image-only PDF returns `""`. |
| 9 | Preprocessing | `nlp-engine/app/preprocessor.py` → `preprocess` | spaCy tokenize/lemmatize/sentence-split/noun-chunks. Output is preview-only — nothing downstream scores off it (`CODE_MAP.md` §1.3). |
| 10 | NER / entities | `nlp-engine/app/ner.py` → `extract_entities` → `split_sections`, `_extract_experience`, `_extract_education`, `_extract_projects`, `extract_skills` | Sections split by heading detection; experience/education/projects extracted **only from their own section** (empty list if absent); skills matched against `SKILL_KEYWORDS` (~185) + `SKILL_ALIASES` + `GENERIC_SKILL_PATTERNS`; name/email/phone/github/linkedin by regex. |
| 11 | Semantic alignment | `nlp-engine/app/embedder.py` → `analyse` → `_resolve_jd_skills`, `compute_similarity`, `_focused_resume_text` | `resume_skills` and `jd_skills` normalised via `ner.normalize_skills`; `jd_source` = `structured_skills` (the arrays) or `parsed_description` (fallback). `skill_coverage = matched / jd_skills`. `semantic_score = 0.65·focused + 0.35·full_text` (MiniLM cosine). `final_score = 0.6·skill_coverage + 0.4·semantic_score`. |
| 12 | NLP response | `main.py` → `parse_resume` return | JSON: `entities.*` + `semantic_analysis.*` (`similarity_score`, `skill_coverage`, `matched_skills`, `missing_skills`, `jd_skills`, `resume_skills`, `jd_source`, `component_weights`, `match_level`, `match_reason`). |
| 13 | Store the file | back in `analysis.controller.js` → `analyzeResume` | Best-effort `supabase.storage.from('resumes').upload('<candidateId>/<uuid><ext>', buffer, { contentType: resolveContentType(file) })`. On failure: logged, `file_ref` stays null, pipeline continues. |
| 14 | Persist parsed resume | same file | `resumes` insert: `contact`, `skills`, `experience`, `education`, `projects`, `project_links = [github, linkedin].filter(Boolean)`, `parser_version`. Insert error → HTTP 500. |
| 15 | Build the score | `backend/Services/explainability.js` → `buildScoreRecord` → `buildParsingSubScore`, `unavailableSubScore(GITHUB)`, `unavailableSubScore(ASSESSMENT)`, `aggregate`, `buildExplanation`, `buildSkillEvidence`, `buildFlags` | Parsing sub-score `value = similarity × 100`. GitHub + assessment → `{ available:false, value:null, weight:0, reason }`. `aggregate` redistributes base weights (parsing `0.40 → 1.0`); `composite = value × weight`. `buildExplanation` emits the persisted factor/evidence record. `buildFlags` returns an empty, "not available" flag state (no logic). |
| 16 | Persist the score | `analysis.controller.js` → `analyzeResume` | `scores` insert: `composite_score`, `subscores`, `weights`, `explanation`, `evidence_limited`. Then `serializeCandidate({ score, resume, job })` returned to the browser. |
| 17 | Candidate sees it | `frontend/src/pages/candidate/Processing.jsx` → `navigate('/candidate/results', { state: { analysis } })` → `frontend/src/pages/candidate/Results.jsx` | Renders composite score, parsed skills/experience/education/projects, `explanation.summary`, then delegates to `<ScoreBreakdown analysis={analysis} />`. Direct-open fallback: `GET /api/candidate-analysis`. |
| 18 | Breakdown renders | `frontend/src/components/recruiter/ScoreBreakdown.jsx` | Reads `explanation.factors[]` (each with `direction`, `weight_pct`, `contribution`, `evidence[]`), `skillEvidence[]`, `flags` state. GitHub + assessment factors render an explicit "Evidence not available" panel with the stored reason. |
| 19 | Recruiter view | `frontend/src/pages/recruiter/Dashboard.jsx` → `GET /api/candidates` → `analysis.controller.js` → `getAllCandidates` → `frontend/src/components/recruiter/CandidateModal.jsx` → `ScoreBreakdown.jsx` | `getAllCandidates` reads `scores ⨝ resumes ⨝ profiles` scoped to the recruiter's jobs, dedupes to latest per candidate, sorts by `composite_score`. Same breakdown component as the candidate sees. |

---

## 3. Q&A

Format per entry — **Q**, spoken answer (2–4 sentences), **If pressed** (one
line), **Open** (the file).

### (a) NLP pipeline internals

**Q. Walk me through the parsing pipeline, stage by stage.**
Four stages in the FastAPI service. Text extraction with pdfplumber or
python-docx; a spaCy preprocessing pass; a section-scoped NER stage that splits
the document by headings and extracts experience, education, projects and
skills from within their own sections; and a semantic-alignment stage that
normalises the skill sets and computes a MiniLM cosine similarity between the
candidate's skill evidence and the job description. The output is a structured
JSON entity set plus a parsing sub-score.
**If pressed:** the four stages are `extract_text` → `preprocess` →
`extract_entities` → `analyse`, orchestrated by `parse_resume`.
**Open:** `nlp-engine/app/main.py`.

**Q. You call it layout-aware — does it actually preserve columns and tables?**
No, not yet. We use pdfplumber, which is a layout-aware library, but the
current code concatenates `page.extract_text()` per page into a flat string, so
multi-column ordering and table structure are lost; the DOCX path similarly
ignores tables and text boxes. The section-scoping stage then re-segments that
flat text by line-level heading detection. Genuine column/table-preserving
extraction is a known gap.
**If pressed:** `AUDIT.md` §1.3 classifies this DONE_BUT_BROKEN_OR_HACKY — "a
naive full-text dump".
**Open:** `nlp-engine/app/extractor.py`.

**Q. What does the preprocessing step actually contribute to the result?**
Honestly, at the moment it is not wired into scoring. `preprocess` runs spaCy
tokenisation, lemmatisation, sentence splitting and noun-chunking, but the NER
and semantic stages both re-parse the raw text independently, so the
preprocessed tokens currently only appear as previews in the response. The
hook is there; connecting NER to consume it is outstanding work.
**If pressed:** `noun_chunks` is passed into `analyse()` and then explicitly
deleted — `CODE_MAP.md` §1.3, `embedder.py:123`.
**Open:** `nlp-engine/app/preprocessor.py`.

**Q. Is the NER a custom-trained model? Which dataset?**
No. It is the stock spaCy `en_core_web_sm` model used for PERSON, ORG and DATE
entities, combined with a curated technical-skill dictionary of about 185 terms
and a set of regexes. The spec calls for a model trained on the Hugging Face
"Annotated NER PDF Resumes" set; we have not done that training yet, so this is
the honest weakest part of Module 1.
**If pressed:** `AUDIT.md` §1.5 — DONE_BUT_BROKEN_OR_HACKY, "no custom NER
model, no training".
**Open:** `nlp-engine/app/ner.py` (`SKILL_KEYWORDS`, `extract_entities`).

**Q. Skill extraction against a hand-written list — isn't that exactly the
keyword matching you set out to replace?**
For the extraction step, yes, it is dictionary-and-regex matching, and I won't
pretend otherwise. The part that goes beyond keyword matching is the semantic
layer on top: the MiniLM embedding similarity between the candidate's evidence
and the job description contributes to the score independently of whether the
literal keyword matched. The end state replaces the dictionary with a trained
NER model; the embedding layer that makes it more than an ATS is already there.
**If pressed:** the final parsing score is `0.6·skill_coverage + 0.4·semantic`
— see the honest answer in section (g) about that 60% (`embedder.py:152`).
**Open:** `nlp-engine/app/embedder.py` (`analyse`).

**Q. What is the "section-scoping fix" and what was broken before it?**
Before, the extractor pushed every spaCy ORG and DATE entity in the whole
document into the experience list — so phone numbers tagged as dates and
acronyms like "SVG" or "SSL" tagged as organisations showed up as fabricated
job history, and action-verb bullet lines became their own fake projects.
The fix adds `split_sections`, which detects headings and buckets lines, and
each extractor now reads only its own section and returns an empty list when
that section is genuinely absent. Extraction is now honest rather than
invented.
**If pressed:** `AUDIT.md` §1.5 and the "Parsing / JD-source fixes 2026-09-03"
appendix list the four specific defects fixed.
**Open:** `nlp-engine/app/ner.py` (`split_sections`, `_extract_experience`).

**Q. How is experience extracted, and what happens with no "Experience" heading?**
Within the detected experience section, each header-like line becomes an entry
with title, organisation, dates and highlight bullets; `_split_role_and_org`
decides which half of a line is the employer using company-suffix cues and
spaCy ORG entities. If there is no experience section at all, the result is an
empty list — deliberately, so we never fabricate a work history that isn't
there.
**If pressed:** date spans come from `_DATE_RANGE_RE`; a lone year can still be
mislabelled as a date span, which is a known rough edge (`CODE_MAP.md` §1.4).
**Open:** `nlp-engine/app/ner.py` (`_extract_experience`).

**Q. How do you distinguish a project title from a bullet point?**
A line is only treated as a project title if it matches a title pattern —
"Title | stack", "Title — tech", or "Title:" — or is a short heading-like line
immediately followed by a bullet. Lines starting with an action verb
("Engineered…", "Deployed…") are attached to the current project's description
instead of starting a new one. Outside a projects section the bar is higher —
the line must also contain the word "project".
**If pressed:** plain-hyphen "Title - tech" is deliberately excluded because it
collides with prose (`_looks_like_project_title`).
**Open:** `nlp-engine/app/ner.py` (`_extract_projects`).

**Q. Which embedding model, and why not S-BERT proper?**
We use `all-MiniLM-L6-v2`, a sentence-transformer that produces 384-dimensional
sentence embeddings, and we compute a real normalised cosine similarity. The
spec says "S-BERT or equivalent"; MiniLM is the equivalent — it is the same
sentence-embedding family, much smaller and faster, which matters because the
service loads it at import alongside two spaCy models.
**If pressed:** `AUDIT.md` §1.6 — DONE_CORRECTLY, "genuine sentence
embeddings… the strongest-built piece".
**Open:** `nlp-engine/app/embedder.py` (`model`, `compute_similarity`).

**Q. What exactly gets embedded — the whole resume?**
Two comparisons. One is a "focused" text we build — the candidate's normalised
skill list plus the resume lines that actually mention those skills — compared
against the job description. The other is the first 8,000 characters of raw
resume text against the same job description. The focused similarity is
weighted 0.65 and the full-text 0.35 into the semantic score.
**If pressed:** those two literals live at `embedder.py:142`; the focused text
is built by `_focused_resume_text` / `_skill_evidence_lines`.
**Open:** `nlp-engine/app/embedder.py`.

**Q. How is the parsing sub-score computed from those pieces?**
`skill_coverage` is the fraction of the job's required skills found on the
resume. `semantic_score` is the 0.65/0.35 blend of the two cosine
similarities. The final parsing score is `0.6 · skill_coverage + 0.4 ·
semantic_score`, clamped to [0,1], then scaled to 0–100. If the job has no
structured skills at all, coverage is undefined and the score falls back to
the semantic score alone.
**If pressed:** the 0.60/0.40 split is the named constants
`SKILL_COVERAGE_WEIGHT` / `SEMANTIC_SCORE_WEIGHT` and is emitted as
`component_weights` so Node doesn't re-hardcode it.
**Open:** `nlp-engine/app/embedder.py` (`analyse`, lines 17–18, 152).

**Q. Where do the job's skills come from — you parse the job description?**
Primarily from the job's structured `required_skills` and `preferred_skills`
arrays, which the recruiter enters when creating the job — that is the
authoritative source. The markdown description text is used only as the
semantic-similarity target, and it is keyword-scraped for skills only as a
fallback when both arrays are empty. The response records which source was
used in a `jd_source` field.
**If pressed:** this replaced an earlier bug where a candidate-pasted JD was
being scored against — `AUDIT.md` "Parsing / JD-source fixes 2026-09-03".
**Open:** `nlp-engine/app/embedder.py` (`_resolve_jd_skills`).

**Q. Are required and preferred skills weighted differently?**
Not yet — they are currently merged and matched with equal weight. A distinct
lower weight for preferred skills is a deliberate deferral: the only job row in
our database has an empty preferred-skills array, so introducing an untested
scoring weight for data that doesn't exist was out of scope.
**If pressed:** noted as a future item in `AUDIT.md` §1.14 and the parsing-fix
appendix.
**Open:** `nlp-engine/app/embedder.py` (`_resolve_jd_skills`, comment lines
95–99).

**Q. How does normalisation work, and what about a skill not in your vocabulary?**
`normalize_skill` lowercases, strips punctuation, and maps through an
alias table plus an extra-normalisation table, so "Node.js", "nodejs" and
"node js" become one token, and "k8s" becomes "kubernetes", on both the resume
and job side before they are intersected. A skill that isn't in any table is
kept as its cleaned string — so it can still match verbatim, but it won't
match a synonym.
**If pressed:** `normalize_skills` is applied in `embedder.analyse` before the
set intersection; `entities.skills` in the response is the un-normalised list
(`CODE_MAP.md` §1.4).
**Open:** `nlp-engine/app/ner.py` (`normalize_skill`, `_EXTRA_NORMALISATION`).

**Q. So synonym matching only happens in the embedding, not the skill match itself?**
Correct. The literal skill intersection is exact-match on normalised tokens; it
catches spelling and formatting variants but not true synonyms like "ML" versus
"machine learning" unless they're in the alias table. Semantic synonymy is
handled by the MiniLM similarity, which contributes 40% of the parsing score.
Folding embeddings into the skill-level match itself is a design improvement we
have identified.
**If pressed:** `AUDIT.md` §1.7 — the layers "exist but don't feed each other".
**Open:** `nlp-engine/app/embedder.py` (`analyse`).

**Q. What happens with a scanned, image-only PDF?**
Right now, nothing useful — pdfplumber returns an empty text layer, so the
entity set comes back empty and the score is near zero. OCR is not implemented.
The guide flagged OCR as mandatory and we agree; it is a defined next step —
route no-text-layer PDFs through an OCR engine and then into the same
pipeline.
**If pressed:** `AUDIT.md` §1.2 — MISSING; no OCR library in
`nlp-engine/requirements.txt`.
**Open:** `nlp-engine/app/extractor.py`.

**Q. Your response has skills listed twice with different spellings — why?**
That is a real inconsistency. `entities.skills` is the raw dictionary-matched
list and `semantic_analysis.resume_skills` is the normalised list, and Node
currently persists the raw one to the `resumes` table while scoring uses the
normalised one. It doesn't affect the score but it should be unified.
**If pressed:** `CODE_MAP.md` §1.4 and the DEAD/MISLEADING table.
**Open:** `nlp-engine/app/ner.py` (`extract_entities`, line ~534).

**Q. What's the latency?**
We have not benchmarked it, so I won't give a number. The known cost is that
the first request after start-up lazily loads two spaCy models and the MiniLM
model; steady-state requests are a single synchronous round-trip with no
queue.
**If pressed:** `AUDIT.md` §1.13 / §6.3 — MISSING, "no benchmark".
**Open:** `AUDIT.md` §1.13.

### (b) Architecture and the microservice split

**Q. Why a microservice split for a project this size?**
Because the workloads are genuinely different: the Python service needs spaCy,
sentence-transformers and PDF libraries and benefits from scaling on its own,
while the Node layer is I/O-bound routing, sessions and database work. The spec
also mandates independently deployable services. It also lets the two unbuilt
Python services — GitHub aggregation and assessment — slot in as peers without
touching the Node layer.
**If pressed:** `AUDIT.md` §0.1 — STUBBED_OR_PARTIAL; the tier boundary is
real, but only one of the three Python services exists.
**Open:** `backend/index.js`, `nlp-engine/app/main.py`.

**Q. Why is the scoring/explainability engine in Node and not a Python service?**
It is aggregation logic, not ML — normalise, weight, redistribute, emit an
explanation record — and it is pure, with no model dependencies. Keeping it in
the Node layer, next to the database writes and the API that serves the
dashboard, avoids a network hop and a fourth deployable for what is
arithmetic. If it grows model-based components later it can be extracted.
**If pressed:** `backend/Services/explainability.js` is a pure module — no DB,
no network, no imports (`CODE_MAP.md` §2.4).
**Open:** `backend/Services/explainability.js`.

**Q. The SRS says MongoDB — why Supabase?**
Supabase gives us Postgres with row-level-security policies, authentication and
file storage in one managed service, which covers the User entity, the auth
requirement and resume-file storage without standing up three things. The
project treats Supabase as the authoritative data layer; the SRS's MongoDB is
superseded.
**If pressed:** `CLAUDE.md` and `PROJECT_SOURCE_DOCS.md` §3.1 both state
Supabase is authoritative.
**Open:** `backend/Config/supabase.js`.

**Q. How do the services communicate, and what happens if the NLP service is down?**
Node forwards a multipart request to the FastAPI `/parse` endpoint over HTTP.
If that call fails, the analyze request returns HTTP 502 and stops — there is
no retry and no degraded-score fallback today. Graceful degradation on external
calls is a specified requirement we have not implemented.
**If pressed:** `AUDIT.md` §0.7 — MISSING; `analysis.controller.js` returns 502
on FastAPI failure with no retry.
**Open:** `backend/Controllers/analysis.controller.js` (`analyzeResume`).

### (c) Scoring, weighting, explainability

**Q. How is the composite score computed today?**
Three sub-score slots — parsing, GitHub, assessment. Each available sub-score
is normalised to 0–100, then weighted, then summed. Today only parsing is
available, so after weight redistribution it carries a weight of 1.0 and the
composite equals the parsing sub-score. I want to be clear that means the
number is currently `parsing similarity × 100` — the machinery around it is
general, the inputs aren't all there yet.
**If pressed:** `AUDIT.md` Module 4 note and §4.1.
**Open:** `backend/Services/explainability.js` (`aggregate`, `buildScoreRecord`).

**Q. Where is the weighting scheme, and is it configurable?**
It is a single named constant — parsing 0.40, GitHub 0.35, assessment 0.25 —
and it can be overridden per deployment through a `CREDIBILITY_WEIGHTS`
environment variable that is JSON-parsed and validated. The scheme is also
persisted inside every score's explanation record, so an old score can be
re-explained with the weights it was actually computed under.
**If pressed:** `BASE_WEIGHTS` is read once at module load, so a change needs a
restart (`CODE_MAP.md` §2.4).
**Open:** `backend/Services/explainability.js` (`BASE_WEIGHTS`,
`readBaseWeights`).

**Q. Explain weight redistribution.**
The base weights only sum to 1 if all three sources have evidence. When a
source produces nothing, we don't score it zero — we drop it and renormalise
the remaining weights so they sum to 1 again. With parsing alone, its 0.40
becomes 1.0. The candidate is scored on what we can actually verify, and the
dashboard marks them "evidence-limited" with the reason, rather than penalising
them for a source we haven't built.
**If pressed:** verified by the smoke test in `AUDIT.md` §4.7 — parsing-only
redistributes 0.40 → 1.0, composite unchanged.
**Open:** `backend/Services/explainability.js` (`aggregate`).

**Q. So isn't your "score" just the parsing number dressed up?**
Numerically today, yes — and I'd rather say that plainly than overclaim. What
is built is the aggregation and explanation layer: normalisation onto a common
scale, a documented configurable weighting scheme, redistribution across
available sources, and a persisted per-factor explanation with cited evidence.
Adding GitHub or assessment is implementing a builder function that returns the
documented sub-score shape — the scoring engine doesn't change.
**If pressed:** `AUDIT.md` §4.3 is DONE_CORRECTLY; §4.1 is
DONE_BUT_BROKEN_OR_HACKY precisely because only one input exists.
**Open:** `backend/Services/explainability.js` (`buildParsingSubScore`).

**Q. What's in the explanation record?**
A version and timestamp, the composite, a prose summary, and a factors array —
one factor per evidence source with its direction (raises/lowers/sole/
unavailable), its weight, its point contribution, and a typed evidence list.
For parsing that evidence is the matched and missing job skills and each
similarity metric with its sub-weight and a plain-language note. Plus a
per-skill evidence table and the flag state. It is all persisted, and the
dashboard renders it verbatim rather than recomputing.
**If pressed:** shape detailed in `CODE_MAP.md` §2.4 (`buildExplanation`).
**Open:** `frontend/src/components/recruiter/ScoreBreakdown.jsx`.

**Q. Do the flagged-inconsistency checks work?**
No. The insertion point and the honest empty state exist — the UI shows
"inconsistency detection not available" with a reason — but there is no
comparison logic, because every flag the spec names, like "claimed language
absent from all repos", needs an evidence source we haven't built. `buildFlags`
returns an empty list today.
**If pressed:** `AUDIT.md` §4.6 — MISSING.
**Open:** `backend/Services/explainability.js` (`buildFlags`).

**Q. Is the score reproducible?**
The aggregation is a pure function of the sub-scores — no time, no randomness —
and the full record is persisted, so a stored score can be re-explained offline
from disk alone. The upstream parser's determinism is a separate Module 1
concern, but the same resume and job produce the same embeddings.
**If pressed:** `AUDIT.md` §4.11 — DONE_CORRECTLY.
**Open:** `backend/Services/explainability.js` (`aggregate`).

### (d) Modules not yet built

**Q. What exists of the GitHub evidence module?**
A single helper file that takes a GitHub URL and returns a list of repository
languages. It is unauthenticated, single-page, and — importantly — imported by
nothing; it is not wired into the pipeline. There is no OAuth, no commit or
ownership analysis, no code-quality heuristic, and no `repositories` table. The
module is designed but not built.
**If pressed:** `AUDIT.md` Module 2 whole-module note; `CODE_MAP.md` "DEAD"
table — `githubAggregator.js` has no importer.
**Open:** `backend/Controllers/githubAggregator.js`.

**Q. What exists of the AI assessment module?**
No LLM integration anywhere — no SDK, no API calls, no question/rubric data
model, no route. There is a front-end page, `Assessment.jsx`, that is a UI
shell with five hardcoded mock questions; it isn't even routed into the app.
Module 3 is entirely at the design stage.
**If pressed:** `AUDIT.md` Module 3 whole-module note; the page calls
`/api/assessment/*` routes that don't exist and always falls back to mocks.
**Open:** `frontend/src/pages/candidate/Assessment.jsx`.

**Q. Then what is the PFQS framework you describe — is any of it implemented?**
None of it is implemented yet. PFQS — Planning First, Question Second — is the
design: an LLM first produces a structured answer plan that fixes topic and
difficulty, and that plan then drives question generation, rather than a single
zero-shot "write me questions" prompt. The rationale is control and
consistency. It exists as a design decision and in the spec, not in code.
**If pressed:** "PFQS" appears only in spec/checklist docs — `AUDIT.md` §3.3.
**Open:** `PROJECT_SOURCE_DOCS.md` §9.3.

**Q. Your literature review says the integration of all four modules is the
contribution — and three aren't built. How do you defend the project?**
I defend it by being honest that the contribution is not yet realised, and by
showing that the connective tissue is what we built first: a normalised
weighted scoring engine with weight redistribution and a persisted
explainability record, plus a stable JSON contract from the parser. Those are
exactly the integration points the other two modules plug into. The remaining
work is building the evidence producers, not redesigning how they combine.
**If pressed:** `AUDIT.md` §4 — "the machinery around it is now correct, the
inputs are not yet there".
**Open:** `AUDIT.md` §4 (Integration Requirement Assessment).

**Q. What's your priority order for the rest?**
GitHub evidence validation next, because parsed `project_links` already give us
the username and it is the higher-signal evidence source; then the assessment
module. In parallel, the two Module 1 gaps the guide raised — OCR and moving
from the keyword dictionary to a trained NER model — and a first evaluation
harness so we have real numbers.
**If pressed:** `project_links` is already persisted on the `resumes` table
(`CODE_MAP.md` §4.5).
**Open:** `CHECKLIST.md` Modules 2–3.

### (e) Data, evaluation, targets

**Q. The spec targets ≥85% extraction accuracy, ≥0.80 skill F1, ≤10s
processing. Where are you against those?**
We have not run a formal evaluation, so I have no measured figures to give you,
and I'm not going to estimate. There is no labelled test set in the repo, no
evaluation script, and no benchmark. Building that harness is a near-term
priority precisely because these targets are unverifiable claims until measured.
**If pressed:** `AUDIT.md` §1.11–1.13 and all of Module 6 — every row MISSING.
**Open:** `AUDIT.md` Module 6.

**Q. Did you use the datasets listed in the SRS — the Kaggle and HF sets, APPS?**
Not yet. The skill vocabulary is a hand-authored list, not derived from the
Kaggle IT-skills data, and the HF "Annotated NER PDF Resumes" set has not been
used because we haven't trained a NER model. APPS is for assessment-rubric
calibration, which is Module 3 and unbuilt.
**If pressed:** `AUDIT.md` §6.8 — MISSING.
**Open:** `nlp-engine/app/ner.py` (`SKILL_KEYWORDS`).

**Q. How would you evaluate parsing once it's built out?**
Hold out a labelled subset of the HF resume set, score entity-level precision
and recall against the annotations for the accuracy figure, compute F1 on the
skill labels specifically, and time the end-to-end parse per document including
the OCR branch. That gives us the three spec numbers directly.
**If pressed:** target bands are 85–90% accuracy, ≥0.80 F1, 5–10s —
`PROJECT_SOURCE_DOCS.md` §Realistic metric targets.
**Open:** `CHECKLIST.md` Module 6.

**Q. ≥100 concurrent users — have you load-tested?**
No. The analyze path is a synchronous blocking request with no queue or worker,
so I would not claim it meets that today. Async job processing is a known
architectural gap.
**If pressed:** `AUDIT.md` §0.8 — MISSING.
**Open:** `AUDIT.md` §0.8.

### (f) Security, auth, RLS, storage

**Q. NFR-8 requires OAuth 2.0. You have password auth. Why?**
We implemented email/password through Supabase Auth plus an Express session,
with server-side role separation between candidate, recruiter and admin. That
is not OAuth 2.0, and there is no GitHub OAuth. The role enforcement itself is
correct; the auth mechanism is a gap against the spec, and GitHub OAuth is
coupled to the unbuilt Module 2 anyway.
**If pressed:** `AUDIT.md` §0.4 — DONE_BUT_BROKEN_OR_HACKY; role guards are
enforced server-side in `requireRole`.
**Open:** `backend/Controllers/auth.controller.js`,
`backend/Middlewares/auth.Middleware.js`.

**Q. Every table has RLS but the backend uses the service-role key — isn't RLS
doing nothing?**
Today the backend bypasses RLS with the service-role key, so RLS is not the
active enforcement layer — `requireRole` in the middleware is. The policies are
written and enabled so that a future direct-from-browser path, using the anon
key and the user's JWT, is already covered. It is defence-in-depth that isn't
load-bearing yet.
**If pressed:** policies are almost all SELECT-only; all writes are service-role
(`CODE_MAP.md` §4).
**Open:** `supabase/migrations/20260903_create_resumes_and_scores.sql`.

**Q. I heard there was a password-reset vulnerability.**
Yes — a UI merge briefly added an unauthenticated endpoint that let anyone
reset any account's password knowing only the username. It was found and fixed:
that endpoint is gone, replaced with a standard two-step Supabase email
recovery flow — a rate-limited request that always returns the same generic
response so it can't be used to enumerate accounts, then a token-gated password
update on an anon-key client. No service-role key touches a password anymore.
**If pressed:** `AUDIT.md` §0.4 and the appendix entry — "FIXED 2026-09-03".
**Open:** `backend/Controllers/auth.controller.js` (`requestPasswordReset`,
`resetPassword`).

**Q. How are secrets handled?**
Supabase keys are server-side only, read from environment, and the `.env` file
is gitignored; the front-end bundle contains no secrets. I should be candid
that the working-tree `.env` also contains unused Google and GitHub OAuth
client secrets that no code reads — they should be removed.
**If pressed:** `AUDIT.md` §0.5 is DONE_CORRECTLY for the keys that exist;
`CODE_MAP.md` §5 flags the stray OAuth creds.
**Open:** `backend/.env.example`.

**Q. HTTPS?**
Not configured — everything is hardcoded `http://localhost`. TLS is a
deployment-time concern we haven't addressed. It is a MISSING item against
NFR-10.
**If pressed:** `AUDIT.md` §0.6.
**Open:** `AUDIT.md` §0.6.

**Q. Is the resume storage bucket secure?**
The bucket is private, and access goes through the backend. One caveat: the
MIME-type allow-list and size cap were set by hand in the Supabase dashboard
and are not in a migration, so a fresh environment would get an unrestricted
bucket until that's fixed. That's tracked.
**If pressed:** `ISSUES.md` line 1–4; `CODE_MAP.md` §4.5.
**Open:** `supabase/migrations/20260903_create_resumes_and_scores.sql`.

### (g) Hostile / uncomfortable

**Q. Strip away the vocabulary — isn't this just an ATS with extra steps?**
Today it is closer to an ATS plus a semantic-similarity layer than to the full
vision, and I won't oversell it. The difference that matters is architectural:
the scoring engine is built to combine multiple independent evidence sources
with transparent, auditable weighting, and to redistribute rather than
penalise when a source is missing. An ATS gives you a match percentage; this
gives you a per-factor explanation you can drill into. The evidence sources
that make it more than an ATS are the next build.
**If pressed:** `AUDIT.md` §1 executive summary — "a resume-parsing demo with a
hiring-portal shell around it" is the honest current state.
**Open:** `AUDIT.md` §1.

**Q. Your skill list is hand-written. How is dictionary matching not the exact
thing you criticise ATS for?**
For the extraction step it is the same technique, and the fix is a trained NER
model on the HF resume dataset — that's committed future work, not a
disagreement. What's already different is that the score isn't the dictionary
hit count: 40% of the parsing score is embedding similarity that fires on
semantic proximity the dictionary can't see, and coverage is measured against
recruiter-authored structured requirements, not scraped text.
**If pressed:** `AUDIT.md` §1.5, §1.7.
**Open:** `nlp-engine/app/embedder.py` (`analyse`).

**Q. What have you actually built that is novel?**
I'd frame the novelty as the integration design rather than any one algorithm —
per our own literature review, no existing system connects parsing, external
evidence and dynamic assessment under one explainability layer. What's built of
that is the explainability and weight-redistribution engine and the contract
the other modules plug into. The novel whole isn't demonstrable yet; the spine
of it is.
**If pressed:** `PROJECT_SOURCE_DOCS.md` §Research Gap; `AUDIT.md` §4.
**Open:** `AUDIT.md` §4.

**Q. How much of this codebase is AI-generated boilerplate?**
There is AI-generated cruft and we've been removing it — dead Mongoose models,
a duplicate resume-forwarding route, mock-data files, an unrouted assessment
page, and some filler entries in the skill list. The audit tracks these
explicitly. The parsing pipeline, the section-scoping logic and the
explainability service are deliberate, reviewed work.
**If pressed:** `CODE_MAP.md` "DEAD OR MISLEADING CODE" and "ORPHANS" sections
enumerate what remains.
**Open:** `CODE_MAP.md` (DEAD OR MISLEADING CODE).

**Q. Justify parsing being 40% of the score.**
I can't justify it empirically yet — it is a reasoned default, not a calibrated
weight, and the honest position is that all three weights need calibration
against human judgement once the other sources exist. The reasoning for the
ordering is that assessment is the most direct competency signal, GitHub is
strong but sparse and optional, and parsing is the baseline claim being tested
— hence parsing lowest of the three in the base scheme. The weights are
configurable precisely because they're provisional.
**If pressed:** base scheme is parsing 0.40 / GitHub 0.35 / assessment 0.25,
overridable via `CREDIBILITY_WEIGHTS` (`CODE_MAP.md` §2.4).
**Open:** `backend/Services/explainability.js` (`DEFAULT_BASE_WEIGHTS`).

**Q. The landing page shows "95% accuracy" and "10,000+ candidates" — you just
told me you've measured nothing.**
That's placeholder marketing copy in a static page and it should not be there
given we have no measured numbers — I'll have it removed. It has no connection
to the scoring code; nothing on that page is computed.
**If pressed:** `CODE_MAP.md` §3.6 and DEAD table — `Landing.jsx` values are
hardcoded.
**Open:** `frontend/src/pages/public/Landing.jsx`.

**Q. It's been months — why is only one module built?**
Fair. We spent effort on the platform — auth, roles, the job/application model,
persistence, the dashboard — and on making Module 1 honest rather than
demo-grade, which meant tearing out fabricated-experience bugs and the
self-scoring JD hole. That was necessary but it wasn't visible module progress.
The next phase is squarely the evidence modules.
**If pressed:** `AUDIT.md` change log 2026-09-03 entries.
**Open:** `AUDIT.md` (top change summaries).

---

## 4. QUESTIONS I SHOULD FEAR

The weakest honest answers. Not softened.

**1. "Show me your evaluation numbers."**
There are none. No labelled test set, no evaluation script, no latency
benchmark exist in the repo. Every numeric target in the SRS — 85% accuracy,
0.80 F1, 10s latency, 100 concurrent users, 0.75 LLM correlation — is currently
an unverified claim. Best truthful response: _"We have run no formal
evaluation. I won't estimate numbers I haven't measured. Building the
evaluation harness against the Hugging Face resume set is a top near-term
priority, and until then I can only speak to what the pipeline does, not how
well."_ (`AUDIT.md` Module 6.)

**2. "Where is the custom NER model FR-2 requires?"**
Not built. Entity extraction is stock `en_core_web_sm` plus a ~185-term skill
dictionary and regexes. Best truthful response: _"FR-2's trained model is not
implemented. We use section-scoped extraction over a stock spaCy model and a
curated skill vocabulary. The section-scoping was where we invested — it
removed the fabricated-experience failures — and swapping the dictionary for a
model trained on the Annotated NER PDF Resumes set is the defined next step for
Module 1."_ (`AUDIT.md` §1.5.)

**3. "OCR was non-negotiable in my feedback. Where is it?"**
Not implemented. A scanned image-only PDF currently produces empty output. Best
truthful response: _"You're right, and it isn't done. pdfplumber gives us
nothing on an image-only PDF today. The plan is to detect a missing text layer
and route through an OCR engine into the same pipeline, so a scanned resume
yields the same entity set as a native one. It's on the Module 1 list with the
NER model."_ (`AUDIT.md` §1.2.)

**4. "Three of your four modules don't exist, and you told me the integration
is the whole point."**
Both true. Best truthful response: _"The contribution is not yet realised — I
won't claim otherwise. What we built first is the part everything else depends
on: a normalised, weighted, redistributing scoring engine and a persisted
explainability record, plus a stable parser contract. The remaining work is
building the two evidence producers to emit the sub-score shape the engine
already consumes — GitHub next, then assessment. The design is sound; the
demonstration is incomplete."_ (`AUDIT.md` §4.)

**5. "Your credibility score is just the parsing similarity times 100."**
Numerically, today, yes. Best truthful response: _"Correct — with one live
source, redistribution gives parsing weight 1.0 and the composite equals the
parsing sub-score. The value of what's built is the aggregation and
explanation layer around it, which is general: it normalises heterogeneous
scales, states its weights, redistributes across available sources, and emits
an auditable factor breakdown. Adding a source doesn't change that engine."_
(`AUDIT.md` §4.1, Module 4 note.)

**6. "40% of your parsing score is keyword coverage — that's the ATS behaviour
you're supposed to be replacing."**
The extraction and the coverage metric are dictionary-based; only the 40%
semantic component isn't. Best truthful response: _"The literal skill match is
still keyword-driven and I won't dress that up. The semantic embedding
contributes 40% and fires on proximity the dictionary misses, and coverage is
scored against recruiter-authored structured requirements rather than scraped
text. The end state is a trained NER model and folding embeddings into the
match itself — the current split is a step, not the destination."_ (`AUDIT.md`
§1.7; `embedder.py:152`.)

**7. "What happens to a candidate whose work is all maintenance and support, not
greenfield development?"**
Nothing special — that scoring fairness is unaddressed. Best truthful response:
_"Guide feedback item three, and it's not solved. It depends on the GitHub
module — crediting bug-fix commits, contributions to existing repos, sustained
small commits — which doesn't exist yet. The scoring engine's weight
redistribution is the mechanism that will let us weight those signals fairly
once they're produced, but there's no maintenance-aware logic today."_
(`AUDIT.md` §2.9, §4.8.)

**8. "If the NLP service goes down mid-demo, what does the recruiter see?"**
An error — the pipeline hard-fails. Best truthful response: _"The analyze
request returns a 502 and stops; there's no retry and no degraded-score
fallback. NFR-12 graceful degradation is a MISSING item. For a distributed
system that's a real gap, and it's on the cross-cutting list with the async
queue."_ (`AUDIT.md` §0.7.)

---

_Prepared from `AUDIT.md` (verified state, 2026-09-02 + 2026-09-03 re-audits)
and `CODE_MAP.md` (function-level file map). If a question needs a fact not in
this brief, open the file named in the entry rather than improvising a number._
