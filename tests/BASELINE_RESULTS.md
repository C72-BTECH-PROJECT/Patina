# Baseline results: `32905c1` (T-0001)

This records how the code at `32905c1` ("Fixed nlp parsed resume output", the
last commit before teammates' merges) behaves under the T-0001 harness.

**This is a reference, not a correctness oracle.** Parsing was not fully
correct at 32905c1, and the known-wrong outputs are marked below. When current
code differs from these snapshots, it means "changed", not "broke".

Run date: 2026-10-12. Runner: `tests/run-suite.ps1 -Target baseline`.

## Environment

| Item | Value |
|---|---|
| Baseline tree | `../patina-baseline`, git worktree, detached at `32905c19f28af8c1cd9ce4522b6870c39fa33dbb`, `git status --porcelain` empty |
| Harness tree | `Anthony_V2` @ `92db9f0` (working tree, uncommitted harness files) |
| Ports | NLP 8100, backend 5100 (from the worktree's copied `backend/.env`) |
| OS / shells | Windows 11, PowerShell 5.1 + Git Bash |
| Node / npm | v24.12.0 / 11.13.0 |
| Python | 3.14.0 (`nlp-engine/venv`, shared with the main tree) |
| NLP packages | fastapi 0.141.1, uvicorn 0.52.1, spacy 3.8.13 + en_core_web_sm 3.8.0, sentence-transformers 5.6.1, torch 2.13.0, pdfplumber 0.11.10, python-docx 1.2.0, scikit-learn 1.9.0, numpy 2.5.1 |
| Test packages | pytest 9.1.1, requests 2.34.2, fpdf2 2.8.9 (added to the venv for T-0001) |
| Backend / frontend | express 5.2.1; react-scripts 5.0.1 |
| `node_modules` | Junctioned from the main tree. Lockfile deltas 32905c1→HEAD: backend adds only the `mongoose` subtree; frontend changes only optional wasm (`@emnapi/*`) entries. `package.json` is identical apart from `mongoose`. |
| NLP server env | `PYTHONHASHSEED=0`, `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1` |

## Summary

| Suite | Result | Evidence |
|---|---|---|
| NLP `/parse` (6 synthetic + 3 private) | **10/10 passed** | `tests/.out/baseline-pytest.log`: `10 passed in 5.72s` (rerun `5.08s`) |
| NLP determinism (same seed, server restarted) | **Identical**: all 9 snapshot SHA-256 hashes matched between two runs | table below |
| Backend tier 1 (smoke, no writes) | **7/7 passed** | `node --test`: `tests 7 / pass 7 / fail 0` |
| Backend tier 2 (live analyze) | **1/1 passed**. Teardown left 0 rows/objects. | `tests 8 / pass 8` with tier 1; `sweep.mjs --check` exit 0 |
| Frontend `CI=true npm run build` | **FAIL**, exit 1: 6 ESLint `no-unused-vars` warnings, which `CI=true` treats as errors | below |
| Frontend build without `CI` | Compiles ("The build folder is ready to be deployed") | — |
| Manual browser smoke (section A) | Run once by the owner. Login and recruiter dashboard work. The upload page couldn't list jobs on the split-port setup. A3–A4 not exercised; A6 inconclusive. | `MANUAL_SMOKE.md` §A Observed column |

## NLP suite

The service is confirmed as the 32905c1 code: every snapshot contains
`semantic_analysis.jd_source` and `component_weights`, which HEAD's NLP
doesn't return (ISSUES I-0011).

### Snapshot hashes (determinism)

| Snapshot | SHA-256 (prefix) |
|---|---|
| `f1_dev_github.json` | `4338e6cae4a7cc52…` |
| `f2_dev_github.json` | `11399a839c151784…` |
| `f3_support_nogithub.json` | `81d92b5ef8d762dc…` |
| `f4_support_nogithub.json` | `047bd608a76c0b30…` |
| `f5_multicolumn.json` | `72d5144186b11f2d…` |
| `f6_image_only.json` | `c6276fb1f6879881…` |

The three private snapshots (`tests/private/snapshots/baseline/`, git-ignored)
also matched between runs. Determinism holds **only because the seed is
pinned**. Without `PYTHONHASHSEED`, contact fields can change between restarts
(ISSUES I-0015).

### Wall-clock per `/parse` call (FR-3 / NFR-1 ≤ 10 s, reference only)

f1 0.95 s · f2 0.38 s · f3 0.34 s · f4 0.40 s · f5 0.26 s · f6 0.03 s ·
three private resumes 0.88–1.16 s. Model was warm, local machine, single
request. This doesn't measure NFR-2 concurrency.

### Per-fixture results and known-wrong outputs

`match` = `semantic_analysis.match_level` (`similarity_score`). All six use
`jd_source = "structured_skills"` with weights `skill_coverage 0.6 /
semantic_score 0.4`.

| Fixture | Covers | match | Known-wrong at baseline (snapshot field → value) |
|---|---|---|---|
| `f1_dev_github.pdf` | PDF, GitHub + LinkedIn | Strong (0.8484) | `entities.candidate_name` → `null`; the name "Maya Okafor" is the first line. `entities.experience[1]` has title and organisation **swapped** (`title: "Bluebird Analytics ()"`, `organisation: "Software Engineering Intern"`), although `[0]` has the same layout and parses correctly. Every `organisation` carries a stray `" ()"`. `entities.projects` → `[]` despite a Projects section. `entities.skills` includes `"github"`, which comes from the URL and isn't a skill. |
| `f2_dev_github.docx` | DOCX, GitHub | Weak (0.4779) | `entities.phone` → `null` for `+91 98765 01234`. `entities.experience` turns each DOCX bullet into its own entry (`title` = bullet text, `organisation`/`dates` = `null`), and real roles get `highlights: []`. `projects` → `[]`. `skills` includes `"github"` from the URL. |
| `f3_support_nogithub.pdf` | Support-only, no GitHub (#3, #4) | Weak (0.4138) | `entities.phone` → `null` for `+49 151 5550 1234`. `entities.skills` → only `["bash","linux","sql"]`. ServiceNow, Jira, ITIL, Nagios, Active Directory and Windows Server are all in the resume but **not in the skill dictionary**, so `missing_skills` lists 7 of 10 job skills and a well-matched support candidate scores "Weak" (guide feedback #3). |
| `f4_support_nogithub.docx` | Support-only, DOCX, no GitHub | Weak (0.4354) | `entities.phone` → `null` for `+44 7700 900123`. `entities.skills` contains `"github"`, a **false positive** from the sentence "most work is internal and not on GitHub". Splunk, PL/SQL, shell scripting and CloudWatch aren't recognised. Experience has the same DOCX-bullet split as f2. Same fairness problem as f3. |
| `f5_multicolumn.pdf` | Two-column layout | Moderate (0.6906) | `entities.experience` → `[]`, because pdfplumber interleaves the sidebar and main column line by line (e.g. `"rosa.delgado@example.com Platform Engineer"`), so sections aren't detected. `education` is split into 3 entries (degree, school and years as separate strings). `projects` → `[]`. |
| `f6_image_only.pdf` | Image-only / scanned (#2 OCR) | Poor (0.0) | `raw_text_preview` → `""`, `preprocessing.token_count` → `0`, every entity empty or `null`. The service returns **HTTP 200 with a 0.0 score** and no signal that the document was unreadable. There is no OCR (guide feedback #2). |

Across all fixtures:
- `entities.projects` is `[]` for all six, including the three with a Projects section (f1, f2, f5).
- A phone number is extracted only for the US-format `+1 555 …` numbers (f1, f5).

### Cross-fixture scoring observation (feedback #3)

The support candidates f3 and f4 each fit the support JD well, yet both score
below f2, an off-profile Java developer scored against the Python JD (0.41 /
0.44 vs 0.48). The cause is the skill vocabulary (`skill_coverage` 0.3), not
the semantic score: f3/f4 `semantic_score` is 0.58/0.64, f2 is 0.59.

## Backend tier 1

All checks ran against the baseline backend on `:5100`. The log shows
`Server running on http://localhost:5100` and `service client key role:
service_role`.

| Check | Result |
|---|---|
| `GET /api/health` → 200 `{status:"ok"}` | pass |
| unknown route → 404 | pass |
| `POST /api/auth/login {}` → 400 | pass |
| `POST /api/auth/signup {}` → 400 | pass |
| login `t0001_nonexistent` → 401, no session cookie | pass (one `profiles` read, no writes) |
| `POST /api/analyze` without session → 401 | pass |
| `GET /api/jobs` without session → 401 | pass |

## Backend tier 2 (live analyze)

**PASS.** Run with `run-suite.ps1 -Target baseline -Suites backend -Live`.

- Accounts: `t0001_cand` (candidate) and `t0001_recr` (recruiter).
  - Created through the baseline API, because browser signup hits I-0016.
  - Both email-confirmed by the owner.
  - Credentials only in the git-ignored `tests/.env`.
- `POST /api/analyze` with `f1_dev_github.pdf` against the tagged job returned 200 in 3.37 s.
  - The response has every expected key: `id, resumeId, candidateId, jobId, credibilityScore, subScores, weights, explanation, extractedSkills`.
  - `candidateId` and `jobId` match the test account and the seeded job.
  - `extractedSkills` is non-empty, which proves NLP was called.
- Data written by one analyze run, all removed by the teardown sweep:

  | | scores | resumes | applications | jobs (tagged) | storage `<C>/` | storage `candidates/<C>/` |
  |---|---|---|---|---|---|---|
  | pre-run sweep removed | 0 | 0 | 0 | 0 | 0 | 0 |
  | teardown sweep removed | 1 | 1 | 0 | 1 | 1 | 0 |
  | `sweep.mjs --check` afterwards | **0** | **0** | **0** | **0** | **0** | **0** |

- Backend stderr shows only a `form-data` deprecation warning.

Expected at HEAD (for the next task): 500 `path is not defined` (I-0009).

## Frontend build (`CI=true npm run build` in `../patina-baseline/frontend`)

Exit code **1**: "Treating warnings as errors because process.env.CI = true."

```
src\pages\candidate\Upload.jsx       Line 71:7:   'SkillsSelector' is assigned a value but never used  no-unused-vars
src\pages\recruiter\CreateJob.jsx    Line 4:10:   'Plus' is defined but never used                     no-unused-vars
src\pages\recruiter\CreateJob.jsx    Line 4:16:   'X' is defined but never used                        no-unused-vars
src\pages\recruiter\Jobs.jsx         Line 4:21:   'MapPin' is defined but never used                   no-unused-vars
src\pages\recruiter\Jobs.jsx         Line 4:29:   'Users' is defined but never used                    no-unused-vars
src\pages\recruiter\Jobs.jsx         Line 4:50:   'Sparkles' is defined but never used                 no-unused-vars
```

There's also a non-fatal `fs.F_OK` deprecation warning (DEP0176) and a
"caniuse-lite is 6 months old" notice. Without `CI=true` the same tree builds
successfully.

## Why commits show a failing check (step 3c)

**No GitHub Actions workflow exists, and none ever has.** `.github/` is absent,
`git log --all -- .github` is empty, and `gh run list` / `gh workflow list`
return nothing. The frontend build above is a local reproduction of what CI
*would* catch. It isn't the red check.

The red check is the **Supabase Preview** check-run from the Supabase
GitHub integration on project `zzgymrxrwuuffyrbhify`:

```
$ gh api repos/C72-BTECH-PROJECT/Patina/commits/<sha>/check-runs
32905c1  Supabase Preview | supabase | completed failure | ERROR: type "patina_user_role" already exists (SQLSTATE 42710)
                                                          At statement: 0 -- Patina: Supabase Auth profile schema
cc0e637  Supabase Preview | supabase | completed failure | (same error)
92db9f0  Supabase Preview | supabase | completed skipped | This git branch is not associated with any Supabase Branch.
```

On `main` the integration replays `supabase/migrations/` against the project.
`20260823_create_profiles.sql:6` has an unguarded
`create type public.patina_user_role`, and the schema was originally applied
by hand in the SQL editor, so statement 0 fails. It was **already failing at
32905c1**. **Risk:** once the migrations succeed, every merge to `main`
auto-applies schema to the shared production DB. That decision is open in
ISSUES I-0010.

## Baseline browser flow: manual smoke (MANUAL_SMOKE §A)

The code shows two possible causes at 32905c1:
- `frontend/src/pages/candidate/Upload.jsx:121` fetches the hardcoded `http://localhost:5000/api/jobs`.
- It does so **without** `credentials: 'include'`, while `backend/Routes/jobs.routes.js:11` requires a session.

**Observed (owner, split-port setup: frontend 3100 → backend 5100):**
- "Select Job" shows "Failed to fetch" and Analyze Resume stays disabled.
- DevTools shows `GET http://localhost:5000/api/jobs` → `net::ERR_CONNECTION_REFUSED`.

This confirms the hardcoded port. **Limitation:** the failure happened only
because nothing listened on :5000 in this setup. It does **not** show that the
upload page was broken in its original single-stack setup, where the backend
runs on :5000. The missing-credentials cause wasn't tested and remains
unverified. So the browser analyze → results path (A3–A4) wasn't exercised at
baseline. The backend analyze route is covered directly by tier 2.

The other steps:
- A1 (candidate login) and A5 (recruiter dashboard loads) worked.
- A6 (recruiter job list) was empty because the test job was never seeded. A later `sweep.mjs --check` showed `jobs: 0`, so this is a procedure miss, not a code finding.
- A7: `sweep.mjs --check` afterwards showed all counts 0.

Other hardcoded `:5000` calls at baseline: `CreateJob.jsx:211`,
`ResetPassword.jsx:6`, `Assessment.jsx:61,104`.
