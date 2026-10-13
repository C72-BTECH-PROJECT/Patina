# T-0009 — architecture-audit

> Approved by the owner 2026-10-12 with D1–D4 as proposed and the amendments
> below (recorded verbatim before any other file was changed).

## Owner amendments at approval (verbatim)
> Approved. D1–D4 as proposed; D4 stays a recommendation, and when M5
> happens is decided in the roadmap task, not here.
> One change to §0 (guide answer): don't argue that the SRS never specified
> a gateway. Move that fact to §3 (drift / accepted deviations). §0 should
> state plainly what exists today, what it fails, and the plan, in the
> first person. Line 1 starts: "We don't have an API gateway yet; our
> Express server is currently the entry point and the application itself."
> In §5, mark M1–M4 as "the minimum that answers GR-2" (isolation, single
> API base, a real gateway, one-command start), so the roadmap can sequence
> the rest separately.
> Proceed in auto mode.

Effect on the criteria below: 11 (M1–M4 marked) and 12 (§0 wording) are
amended in place; D4 carries no sequencing.

## Context
The guide asked which API gateway we use and whether we built the
microservices architecture the SRS claims. The SRS is
`Docs/C72_Activity-3_LY-Project_2025-27.docx`. Its claims:
- §2.1: "microservices architecture… backend microservices (NLP, validation, assessment)";
- §3: "MERN stack… Application Layer (Node/Express backend routing)… Data Layer (MongoDB)";
- §6.1 NFR-3: "Microservices must scale independently";
- §6.3 NFR-12: "graceful failure on API errors".

AUDIT.md has GR-2 as `CLAIMED_UNVERIFIED`. Its "Services that actually run"
table calls Express a "Gateway", which is the claim under test. Next free
number: T-0009 (T-0001..T-0008 exist).

## Goal
Answer GR-2 honestly and with evidence:
- name what, if anything, is the API gateway;
- judge the running system against seven microservice criteria;
- list every place the spec or trackers describe a different system;
- give a proportionate target architecture and a strangler migration.

The output is `ARCHITECTURE.md`, for the owner to show the guide.

## Spec ref
- GR-2: owner-reported guide feedback, Oct 2026 (`CHECKLIST.md:203`).
- CHECKLIST 0.1 (§2.1, NFR-3) and 0.7 (NFR-12).
- SRS docx §2.1, §3 System Architecture, §6.1 "Performance and Scalability"
  (NFR-1..4) and §6.3 "Security and Reliability" (NFR-8..12).
  - In `PROJECT_SOURCE_DOCS.md`: `:76-79`, `:104-107`, `:159-171`.
  - That file has no 6.1/6.3 subsection numbers; the NFR ids are the same.
- No FR or NFR is changed.

## Scope
**In:**
- `ARCHITECTURE.md` (new, root).
- `AUDIT.md`:
  - the GR-2 row;
  - the "Services that actually run" table (drop "Gateway");
  - 0.1 Notes (drop "pending GR-2");
  - 0.7 Evidence (an unreachable NLP gives 500, not "502");
  - Summary regenerated, plus a changelog line.
- `CHECKLIST.md`: GR-2 text only.
- `CLAUDE.md`, two lines:
  - a pointer to `ARCHITECTURE.md`;
  - GR-2 "audited in T-0009".
- `ISSUES.md`: new entries, plus notes on I-0012, I-0031, I-0032, I-0033.
- `WORKLOG.md`: one entry.
- `tests/docs/check-trackers.mjs`: the ARCHITECTURE.md checks (D2).
- `tests/arch/nlp-outage-probe.mjs`: the re-runnable probe (D1).
- `tests/README.md`: rows for both.

**Out:**
- Any change under `backend/ frontend/ nlp-engine/ supabase/`.
- Building the gateway, Dockerfiles or `docker-compose.yml`. They appear only as
  a design or draft in ARCHITECTURE.md.
- Editing `PROJECT_SOURCE_DOCS.md` or the SRS docx (I-0033 stays the owner's decision).
- Rewriting README/CODE_MAP/REVIEW_BRIEF (notes on I-0030..I-0032 only).
- Sequencing M5–M9: that belongs to the roadmap task.
- Commits and staging.

## Owner decisions (approved as proposed)
- **D1: live failure probe, committed as `tests/arch/nlp-outage-probe.mjs`.**
  - **What it does:** starts the backend itself and runs phases P-1..P-3 using
    the `t0001_*` accounts and `tests/backend/lib/{env,session,testdb}.mjs`. It
    creates one `[T-0001 TEST]` job via `insertTestJob` so `/api/analyze` reaches
    the NLP call, and finishes with the sweep.
  - **Where it runs:** not in the default suites. It is re-runnable, and it is the
    red test for migration step M1.
  - **Why it writes nothing:** analyze fails before any write when NLP is down or
    hung. The NLP call is at `backend/Controllers/analysis.controller.js:262`,
    before the writes at `:277`, `:303` and `:331`. The probe refuses P-1/P-2 if
    :8000 answers.
- **D2: docs checker covers ARCHITECTURE.md.**
  - every file:line cite resolves;
  - every row of a table with an "Evidence" column has a cite or a probe id `P-n`;
  - verdict cells are PASS/PARTIAL/FAIL;
  - "Verified at commit" is a real commit.

  The checker proves the cites exist, not that they are still right.
- **D3: GR-2 → `STUBBED_OR_PARTIAL`, not DONE.** The verification half is done;
  the "fix it" half is the migration. Notes name what promotes it.
- **D4: target auth is a recommendation only.** Supabase JWTs in httpOnly
  cookies, verified by the gateway and by core, with the gateway stripping
  client-sent `X-User-*` headers. When M5 happens is decided in the roadmap task.

## Acceptance criteria
1. **Sections.** `ARCHITECTURE.md` has:
   - §0 answer for the guide;
   - §1 as-is: units, calls, auth, data ownership, frontend calls, "is anything a gateway?", probe;
   - §2 verdict;
   - §3 drift and accepted deviations;
   - §4 to-be;
   - §5 migration;
   - a "Verified at commit" line.

   Checked by: `grep -n "^## " ARCHITECTURE.md`.
2. **Cites.** Every as-is and verdict claim carries a repo-relative `file:line`
   or a probe id `P-n`, and every cite resolves. Checked by:
   - `node tests/docs/check-trackers.mjs` → exit 0;
   - red check: with one cite set past the end of its file → exit 1, then restored;
   - I re-read every verdict-table cite myself and list them in Result.
3. **Runnable units.** One row per unit: frontend, backend, NLP, and "GitHub
   aggregator / assessment engine: not built". Each row gives language, port and
   where it comes from, start command, and responsibility. Checked by: the
   checker plus a manual read.
4. **Calls.** Every network call between units or to an external service is
   listed with: caller → callee, protocol, URL source (env var + default, or
   hardcoded), timeout, retry and error mapping. Checked by these greps at `8e8e498`:
   - `git grep -nE "\bfetch\(" -- backend ':!backend/node_modules'` → 2 hits
     (`analysis.controller.js:262` live, `githubAggregator.js:21` dead), both in the table;
   - the 39 `.from('<table>')` sites and 11 `.auth.*(` sites are covered, grouped by
     resource, in the data-ownership table;
   - `git grep -nE "import requests|httpx|urllib" -- nlp-engine/app` → 0, and the doc says so.
5. **Auth.** The doc says:
   - the check happens in `backend/Middlewares/auth.Middleware.js:5-48`;
   - it is session-based, using the in-process MemoryStore (`backend/index.js:30-41`);
   - the Supabase token is discarded at login (`backend/Controllers/auth.controller.js:333,347-350`).

   Checked by: the checker plus a manual read.
6. **Frontend calls.** Every network call in `frontend/src` is listed with its
   target origin. Checked by:
   - `git grep -nE "[fF]etch\(|\.open\(|XMLHttpRequest" -- frontend/src` → 33 hits,
     that is 29 calls plus 4 helper or constructor lines (`AuthContext.jsx:11,32,34`,
     `Processing.jsx:173`), named in the doc;
   - `git grep -nE ":8000|/parse|createClient" -- frontend/src` → 0, and the doc says so.
7. **Verdict table.** Exactly 7 rows:
   - independently deployable;
   - single responsibility;
   - network-only communication;
   - independent scaling (NFR-3);
   - failure isolation (NFR-12);
   - data ownership;
   - single client entry point.

   Each row is PASS/PARTIAL/FAIL with evidence, plus a one-line overall verdict.
   Checked by: the checker.
8. **Probe.** `node tests/arch/nlp-outage-probe.mjs` prints status and time for each phase:
   - **P-1, NLP down:** health, login, jobs, resume-status, analyze.
   - **P-2, NLP hung:** the probe's own listener accepts connections and never
     replies. Analyze gets no response within the client's 20 s limit, and
     `/api/jobs` still answers.
   - **P-3, NLP direct:** `GET /` latency during a `/parse`; one parse vs two
     concurrent parses.

   The output is pasted in the ARCHITECTURE.md appendix. Checked by: running it;
   then `node tests/backend/sweep.mjs --check` → 0 and ports 5000/8000 are free.
9. **Drift table.** Covers every place a spec, tracker or doc describes a
   different system, with source:line, what it says, what the code does, and
   where it is tracked:
   - MERN/MongoDB;
   - Firestore (archived tracker);
   - "Express = API gateway";
   - "microservices";
   - "Passport";
   - "independently deployable".

   The section also holds an accepted-deviations record:
   - Supabase Postgres instead of MongoDB;
   - a gateway the SRS never named. The "SRS never specified a gateway" fact
     lives here, not in §0.

   Checked by: `grep -rniE "mongo|mern|firestore|firebase|gateway|microservice|passport" --include=*.md .`
   (excluding node_modules and the ISSUES/WORKLOG/tasks history). Every hit is
   either in the table or listed as intentional in Result.
10. **To-be.** The section contains:
    - the six gateway responsibilities (routing, token verification, rate
      limiting, CORS, request-ID, aggregated health), each mapped to a mechanism;
    - a boundary decision with its reason for each of core, NLP, GitHub evidence and assessment;
    - a schemas and per-service-roles plan with a "won't do" list;
    - an options table (thin Node / Nginx / Kong / Traefik) with one recommendation;
    - a compose draft marking published vs internal ports, with a healthcheck for every service.

    Checked by: manual review.
11. **Migration** (amended). Ordered steps, each a candidate task with
    dependencies and at least 2 measurable draft criteria.
    - **M1–M4** are marked "the minimum that answers GR-2": isolation, single API
      base, a real gateway, one-command start. M5+ is left for the roadmap to sequence.
    - The owner's four examples appear, adjusted to the code: upload does not call
      NLP at HEAD, so the outage criterion is "analyze → 503, while
      login/jobs/upload keep working".

    Checked by: manual review plus a grep for the four and for the M1–M4 marker.
12. **Guide answer** (amended). §0 is exactly 5 lines, in the first person, and
    agrees with the verdict table.
    - Line 1 starts: "We don't have an API gateway yet; our Express server is
      currently the entry point and the application itself."
    - §0 does not argue about what the SRS specified.

    Checked by: `grep -n "We don't have an API gateway yet" ARCHITECTURE.md`; a
    grep showing §0 has no "SRS never"; manual review by the owner.
13. **Diagrams.** Two Mermaid diagrams (as-is and to-be) show components, ports,
    calls and data stores. Checked by: manual. The owner opens the GitHub or
    VS Code preview. I can't render them because mermaid-cli needs Chromium.
14. **AUDIT.md.**
    - GR-2 is `STUBBED_OR_PARTIAL` with file:line evidence, Delivered by, and
      Notes naming what promotes it.
    - `grep -n "Gateway to" AUDIT.md` → no hit.
    - The Summary equals the output of `node tests/docs/check-trackers.mjs --summary`.

    Checked by: those commands.
15. **CLAUDE.md and CHECKLIST.md** no longer call GR-2 pending or unverified.
    Checked by: `grep -niE "pending the architecture|unverified until" CLAUDE.md CHECKLIST.md` → none.
16. **ISSUES.md** has the new entries with evidence, plus notes on I-0012,
    I-0031, I-0032 and I-0033. Checked by: grep for the ids.
17. **Docs suite and diff.**
    - `powershell -File tests\run-suite.ps1 -Target current -Suites docs` → `docs 0`.
    - `git status --short` shows nothing under `backend/ frontend/ nlp-engine/ supabase/`.
    - `git diff --cached --name-only` is empty.
18. **Close-out.** WORKLOG L-0019 is appended (≤15 lines), and Result is filled
    with PASS/FAIL and evidence per criterion.

## Test plan
- **Checker extension first.** It must fail while ARCHITECTURE.md is missing or
  has a bad cite, then pass on the finished doc.
- **Probe.** It characterises today's behaviour without pass/fail thresholds.
  M1 turns it into a red/green test.
- **Not automatable:** criteria 10–13 (design judgement, Mermaid rendering).

## Regression
- The `docs` suite.
- No code changes, so the nlp/backend/frontend suites are not re-run. The probe's
  only writes are one tagged test job and, added during execution, one upload under
  `resumes/candidates/<C>/` (to prove upload works with NLP down). Both are swept.

## Risks and rollback
- **Risk:** the probe touches the live Supabase project: logins, one
  `[T-0001 TEST]` job, one upload under `candidates/<C>/`, and the sweep. The
  sweep guards apply, and the probe refuses P-1/P-2 if :8000 answers.
- **Risk:** cites rot. ARCHITECTURE.md records its verified-at commit, and the
  docs suite checks every cite.
- **Risk:** §4/§5 read as commitments. They are labelled "proposal; each step is its own task".
- **Rollback:** text files plus two test scripts. No code or schema to undo.

---

## Result
Verified at HEAD `8e8e498` (branch `Anthony_V3`). Nothing committed or staged:
`git diff --cached --name-only` → 0 lines.

1. **PASS.** `grep -n "^## " ARCHITECTURE.md` → §0 at :19, §1 at :29, §2 at :255,
   §3 at :273, §4 at :309, §5 at :545, Appendix A at :649. "Verified at commit:
   `8e8e498`" is at :7.
2. **PASS.**
   - `node tests/docs/check-trackers.mjs` → `ARCHITECTURE.md 187 cites OK`, exit 0.
   - Red check: changing `backend/index.js:74` to `:999` → `cite backend/index.js:999 is past end of file (123 lines)`, exit 1; then restored, with the file hash unchanged.
   - The checker also caught two bare-filename cites during writing; both fixed.
   - Verdict-table cites re-read by me:
     - `frontend/package.json:21`
     - `backend/package.json:7`
     - `README.md:123`
     - `nlp-engine/requirements.txt:2`
     - `frontend/src/pages/recruiter/CreateJob.jsx:211`
     - `frontend/src/pages/public/ResetPassword.jsx:6`
     - `backend/Controllers/analysis.controller.js:12`, `:262`, `:357-359`
     - `nlp-engine/app/main.py:1-11`, `:19-24`, `:48-57`, `:49`, `:59-63`
     - `backend/index.js:30-41`, `:50-60`, `:62-64`
     - `backend/Routes/auth.routes.js:17-21`
     - `backend/Controllers/jobs.controller.js:102`
     - `backend/Config/supabase.js:54-62`
     - `supabase/migrations/20260823_create_profiles.sql:6`
     - `frontend/src/context/AuthContext.jsx:4`
     - `tests/run-suite.ps1:74`
   - The other cites come from the three Explore agents' reads plus my spot-reads
     (the line printouts in this session). The checker range-checks them; I did not
     re-read each one individually.
3. **PASS.** §1.2 has 5 rows: frontend, backend, NLP, GitHub Aggregator (not built),
   Assessment Engine (not built). Each row gives language, port and its source,
   start command, responsibility and evidence.
4. **PASS.**
   - `git grep -nE "\bfetch\(" -- backend ':!backend/node_modules'` → 2 hits, both in §1.3.
   - `git grep -nE "import requests|httpx|urllib" -- nlp-engine/app` → 0, stated in §1.3.
   - The 39 `.from(` and 11 `.auth.*(` sites are grouped by resource in §1.3 and §1.5.
5. **PASS.** §1.4 states:
   - session-based, MemoryStore (`backend/index.js:30-41`);
   - the check in `backend/Middlewares/auth.Middleware.js:5-48`;
   - the token discarded at `backend/Controllers/auth.controller.js:333,347-350`;
   - no `Authorization` header read anywhere;
   - NLP unauthenticated.
6. **PASS.** `git grep -nE "[fF]etch\(|\.open\(|XMLHttpRequest" -- frontend/src` → 33,
   which is 29 table rows plus the 4 named helper lines.
   `git grep -nE ":8000|/parse|createClient" -- frontend/src` → 0.
7. **PASS.** §2 has 7 rows: 1 PASS, 5 PARTIAL, 1 FAIL, plus the overall line.
   - The checker validates the verdict cells.
   - Red check: "MOSTLY" → `has verdict "MOSTLY"`, exit 1.
   - Red check: an Evidence cell emptied of cites → `has no file:line or P-n`, exit 1.
   - Both restored, with the hash unchanged.
8. **PASS.** `node tests/arch/nlp-outage-probe.mjs` ran twice. Both exited 0.
   The second run added the upload step; its output is pasted in Appendix A.
   - **P-1 (NLP down):** login, jobs, resume-status and upload → 200. Analyze →
     500 in 105 ms, raw error text included.
   - **P-2 (NLP hung):** analyze → no response at 20 s, while jobs → 200 and health → `ok`.
   - **P-3 (NLP busy):** `GET /` waits behind a parse (92 ms vs 2 ms idle), and two
     parses run one after the other (253 / 558 ms).
   - Afterwards `node tests/backend/sweep.mjs --check` → exit 0, every count 0.
     `Get-NetTCPConnection` shows nothing listening on 5000 or 8000.
9. **PASS.** The grep finds 210 occurrences across 18 `.md` files.
   - Outside ISSUES/WORKLOG/tasks history, every hit is in the §3.1 table or is
     an intentional mention:
     - AUDIT: data-model statement, changelog, 2.2 grep note, 3.7 Mongoose note;
     - CHECKLIST 0.1/0.2/GR-2: requirement text;
     - CLAUDE.md: design and explanatory lines;
     - INTEGRATION_REVIEW: history;
     - `REVIEW_BRIEF.md:330-334`: a correct answer; `REVIEW_BRIEF.md:604`: history;
     - `CODE_MAP.md:500`: correct;
     - `tests/BASELINE_RESULTS.md`: lockfile note;
     - ARCHITECTURE.md itself.
   - In the §3.1 table: `PROJECT_SOURCE_DOCS.md:77-78,104-106,162`,
     `REVIEW_BRIEF.md:21,309`, `README.md:61`, `CODE_MAP.md:19`, both `Docs/archive` files,
     the deleted `Docs/Architecture.md`, and the old AUDIT "Gateway" row.
10. **PASS (content); judgement is the owner's.** §4.2 maps all six
    responsibilities. §4.4 decides boundaries for all four domains. §4.5 has the
    schemas/roles plan and the won't-do list. §4.6 has the 4-option table and the
    recommendation. §4.7's compose draft has published vs internal ports and a
    healthcheck on every service.
11. **PASS (content); judgement is the owner's.**
    - "The minimum that answers GR-2: M1–M4" is at `ARCHITECTURE.md:550`.
    - The four examples are at `:580` (zero direct port calls), `:600` (401 at the
      gateway), `:603` (`X-Request-ID` in every service's logs), and `:567`/`:623`
      (NLP stopped → analyze 503 while login, jobs and upload work).
    - M5+ is in a separate table headed "sequenced by the roadmap task".
12. **PASS (automated parts); owner review pending.** "We don't have an API
    gateway yet; …" is at `ARCHITECTURE.md:21`. §0 has exactly 5 numbered lines,
    contains no "SRS", and is in the first person. The "SRS names no gateway"
    fact is in §3.2 AD-2 and ISSUES I-0033.
13. **PENDING (owner).** Both diagrams (§1.1, §4.1) use plain `flowchart LR`
    syntax with quoted labels. I could not render them here.
14. **PASS.**
    - GR-2 is `STUBBED_OR_PARTIAL`, with cites, `audit: T-0009; architecture: unattributed<=32905c1`, and Notes naming the four promoting tests.
    - `grep -n "Gateway to" AUDIT.md` → 0.
    - The Summary block equals the `--summary` output (scripted comparison → True).
    - GR row: PARTIAL 1, MISSING 1. All: CLAIMED_UNVERIFIED 0.
15. **PASS.** `grep -niE "pending the architecture|unverified until" CLAUDE.md CHECKLIST.md` → 0.
16. **PASS.** I-0034..I-0039 each have one table row and one entry. I-0012,
    I-0031, I-0032 and I-0033 each have a "Note (2026-10-12, T-0009)".
17. **PASS.**
    - `powershell -File tests\run-suite.ps1 -Target current -Suites docs` → `docs 0`.
    - `git status --short`: M `AUDIT.md CHECKLIST.md CLAUDE.md ISSUES.md tests/README.md tests/docs/check-trackers.mjs`
      (plus `WORKLOG.md` after the close-out entry); new `ARCHITECTURE.md`,
      `tasks/T-0009-architecture-audit.md`, `tests/arch/`.
    - Nothing under `backend/ frontend/ nlp-engine/ supabase/`. Staged: none.
18. **PASS.** This Result, and WORKLOG L-0019.

### Changes from the approved plan (owner confirmed 2026-10-12)
- **M3 is a real gateway, not a skeleton.** To make M1–M4 a complete answer to
  GR-2 (owner amendment), M3 now carries all six responsibilities: routing; an
  interim auth check by session introspection against core's `GET /api/auth/me`;
  rate limits and CORS moved out of core; `X-Request-ID`; aggregated health.
  This puts "401 at the gateway" inside M1–M4. The old "M6 gateway edge"
  becomes "M6: switch the gateway's check to local JWT verification after M5".
  Cost: one extra internal call per protected request until M5/M6.
- **Accepted by the owner (verbatim):**

  > Accept: M3 includes the interim forward-auth via /api/auth/me. Record it in
  > ARCHITECTURE.md §5 as decided, with these constraints: the gateway forwards
  > only the session cookie; /api/auth/me is not rate-limited and answers 401
  > fast; the public allowlist (login, signup, reset, health, anything else
  > public) is written out explicitly; M6 replaces this check with token
  > verification.
  > Also mark my decisions in ARCHITECTURE.md: thin Node gateway (accepted); D4
  > JWT auth as the target (accepted, timing set by the roadmap); GitHub evidence
  > and assessment as separate Python services (accepted in principle, owners to
  > be decided with the team). Update the WORKLOG entry.

- **Recorded as follows:**
  - ARCHITECTURE.md §4 "Decisions recorded" (DEC-1..DEC-4).
  - §5 M3 holds the forward-auth constraints:
    - only the session cookie is forwarded;
    - `/me` is exempt from every limiter;
    - no cookie → 401 at the gateway without calling core;
    - fails closed: anything but 200 or 401 or 403, or more than 2 s → 503;
    - no caching.
  - §5 M3 also holds the public allowlist, written from the routes that carry no
    auth middleware (6 auth routes, `/api/health`, the gateway's `/health`,
    static frontend, OPTIONS preflight), deny by default, plus matching draft
    criteria.
  - The M6 row replaces the check.
  - AD-2 in §3.2 is "Accepted".
  - `node tests/docs/check-trackers.mjs` → 205 cites OK.
- **The probe also uploads once** (P-1), so "upload keeps working with NLP down"
  is measured, not just read from code. The upload is swept like the test job.
- **AUDIT 1.1 cites the wrong handler.** `analysis.controller.js:209` ("rejects
  other types") is in the upload handler, and `analyzeResume` has no type check.
  Logged in I-0034, not edited (outside this task's rows).

### Found, not fixed (all in ISSUES)
- I-0034: NLP open with CORS `*` and `/docs`; analyze forwards any file type.
- I-0035: core is single-process (MemoryStore, in-memory limiter, no session regenerate).
- I-0036: outage gives a raw 500, an echoed 502, no timeout or retry, and health blind to dependencies.
- I-0037: `async def` `/parse` blocks the loop.
- I-0038: unpinned Python, 3 venvs.
- I-0039: cruft.

---

## Execution notes
- **Order followed:**
  1. spec written, with the owner's amendments verbatim;
  2. checker extended, red (`ARCHITECTURE.md is missing`);
  3. probe written and run (twice);
  4. ARCHITECTURE.md written; checker green; red checks;
  5. AUDIT, CHECKLIST, CLAUDE.md and tests/README updated;
  6. ISSUES updated;
  7. verification run;
  8. Result filled; WORKLOG appended.
- **Evidence sources:** three read-only Explore agents (backend; NLP + infra;
  frontend + docs + SRS docx) and one Plan-agent design review. Spot-reads by me
  are listed in criterion 2.
- **Suggested commit boundary** (the owner commits):
  1. `tests/docs/check-trackers.mjs`, `tests/arch/`, `tests/README.md`;
  2. `ARCHITECTURE.md`, `AUDIT.md`, `CHECKLIST.md`, `CLAUDE.md`, `tasks/T-0009-*`;
  3. `ISSUES.md`, `WORKLOG.md`.

  One commit is also fine, since everything is docs and tests.
