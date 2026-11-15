# Rebuild roadmap

Written 2026-11-14 at commit `07c5137` (card H-1). This is a plan, never status. Status lives in `AUDIT.md`
(stale until its rewrite, the first card of A1), `REBUILD/PROGRESS.md` and `REBUILD/LOG.md`.

- Two tracks. **Track A** finishes what the academic project promised. **Track B** is what a public launch
  needs on top of it.
- Milestones are in order inside a track. Each has exit criteria; a milestone is finished only when every
  criterion is met with evidence (a test name, a harness result, or a `file:line`). There are no time estimates.
- Every milestone after A1 ends with a short sweep of the `ISSUES.md` entries logged since the previous one
  (triage rule in `CLAUDE.md`).
- The root `ROADMAP.md` is the pre-rebuild plan (T-0010). It is superseded by this file and is archived by
  card R-22 in milestone A1. Until then the docs checker still reads it.
- Anything that changes the database schema, changes authentication, or deletes a feature or file needs
  Anthony's yes first. Those items are marked **[ask]**.

Before Track A starts: the Nov 17 rehearsal, the `BATCH·demo` sweep after it (card R-36, 21 entries on
2026-11-14), and the Nov 18 evaluation. Those are in `REBUILD/HANDOFF.md`, not here.

---

## Track A: academic completion

### A1. The `ISSUES.md` BATCH sweep

**Why first:** the backlog is small defects in code every later milestone edits. Clearing it first means later
work starts from a clean, documented tree.

**First card: `AUDIT.md` rewritten (R-25; decision A9).** Every row is rewritten at the current commit from
the code, `REBUILD/LOG.md` and the test names. A row is `DONE_CORRECTLY` only with a `file:line` and a test or
end-to-end result at that commit. A row the rebuild never touched is reset to `CLAIMED_UNVERIFIED`; nothing is
carried over. The stale "services that actually run" and data-model sections are rewritten too, and
`CLAUDE.md`'s source-of-truth list is updated for any file that moves in R-22.

**Scope of the sweep** (counts on 2026-11-14):

- 76 open bullet entries tagged BATCH (21 of them `BATCH·demo`, which R-36 should already have cleared).
- 19 open numbered entries (`I-NNNN`) tagged BATCH in the table at the top of the file.
- 3 entries tagged NOW that are still open: the stale route comments in `backend/index.js` (owner R-33);
  the six orphan résumé files (O-9: Anthony runs `tests/backend/purge-orphan-resume-files.mjs --apply`);
  the verification badge on two candidate views (R-28: implemented, closes when someone checks it).
- The rest of the docs batch: R-22 (archive and merge docs, drop the root-ROADMAP block from the checker)
  and R-26 (`ISSUES.md` brought up to date). R-23 and R-24 were done in steps 4 and 5.
- Dead code named in `CODE_MAP.md` §13 **[ask]** (deleting files or functions).

The sweep fixes or closes each item. It does not re-tag an item NOW to skip it. An item that turns out to
give a wrong output or expose data is re-tagged NOW at once and gets a card.

#### Security (the six deferred items, fixed together)

Decision A6 in `REBUILD/DECISIONS.md` keeps these six together. Each stays BATCH until its fix is verified.

| # | Item | `ISSUES.md` entry | Fix | Note |
|---|---|---|---|---|
| 1 | Grading error messages repeat grader-supplied question ids | R-08 verifier, 2026-11-12 | Report a count and a fixed code; never echo model-supplied text into a message or a retry prompt | |
| 2 | `GET /api/auth/session` reports a suspended user as logged in | R-04, 2026-11-12 | The session endpoint checks suspension, or suspension destroys the user's sessions | **[ask]** auth |
| 3 | Login answers "suspended" before checking the password, so it reveals that a username exists | R-04, 2026-11-12 | Check the password first; one answer for unknown user and wrong password | **[ask]** auth |
| 4 | Client IP in core's log can be spoofed; sign-ups are not limited per IP | R-04 verifier, 2026-11-12 | Gateway overwrites `X-Forwarded-For`; a sign-up limiter keyed on the gateway's socket IP | |
| 5 | The NLP service is unauthenticated, allows every origin and exposes `/docs` | I-0034 | A shared service token checked by all three Python services; CORS closed; `/docs` off outside development | Full service-to-service authentication is in A6 |
| 6 | The `assessments` read policy would let a candidate with a direct Supabase token read an unstarted pool | R-11, 2026-11-14 | Tighten the policy in a new migration file | **[ask]** schema; Anthony applies the migration |

Anthony accepted these six on 2026-11-14 (decision A12). The other two items card H-1 listed are placed
where their fix belongs: commit dates trusted (I-0048) with S-3 in A3, and the single-process core (I-0035)
in A6. Account deletion is Track B.

**Exit criteria**

1. No open BATCH entry in `ISSUES.md` is older than the start of the milestone. Each is CLOSED with its
   evidence, or is a duplicate, a non-defect, or a refusal recorded as a decision.
2. The three NOW entries are closed with evidence.
3. Each of the six security items has a test that fails on the old behaviour and passes on the new one.
4. `node tests/docs/check-trackers.mjs` exits 0.
5. Every default suite passes and one end-to-end run exits 0.

### A2. Résumé parsing, chosen by measurement

**Why:** the one measured weakness that most limits the product. On the gold set the parser finds 87 % of the
skills it knows and 21 % of the skills that are there, because 76 % of them are outside its 180-skill list
(`eval/RESULTS.md`, 2026-11-14).

**Depends on:** A1.

**Decision A10:** the SRS's trained NER model stays a measured choice, not a dropped promise. Two options are
built far enough to measure, compared on the same data, and one is chosen and recorded.

**Common to both options**

1. **Contacts and links by rule.** Regex and file structure (PDF link annotations, DOCX hyperlinks) for
   email, phone, GitHub and LinkedIn. No model for these fields.
2. **Mapping onto an open skills list** with the existing MiniLM embeddings: each extracted skill is matched
   to its nearest canonical entry above a threshold; below it the skill is kept as written and marked
   unmapped. **O*NET Technology Skills** is the default for named tools; **ESCO** is the option for broader
   skills. Both licences are confirmed, and the confirmation recorded in `REBUILD/DECISIONS.md`, before
   either list is used.
3. **The vocabulary parser stays as the fallback.** `parser_version` records which path produced each résumé.
   A failure of the new path never fails an upload and never invents a result.
4. **Candidate-confirmed skills** on the parsed-résumé screen: the candidate removes wrong skills and adds
   missing ones. A confirmed skill is still a claim. It changes what is asked in the assessment and what is
   shown as "Claimed only"; it never counts as evidence. **[ask]** if it needs a new column.

**Option (a): grounded LLM extraction at runtime**

- One low-cost LLM call per upload for skills, experience and education. Schema-checked output; résumé text
  treated as untrusted, the same rule the grader follows.
- **Cache:** the result is stored against a hash of the file bytes, the prompt version and the model, so the
  same file is never sent twice and a re-score never re-parses.
- **Quote check:** every extracted skill carries the exact quote it came from. A skill whose quote does not
  appear in the résumé text (after whitespace and case normalisation) is dropped. Tested with a fake LLM that
  returns a quote the text does not contain.
- The vocabulary parser runs when the LLM is down, slow or returns invalid output.
- Cost: résumé text leaves the machine on every new upload, and each upload costs an API call.

**Option (b): the LLM as teacher, a trained spaCy NER model at runtime**

- The LLM labels **public** CVs as silver training data, under the same quote rule: a label whose span is
  not in the text is discarded. No candidate's résumé is used for training.
- A spaCy NER model is trained on that data and runs inside nlp-engine. Runtime parsing stays local and
  cheap, and no résumé text is sent to an API.
- The gold set and the fresh sample are **never** in the training data; the training set is checked for
  overlap with both by file hash before training.
- This is the SRS's custom NER model (CHECKLIST 1.5), with the labelling done by an LLM in place of people.
  The size and source of the silver set, and a spot-check of its label quality by a person, are reported.

**Rules that carry over:** the full résumé text is not stored; the résumé's weight stays 0.20; if the new
parser changes the résumé sub-score for the same file, the parser version shown on the score changes with
it, and old scores keep the version they were made with.

**Exit criteria**

1. Both options, and the vocabulary parser as the baseline, are measured on the existing gold set
   (`eval/labels/gold.csv`, 20 résumés). Reported as a development set: people working on the parser have seen it.
2. All three are measured on a **fresh developer-role sample** (card H-1): files nobody working on the parser
   has seen, labelled under `eval/labels/RULINGS.md`, with the lists, aliases, prompt and model weights
   frozen and hashed before the run. This is the result that counts.
3. Before either run, the two alias gaps are joined in `eval/aliases.json` and in the canonical names:
   `exchange server` = `microsoft exchange`, `sccm` = `system center configuration manager`.
4. Every run reports precision, F1 and **both recalls**: over all gold skills, and over the gold skills
   inside the canonical list.
5. Also recorded for each option: parse time (median and maximum), cost per upload, and whether résumé text
   leaves the machine.
6. Contact fields are measured on a sample that has them. The Kaggle résumés have none.
7. Tests for the chosen option: for (a), the quote check drops an unquoted skill, an LLM outage falls back
   and says so, a cached file makes no second call; for (b), the model loads offline and a missing model
   falls back and says so.
8. **The choice is made from the numbers and recorded** as a new amendment in `REBUILD/DECISIONS.md` §0, with
   the losing option's numbers kept in `eval/RESULTS.md`.
9. **If (a) wins:** a visible notice on the upload screen that résumé text is sent to an LLM provider ships
   with it (approved, A10). If (b) wins, no notice is needed for parsing.
10. `eval/RESULTS.md` states the numbers against the SRS targets (extraction ≥ 85 %, F1 ≥ 0.80) whichever
    way they come out, with the sample size and the number of labellers.

### A3. The deferred features

In this order. Each is its own card with its own check; none depends on a later one.

| # | Item | What it is | Exit criterion | Note |
|---|---|---|---|---|
| 1 | **S-3 GitHub ownership** | The candidate links the account through GitHub sign-in; the verified login is preferred over the résumé link; the "ownership not verified" note disappears only then. With it: compare push times with commit dates so backdated commits are discounted (I-0048). | Live link with a real account; a résumé naming someone else's account stays "not verified"; a unit test with backdated commits. This is also the first check of scoring with GitHub evidence outside the demo. | Yes already given (A7); OAuth app exists (O-6) |
| 2 | **Location field (R-34)** | Work mode (On-site, Hybrid, Remote) and city, saved into the existing `location` column | One job created per mode in the browser; e2e passes | No schema change |
| 3 | **Job-description upload** (SHOULD-2) | The recruiter uploads a PDF or DOCX; its text fills the description, which they then edit. Same file checks as résumé upload. | A fixture file fills the form; an image-only file gives the explicit error | |
| 4 | **Claim-based assessment questions** | Scenario questions grounded in a specific claim on the résumé (a project, a role), not only the skill name | Each such question stores the claim it was built from; the option-length report is re-run on new pools | |
| 5 | **Company verification** | The recruiter's company is checked (domain email at the least) before their jobs are public; today anyone can register as a recruiter | An unverified recruiter's job is not listed to candidates; the state is shown | **[ask]** auth and schema |
| 6 | **PFQS (S-5)** | Two-step generation: an answer plan with a difficulty level, then questions from the plan; the plan is stored with the attempt | Fake-LLM tests show two calls and a stored plan; live generation stays inside the time budget | |
| 7 | **Certificates (S-4)** | Extracted and shown as "claimed, not validated". They do not affect the score. LinkedIn stays a captured link. | A fixture with a certifications section yields the entries | Part of GF-1 |
| 8 | **Flags (S-2)** | The remaining inconsistency flags, each citing its evidence: a claimed language not found on GitHub; an assessment result below half on a claimed skill | A unit test per rule; no flag when its source is unavailable | |
| 9 | **OCR (S-1)** | Pages with no text layer go through OCR in the same pipeline; the result is marked "read by OCR" | The image-only fixture parses to its known text; a blank image still gives the 422; parse time recorded | GF-2. Needs Tesseract on the machine |

**Exit criteria for the milestone:** every row's criterion met; the "not built" lists in `REVIEW_BRIEF.md` §3
and `REBUILD/CUT.md` updated to match; one end-to-end run exits 0 after the last card.

### A4. The guide's asks

| # | Item | What it is | Exit criterion | Note |
|---|---|---|---|---|
| 1 | **Health checks and monitoring** | Health endpoints exist for all five services. Add: a monitor that polls them and records up and down time, and one place to read the per-request logs with their request ids | A stopped service shows as down within one polling interval; a measured uptime figure over a stated period (this is checklist item 6.7) | |
| 2 | **Burp Suite security test** | A scripted pass over the gateway: authentication, session handling, access control between roles and between candidates, file upload, injection | A written report in the repo; every finding is an `ISSUES.md` entry; high-severity findings fixed and re-tested | Run after A1's security items, so it tests the fixed system |
| 3 | **MFA** | A second factor at login, through Supabase Auth's TOTP support | Enrol, log in, and recover in the browser; e2e still passes with a non-MFA test account | **[ask]** auth |
| 4 | **IP hashing** | Client IPs are stored and logged only as a salted hash | No raw client IP in any log line or table; the rate limiter still works | |
| 5 | **Proctoring** | Tab-switch and focus-loss events recorded during an attempt and shown to the recruiter as a signal, never as a verdict | The events appear in the drill-down; the "unproctored" label changes only to what is true | Camera and identity checks are out of scope (decision A11) |

**Exit criteria:** every row's criterion met; `REBUILD/DECISIONS.md` §6.2 updated for what is now controlled
and what still is not.

### A5. Measured targets

| # | Target | How | Exit criterion |
|---|---|---|---|
| 1 | **Latency** (checklist 1.13: at most 10 s per résumé) | Time upload-to-parsed and apply-to-scored through the gateway, on a stated set of files, with the A2 parser | Median, 95th percentile and maximum in `eval/RESULTS.md`, with the machine and the sample stated |
| 2 | **Concurrent users** (checklist 6.6 and 0.8: 100) | A load script against the gateway with a mix of logged-in reads, uploads and applies, at 10, 50 and 100 users. The LLM and GitHub are stubbed and that is stated. | Error rate and latency at each level recorded; the level at which it breaks is stated plainly if it is below 100 |

The first run measures the system as built, with a single core process. It is repeated after A6. Neither
number is claimed before it is measured.

### A6. Backend decomposition

**Basis:** the verdict table in `ARCHITECTURE.md` §6 (three claims pass, one partial, five fail) and its §8.

In this order, each step leaving the system working:

1. **External session store** **[ask]**, so core can run as more than one instance (I-0035).
2. **A queue for pool preparation and scoring**, replacing in-memory state in core. It is a **priority
   queue**: interactive NLP calls (`/skills/extract` for job creation, the apply-time parse) go ahead of
   background pool preparations, and preparations run with bounded concurrency. Add a **second nlp-engine
   worker** (or run `/parse` off the event loop) so one CPU-bound parse cannot block every other NLP call.
   Basis: the ISSUES L1441 entry. On Nov 15, 39 preparations started by status reads blocked nlp-engine's
   event loop and `POST /api/skills/extract` timed out at 10 s. Each preparation also re-parses the stored
   résumé (`runResumePipeline`, `backend/Services/assessmentService.js:515`), because the full text it sends to
   the generator is never stored (`backend/Services/resumePipeline.js:12`). Whether to store it is an
   **[ask]** (a schema change and a privacy decision).
3. **Service-to-service authentication** on every internal call (builds on the token from A1).
4. **Split core** along the lines `ARCHITECTURE.md` names: authentication, applications, scoring
   orchestration. The gateway then routes to more than one upstream. **[ask]** if any table changes owner.
5. **Containers and a compose file**, one image per service.

**Exit criteria**

1. Two core instances behind the gateway pass the end-to-end run, and a logged-in session survives the
   restart of one of them.
2. `ARCHITECTURE.md` §6 is re-verified row by row; each row that moved to PASS has its `file:line` evidence;
   rows that still fail say so.
3. A5 is re-run and both sets of numbers are kept.
4. `docker compose up` on a clean machine reaches a logged-in page by following `README.md` alone.

---

## Track B: public launch

Track B does not wait for all of Track A, but two things are fixed: **B2 and B4 finish before any real
person's data is taken**, and **B1 goes live only after A1's security items and A6 step 1**.

| # | Milestone | What it is | Exit criteria |
|---|---|---|---|
| B1 | **Hosting** | The stack on a host with HTTPS, secure cookies, secrets in the host's secret store, database backups, and a written cost plan (hosting, Supabase tier, LLM cost per candidate at an expected volume) | The end-to-end run passes against the hosted URL over HTTPS; a backup is restored into a scratch project once; the cost plan is in the repo and names its assumptions |
| B2 | **Privacy and consent** | A privacy notice and a consent step before upload that say what is stored, for how long, who sees it, and that résumé text and answers are sent to an LLM API. The provider's data terms (retention, training use, region) are read and recorded; the provider or tier is changed if they do not fit. | No upload without recorded consent; the provider's terms are cited by document and date in `REBUILD/DECISIONS.md`; a candidate can read what is held about them |
| B3 | **Own-domain email sender** | Confirmation and reset email sent from the project's own domain with SPF, DKIM and DMARC, replacing the Gmail SMTP set up in Supabase (decision A7) | A sign-up email reaches two outside mail providers' inboxes and passes all three checks |
| B4 | **Separate test database** | A second Supabase project for tests. Today the live suites and the end-to-end run write to the one project as the `t0001_` accounts. | No test can reach the production project (the harness refuses its URL); migrations are applied to the test project from the files alone |
| B5 | **Account deletion** | A deletion path that removes the account's rows and its files in the `resumes` bucket, plus a periodic check for orphan files (`ISSUES.md`, privacy entry of 2026-11-13; one-off clean-up is O-9) | Deleting a test account leaves no row and no stored object; the orphan check reports zero |
| B6 | **Résumé-file retention** | A written retention period, and a job that deletes replaced and expired files. Today every upload is kept under its own key and nothing removes earlier ones (R-38 note on the same entry). | The policy is in the privacy notice; a replaced file is gone after the stated period while the scored file of a live application is kept |
| B7 | **Design refresh and Vite migration** | The token-level refresh (R-35) is here unless the design branch merges before Nov 18 (decision A12); whatever has not landed by then: palette, type scale, spacing, the auth screens, the score breakdown as the centrepiece, then the wider redesign. Done together with the move from Create React App to Vite. | The frontend suite and the end-to-end run pass on the Vite build; text contrast at least 4.5:1 on every token; no figure on any screen that the API did not supply |

B5 and B6 change stored data and B1 changes cookies and auth settings: **[ask]** before each.

---

## Not on this roadmap

Named in `REBUILD/CUT.md` list C and not scheduled above: DocLing, 8DFS, CodeQL and SonarQube, APPS-calibrated
rubrics, originality signals, practical coding challenges, the human-correlation studies for GitHub and
grading, the fairness measurement, maintenance-work signals and support weighting, the recruiter audit log,
the side-by-side compare view, OAuth login. They stay "not built" and are said so. Two of them bear on
weaknesses the review brief admits: a second independent source for non-developers (the 79 cap works against
GF-3) and calibration of the weights and bands. Anthony decides whether either joins Track A.

---

## Decided on 2026-11-14

Anthony's answers to the questions this roadmap first raised are amendments A9 to A12 in
`REBUILD/DECISIONS.md` §0:

- **`AUDIT.md` is re-verified, not archived**: a full rewrite as the first card of A1; untouched rows reset
  to unverified (A9).
- **The `REBUILD/` files are the session protocol.** `tasks/` and `WORKLOG.md` are in `Docs/archive/` (A9).
- **Parsing is chosen by measurement** between runtime LLM extraction and an LLM-taught spaCy NER model; the
  upload notice is needed only if the first wins; O*NET Technology Skills by default, ESCO for broader
  skills, licences confirmed first (A10).
- **Proctoring is tab-switch and focus-loss signals only** (A11).
- **The six security items** are the six in A1; the design refresh stays in Track B unless the design branch
  merges before Nov 18 (A12).
