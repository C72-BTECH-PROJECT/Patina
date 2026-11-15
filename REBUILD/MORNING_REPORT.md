# Morning report: overnight design run D-4 to D-10 (2026-11-15)

Run unattended on `design/refresh` by `REBUILD/OVERNIGHT_RUN.md`.
- **Git was never touched.** Nothing is staged and nothing is committed.
- **Each card's files were backed up first** to `REBUILD/backup/<card>/`. No card needed a restore.
- **The stack is still running.** Look at http://localhost:3000.

## 1. Cards

| Card | Result | Notes |
|---|---|---|
| D-4 Auth screens (R-35d) | **PASS** | G green. `type="submit"` count in Login.jsx is 2, as before. Hook lines changed in `className` only. |
| D-5 Results page and score ring (R-35e) | **PASS** | G green, with 4 new `useCountUp` tests. The first e2e run failed at apply with `parser_unavailable`: the core log shows `nlp timeout after 30000 ms`. That happened before the results page, so it was not caused by D-5 (see §6). The one re-run exited 0, and spine `:313` and `:548` passed. |
| D-6 ScoreBreakdown and drill-down (R-35f) | **PASS** | G green. No `framer-motion` in either file. |
| D-7 Candidate pages (R-35g) | **PASS** | G green. No `framer-motion` in `pages/candidate`. The Shortlisted chip is now filled blue with a star. |
| D-8 Recruiter and admin pages (R-35h) | **PASS** | G green. No `framer-motion` in recruiter or admin. The Shortlisted chip changed on the recruiter side too. |
| D-9 Landing | **SKIPPED** | Waits for O-10. |
| D-10 Verification (R-35k) | **Done, 1 e2e failure** | `Docs/design-refs/VERIFY.md`. `unreadable.spec` got an HTTP 429 from the rate limiter. |

## 2. Test totals and e2e runs

- **Last G (D-10):** 12 suites, **125/125** tests. `CI=true npm run build` **exit 0**; the only output is Node's `fs.F_OK` deprecation notice. Before the run it was 11 suites / 121 tests.
- **e2e runs.** Logs are in `tests/e2e/output/design/`.

| Run | Result |
|---|---|
| After D-5, run 1 (`e2e-d5-1.log`) | **exit 1.** The spine failed in step 3 because apply returned `parser_unavailable` (NLP parse timed out at 30 s). The other specs passed. |
| After D-5, run 2, the one allowed re-run (`e2e-d5-2.log`) | **exit 0.** 5 passed, 1 opt-in skip (signup). |
| D-10 (`e2e-d10-1.log`) | **exit 1.** The spine passed (57.5 s), and so did smoke ×2 and signup. **`unreadable.spec.mjs:17` failed: `GET /api/resume/status` returned 429**, because it came straight after a fast spine run and the gateway's global limiter allows 300 requests a minute. I did not re-run it, because of the one-run cap. Logged in `ISSUES.md` as BATCH·demo. |

## 3. Screenshots (`tests/e2e/output/design/`)

- D-4: `d4-login.png`, `d4-signup.png`, `d4-select-role.png`
- D-5: `d5-result.png` (the ring shows 16.23, the same as the stored composite)
- D-6: `d6-drilldown.png`
- D-7: `d7-candidate-dashboard.png`, `d7-candidate-jobs.png`
- D-8: `d8-recruiter-dashboard.png`
- D-10, 1440 wide: `d10-landing-1440.png`, `d10-login-1440.png`, `d10-signup-1440.png`, `d10-candidate-dashboard-1440.png`, `d10-result-1440.png`, `d10-recruiter-applications-1440.png`, `d10-drilldown-1440.png`, `d10-createjob-step2-1440.png`
- D-10, 390 wide: `d10-login-390.png`, `d10-result-390.png`

None of them shows an uncaught page error, and none has horizontal scroll.

## 4. Suggested commits (one per card)

1. **D-4:** `frontend/src/pages/public/{Login,ResetPassword,RoleSelection,EmailConfirmed,NotFound}.jsx`
2. **D-5:** `frontend/src/pages/candidate/Results.jsx`, plus the new `frontend/src/lib/useCountUp.js` and `frontend/src/lib/useCountUp.test.js`
3. **D-6:** `frontend/src/components/recruiter/{ScoreBreakdown,CandidateModal}.jsx`
4. **D-7:**
   - `frontend/src/pages/candidate/{Dashboard,CandidateJobs,JobDetail,Upload,Assessment,Notifications,CandidateProfile,applicationState}.jsx`
   - `frontend/src/components/assessment/{QuestionCard,AppliedJobPicker}.jsx`
   - `frontend/src/components/Badge.jsx` (one new `solid` variant)
5. **D-8:**
   - `frontend/src/pages/recruiter/{Dashboard,Jobs,JobDetails,CreateJob}.jsx`
   - `frontend/src/components/recruiter/{ApplicationsTable.jsx,applicationsLogic.js}`
   - `frontend/src/pages/admin/Dashboard.jsx`
6. **D-10 and docs:**
   - `Docs/design-refs/VERIFY.md`, `ISSUES.md`
   - `REBUILD/{TASKS,PROGRESS,LOG}.md`, `REBUILD/MORNING_REPORT.md`, `REBUILD/OVERNIGHT_RUN.md`

**Do not commit `REBUILD/backup/`.** It holds the pre-card copies and is the only undo. Delete it once you are happy.

## 5. Leftover live test rows for your sweep

All of these were created by the e2e suite. I deleted nothing.

| Table | Rows |
|---|---|
| jobs (3) | `d5a11fb7-c8c0-466f-817c-efcde131536e`, `2b608e50-b994-4101-9ec8-8cce90b761ae`, `008ebbd0-f325-44ee-a646-af268a0ef07d` |
| resumes (3) | `73052ed6-3f90-4ffe-8b40-36b29b134254`, `086b50ce-ddc6-496a-87a9-c63e401bafa4`, `708c2db4-2ffd-45c7-9b1b-93cc2adeade8` |
| applications (3) | `329b4223-e7bc-4ba7-8def-143e080b57a1` (never scored), `ee39ec0f-7195-4d12-879b-54d621307c78`, `093503ec-5793-4788-a8b4-a60c60439ef6` |
| notifications (2) | `472705ad-7fc0-4475-aba4-04e9f5130cb2`, `b2d27741-2025-42d3-bc7c-8b9f3017144a` |
| assessments (2) | `a5ee9509-f14a-4a03-8d9d-16b6da565ff0`, `fb46dd85-2b38-4b5a-acf9-88218020c839` |
| assessment_keys (2) | the rows with those two `assessment_id`s |
| scores (4) | `da819bc0-12b4-41b0-aa57-567f9bc7bfb2`, `72578f1a-8645-40d7-84d3-65743d290ec3`, `abc4519b-6995-4852-96c2-cc19debe9288`, `68a08fe6-6c9d-45ee-bc78-77730a168e93` |

**Total: 19 rows across 7 tables.**

**Storage.** The three spine uploads each stored a résumé file in the test candidate's storage folder. The `unreadable` spec in the D-5 run 2 also uploads an image file; whether that file is stored was not checked tonight.

**Not created:** the CreateJob screenshot stopped at step 2 and submitted nothing.

## 6. Decisions made where the run file was silent

1. **Badge `solid` variant.** The Shortlisted mapping (filled primary) needed a Badge variant that did not exist. I added one line to `Badge.jsx` (`solid: 'bg-primary text-primary-foreground border-transparent'`) under D-7, and backed the file up with D-7. The alternative was overriding the classes through `className`, but two `bg-*` utilities clashing gives an unpredictable result.
2. **`applicationsLogic.js` was added to D-8,** because the recruiter status map lives there (run file §2). Only the `shortlisted` entry changed. `CandidateModal` shows the same blue chip but **without the star**, because it does not pass `icon` and was not in D-8's file list.
3. **The first D-5 e2e failure was not treated as D-5's fault.** It was an NLP parse timeout at apply, before any page D-5 touched, so I re-ran once instead of restoring. The re-run passed.
4. **D-10's 429 was not re-run.** §4 says "never more than that". The spine itself passed in that run.
5. **Screenshot helpers.** `shot.mjs` cannot click, set the width or reuse a login. So for the drill-down, CreateJob step 2, the 390-wide shots and the D-10 set I wrote throwaway scripts in the git-ignored `tests/e2e/output/design/`: `shot-click.mjs`, `d10-shots.mjs` and `contrast.mjs`. D-10 logs in once per role to stay under the auth limiter. No tracked test file was edited.
6. **Agent.** The run file names `patina-mechanical` (Sonnet), so every card used it. Each card built at the first attempt, so no fix attempt or Opus fallback was needed.
7. **Subagent judgement calls I accepted:**
   - The CreateJob step indicator stays as numbered circles, with a primary active state and a primary-soft done state. Literal dots would change the content.
   - D-8's submit spinner uses muted-foreground borders, because the button is muted while submitting.
   - D-4's `RoleCard` keeps its now-unused `delay` and `color` props, to leave the prop contract alone.
   - The green `resume-parsed` success box in Upload was not restyled, because the card does not ask for it.
8. **Line endings.** The subagents saved files with LF. `core.autocrlf=true` normalises them, so the diffs are small (214+/253− across 19 files, before the D-8 files were added).

**Still unverified:**
- the reduced-motion behaviour (manual, see §7);
- a side-by-side comparison of the auth screens with `mock.html` §1 (screenshots taken, not compared);
- the D-8 recruiter applications page and drill-down at 390 wide;
- the D-5 manual check with OS reduced motion on.

## 7. What D-10 found

- **Contrast:** 36 of 36 pairs pass. They were computed from the final `index.css` HSL tokens and chip hexes (`d10-contrast.txt`) and are identical to spec §2.4. The tightest are destructive on its 10% tint, 4.52, and the warning ring on the track, 3.18. The new Shortlisted chip, white on primary, is 11.25.
- **Remaining `framer-motion` importers:**
  - `frontend/src/App.jsx:3`: `MotionConfig`, kept on purpose by D-1;
  - `frontend/src/pages/public/Landing.jsx:3`: D-9 has not run.

  Because importers remain, no [ask] to remove the dependency was added.
- **Reduced motion: you need to check this by hand.** Turn on OS reduced motion (Windows: Settings → Accessibility → Visual effects → Animation effects off). Then open a candidate result page, for example `/candidate/results/093503ec-5793-4788-a8b4-a60c60439ef6`, and confirm that the number and the ring appear at their final values straight away, with no count-up and no sweep.
  - The unit test covers `useCountUp` under reduced motion.
  - The ring arc's CSS transition relies on D-1's global reduced-motion rule, and nobody has watched that on screen.
