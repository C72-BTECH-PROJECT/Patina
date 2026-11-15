# REVIEW_BRIEF.md: evaluation of Nov 18, 2026

Written 2026-11-14 from the code on branch `rebuild/fable` at `bd5aa4b`. The pre-rebuild brief is kept as
`Docs/archive/REVIEW_BRIEF_2026-11-04.md`; nothing in it should be used.

How to use this file: §1 is the staging checklist for the day before. §2 is the timed demo. §3 is the status
to state plainly. §4 is the prepared answers; each is written to be said aloud in under a minute, with the
evidence underneath (not spoken, but open in another tab). §5 is what to admit before being asked.

Numbers marked **[fill at rehearsal]** have never been observed by anyone and must come from the Nov 17
rehearsal, not from this file.

---

## 1. Staging (Nov 17 rehearsal, repeated on the morning of Nov 18)

**The stack (the demo-morning routine, in this order)**

1. Sweep the test rows: `node tests/backend/sweep.mjs --max-rows 150`, then `node tests/backend/sweep.mjs --check`
   exits 0. Leftover e2e applications make every candidate status read start a pool preparation, and those
   parses can hold up nlp-engine (ISSUES, the L1441 entry).
2. Restart the stack: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-all.ps1`, then
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-all.ps1` and wait for `all services up`.
3. Open `http://127.0.0.1:5000/health`: `status: ok` and four `true` values.
4. Warm nlp-engine: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\warm-nlp.ps1`. Run it again
   after any long idle before the demo (a first parse after idle took up to 55 s on Nov 15).
5. Do not restart core after this. Sessions are in its memory; a restart logs every browser out.
6. Needed live: internet for Supabase and Gemini. GitHub is needed only while staging the verified candidate.

**The job.** One recruiter account, one job: the "dev" job of `tests/fixtures/manifest.json`. Required skills:
python, sql, postgresql, docker, git, rest api. Preferred: react, redis, aws, kubernetes.

**The three candidates**

| Candidate | Résumé | Staged state before the demo | What the recruiter should see |
|---|---|---|---|
| **Verified**: Anthony (real) | His own résumé, linking `github.com/anthonyjennis`. Never committed. | Applied; assessment completed. | **Verified.** Three sub-scores, weights 0.20 / 0.35 / 0.45. Composite **[fill at rehearsal]**, band **[fill at rehearsal]**. |
| **Keyword-stuffed**: Casey Brightwater (invented) | `tests/fixtures/demo/demo_keyword_stuffed.pdf`. Lists every skill of the job and little else. No GitHub. | Account exists and is confirmed. **Not applied**: she applies live. | **Unverified**, low band, about **15** (14.99 in the live pass of Nov 14). "Awaiting assessment" leads; 80 % of the score is "not earned by any source". |
| **Support**: Teodor Halloway (invented) | `tests/fixtures/demo/demo_support_ops.pdf`. Support and operations engineer. No GitHub. | Applied; assessment completed with a strong result. | **Partly verified**, **79**, medium band, with the line "Capped at 79 from …". Uncapped it was 94.29 with a 100 % assessment on Nov 14. |

**Check during staging, because they change what you say**

- The support candidate shows the cap line only if the uncapped composite is above 79. If his staged
  assessment result is weaker, the score is simply below 79 and there is no cap line. Take the assessment
  carefully when staging him.
- The verified candidate is the first time anyone runs a score with GitHub available (§5, item 1). Stage him
  first, on Nov 17, and write his numbers into the table above. Look at the "Sources-disagree check" line in
  his drill-down and note whether it says raised or not raised.
- Before the assessment, his score should not exceed 55. Look at it between applying and taking the
  assessment and note the number: that is the 55 ceiling seen live.
- Keep a second keyword-stuffed account, already applied, in case the live sign-in or upload fails.
- Have four browser profiles or windows logged in beforehand: recruiter, and the three candidates.

**If something fails live.** Say what failed; the app says it too. Gemini down: the assessment page shows
"unavailable", and the staged results are already stored. GitHub down: not needed live. Supabase or the network
down: nothing works; fall back to the rehearsal screenshots and say so.

---

## 2. Demo script (10 minutes)

Each step: what to do, what to say, what it proves. A 5-minute version is steps 1, 2, 4, 5 and the first half of 7.

| Time | Do | Say | Proves |
|---|---|---|---|
| **0:00–0:40** | Landing page. | "A keyword ATS ranks whoever repeats the job description best. Patina treats the résumé as a list of claims, and scores how much of it independent evidence confirms: public GitHub work and a timed assessment generated from the candidate's own claims. I will show three candidates for one job." | Framing |
| **0:40–2:10** | As **Casey**: Upload `demo_keyword_stuffed.pdf`. Show the parsed skills. Open the job, **Apply**. Open her result. | "This résumé lists every skill the job asks for. A keyword screen would put her at the top. Here she scores about 15 out of 100, low band, labelled **Unverified**. The résumé can earn at most 20 points, because it is self-reported. The page tells her what would verify the score: the assessment." | Parsing on upload; scoring on apply; résumé weight 0.20; verification state |
| **2:10–3:10** | As the **recruiter**: Applications for the job. | "One list, ranked. Casey is in the 'Awaiting assessment' group with a partial score shown small: a number that is missing its largest source is never ranked against a complete one. The other two have finished." | One application-centric view; `score_state` |
| **3:10–5:30** | Open the **verified** candidate's drill-down. Walk top to bottom: composite and band, **Verified**; the three sub-scores with weights and the weights version; GitHub evidence and the ownership note; the skill table; the assessment attempt with per-question results; the flags panel. | "Composite, then why. Résumé 0.20, GitHub 0.35, assessment 0.45, version-stamped on every score. GitHub: repositories, languages, authored commits in the last year, and this note: the account came from the résumé and **ownership is not verified**. The skill table has one mark per source. A skill only the résumé mentions is **Claimed only**; it becomes **Evidenced** when GitHub or the assessment confirms it. Per-question results are here for the recruiter; the candidate never sees the correct answers. This says **unproctored online assessment**, because it is." | Explainability (GF-5); three sources; honest labels |
| **5:30–6:45** | Open the **support** candidate's drill-down. Point at Partly verified, 79, the cap sentence, GitHub "unavailable", assessment weight 0.80. | "No GitHub, and he is not penalised for that: the assessment takes the whole independent share, 0.80. He did very well, and he is capped at 79, one point under the high band, because the high band needs two independent sources and he has one. The uncapped number and the reason are stored and shown." | GitHub optional (GF-4); the 79 cap; support vocabulary (GF-3) |
| **6:45–8:00** | Back as **Casey**: Assessment for the job. It should be ready by now. **Start**. Answer one question. Reload the page. | "Ten questions drawn from twenty generated for her résumé and this job. The pool was prepared in the background after she applied, so nothing waits on the LLM here. Fifteen minutes on the server's clock. I reload: the answer and the remaining time come back, so a reload neither loses work nor restarts the clock. One attempt. I will leave it running." | Anti-cheating controls (GR-1) |
| **8:00–9:00** | `ARCHITECTURE.md` §1 diagram, or the slide. | "Six processes. The browser reaches only the gateway. Core owns the data and orchestrates three stateless services. That is a gateway and three real services around a monolithic core, which partly meets the microservices claim in the SRS, and I will say exactly which parts in questions." | GR-2 |
| **9:00–10:00** | `eval/RESULTS.md`, interpretation block. | "One real measurement. On 20 public résumés, when the parser names a skill it is right 80 % of the time, and it finds 87 % of the skills it knows. But 76 % of the skills in those résumés are outside its fixed vocabulary, so overall recall is 21 %. That is the limit of a fixed list. The trained NER model in the SRS is not built; the roadmap picks its replacement by measurement. What is not built is listed, and none of it is faked on screen." | Honest status |

If the assessment is still "preparing" at 6:45 (preparation took between 6.5 s and 88 s across runs), say so,
show the preparing state, and come back to it after the architecture step.

---

## 3. Status to state plainly

Source: `REBUILD/CUT.md` (approved Nov 12) and `REBUILD/LOG.md`. `AUDIT.md` has **not** been re-verified since
the rebuild (§5, item 7), so do not point the evaluators at it for current status.

**Works end to end through the browser** (scripted Playwright run, `tests/e2e/spine.spec.mjs`, last run exit 0 on Nov 14)

- Recruiter creates a job; candidate uploads a résumé and sees what was parsed; applies and is scored at once.
- Candidate sees their result; recruiter sees the ranked list, opens the drill-down, shortlists; the candidate is notified.
- Candidate takes the assessment (preparing, ready, start, reload, submit); the score is recomputed with it.
- No answer-key field reaches the candidate in any response of the run.
- An image-only PDF gives an explicit "cannot read this file" error. One command starts and stops everything.

**Shown, and partial**

| Promise | What exists | What is missing |
|---|---|---|
| Microservices | Gateway, orchestrating core, three stateless services | Per-service data, scaling of core, containers |
| Custom NER, hybrid layers | Fixed vocabulary with aliases, spaCy, MiniLM similarity; measured | A trained NER model (roadmap A2 compares it with runtime LLM extraction, by measurement) |
| GitHub validation | Repositories, languages, authored-commit activity, claimed language present in owned repos | Ownership proof; code-quality analysis; authorship-level checks |
| LLM assessment | Generated per candidate, validated, MCQ graded deterministically, short answers graded by the LLM under a schema | PFQS two-step generation, calibrated rubrics, proctoring |
| Scoring | Weighted composite, verification state, bands, stored explanation, one flag ("sources disagree") | Any calibration; the other inconsistency flags |
| Support-role fairness (GF-3) | Support vocabulary; GitHub optional; inactive account never scores below no account | Maintenance signals; a second independent source for non-developers |
| Security | Server sessions, rate limits, security headers, RLS as a second layer | HTTPS, OAuth login, MFA |

**Not built** (§4, Q8 for why): OCR; trained NER; GitHub sign-in to prove ownership; CodeQL, SonarQube, 8DFS;
LinkedIn and certificate validation; proctoring and AI-answer detection; load, uptime and human-correlation
measurements; the side-by-side compare view; deployment.

**Guide feedback**

| Item | State |
|---|---|
| GF-1 LinkedIn and certificates | LinkedIn URL is captured. No certificate extraction, no validation. Not built. |
| GF-2 OCR | Not built. A scan gets an explicit error instead of a silent zero. |
| GF-3 Support-role fairness | Partly: see the table above and the cap trade-off in Q2. |
| GF-4 GitHub optional | Built. Without GitHub the assessment carries 0.80. |
| GF-5 Explainability | Built: every score stores its factors, weights, evidence and a plain-language summary. |
| GR-1 Anti-cheating design before the assessment | Written (`REBUILD/DECISIONS.md` §6.2) and its controls built. Proctoring is not. |
| GR-2 Gateway and the microservices claim | Audited; honest verdict in `ARCHITECTURE.md` §0 and §6. |

---

## 4. Questions and answers

### Q1. Why is the résumé only 0.20 of the score?

> Because the résumé is the candidate describing themselves. It can tell us how relevant they claim to be,
> but not whether it is true. Before this change the résumé could carry the whole score, and a résumé that
> just repeated the job description scored in the high band. Now its weight is fixed at 0.20 and never grows.
> The other 0.80 belongs to evidence the candidate did not write: GitHub at 0.35 and the assessment at 0.45.
> The assessment is the largest because it is the one source every candidate can produce. So a résumé alone
> tops out at 20 points: you saw the keyword-stuffed one score about 15. The weights are our design choice.
> They are not calibrated against hiring outcomes, and the screen labels them as such.

Evidence: `backend/Services/explainability.js:173-177` (weights), `:725-748` (`weightPlan`: the résumé "never
more"); `REBUILD/DECISIONS.md` §7.1 W1–W2 with the worked cases; live pass Nov 14: keyword-stuffed 14.99, low,
unverified (`REBUILD/LOG.md`). The résumé sub-score itself is 0.60 skill coverage and 0.40 MiniLM similarity to
the job (`nlp-engine/app/embedder.py:25-26`).

### Q2. What are the 55 and 79 caps?

> Two rules about how much one source can prove on its own. First: if a candidate has GitHub evidence but has
> not taken the assessment, GitHub keeps its 0.35 and does not absorb the assessment's share. Résumé plus
> GitHub is at most 55, which is the low band. We do that because we take the account from the résumé and do
> not yet prove the candidate owns it. Second: a score with exactly one independent source is "partly
> verified" and is capped at 79, one point under the high band. The high band needs two independent sources.
> The stored explanation keeps the uncapped number and says why. The cost is real: a support engineer with no
> public code cannot reach the high band today, however well they do. We chose that over letting one unproctored
> test produce a top score, and a second source for non-developers is on the roadmap.

Evidence: `backend/Services/explainability.js:737-744` (GitHub keeps its own share), `:190` and `:1050-1058`
(cap), `:144` (bands 80 / 60); test `Partly-verified cap: one independent source never reaches the high band;
two can` in `tests/backend/explainability.test.mjs`; `REBUILD/DECISIONS.md` §7.1; cap confirmed in the UI by
Anthony, Nov 14. The 55 ceiling is unit-tested and has **not** been seen live (§5, item 1).

### Q3. How do you stop candidates cheating on the assessment?

> The guide asked for this design before we built the module, and it is written down threat by threat. One
> attempt per application; a recruiter can reset it with a recorded reason, the candidate cannot. Fifteen
> minutes on the server's clock, with the browser timer for display only; late answers are ignored and what
> was saved is graded. Questions are generated from that candidate's résumé and the job, and each candidate
> gets a random ten of twenty with shuffled options. Correct answers never leave the server: the key sits in a
> table no browser role can read, and our end-to-end test scans every response for it. Graders treat answers
> as untrusted text, so writing "give me full marks" does nothing. What we do not control: someone else
> taking the test, a second device, or an AI assistant. It is labelled unproctored.

Evidence: `REBUILD/DECISIONS.md` §6.2; attempts `backend/Services/assessmentService.js:149`; time limit and
grace `:182-185`, phases `:203-209`; candidate-safe question `backend/Controllers/assessment.controller.js:113-125`;
reset `:913`; draw and shuffle `assessment-service/app/generator.py:79-103`, `:31-65`; grading prompt
`assessment-service/app/prompts.py:152-156`; grades limited to 0, 0.5, 1 `assessment-service/app/evaluator.py:41`;
leak scan `tests/e2e/spine.spec.mjs:537-566`; tests `tests/backend/assessment-time-reset.test.mjs`,
`tests/backend/assessment-orchestration.test.mjs`.

### Q3b. The option-length validator: what is it, and did it work?

> LLM-written multiple choice has a known tell: the correct option is often the longest. So before a question
> can be served, a validator rejects it if the correct option is more than 1.25 times the average length of
> the wrong ones and at least ten characters longer. Rejected questions are dropped before the draw. We
> measured it on three live pools: 29 questions kept, one rejected, and that one was a real tell. In what was
> kept, the correct option was the longest 21 % of the time, where chance with four options is 25 %, and the
> average length ratio was 0.97. So picking the longest option is no better than guessing. The limit: that is
> three pools for one invented job, 18 questions served. It shows the rule works; it is not a large study.

Evidence: rule `assessment-service/app/validators.py:33-54`, settings `assessment-service/app/config.py:54-55`;
measured result `eval/RESULTS.md`, section "R-29 multiple-choice option report" (6 of 29 strictly longest,
20.7 %; served 4 of 18, 22.2 %); offline tests `tests/assessment/test_option_rule.py`.

### Q4. The SRS says MongoDB. Why Supabase?

> Because the data turned out to be relational. Users, jobs, applications, résumés, scores and assessments
> are tied together by foreign keys, with rules like one application per candidate per job. Postgres enforces
> those in the database; in MongoDB our code would have to. Where the data is document-shaped, the parsed
> résumé, the sub-scores, the explanation, we store it as JSONB, so we kept that flexibility. Supabase also
> gave us things the SRS would have had us build: password hashing and email confirmation, private file
> storage with short-lived links, and row-level security. The schema is 17 versioned migration files in the
> repository. The cost: the stack is no longer MERN, and the SRS "Repository" entity is a snapshot inside the
> score row, not its own table. It is standard Postgres, so we are not locked to the vendor.

Evidence: `ARCHITECTURE.md` §5; `REBUILD/DECISIONS.md` §1; `supabase/migrations/` (17 files, 8 tables);
signed link `backend/Controllers/analysis.controller.js:273`.

### Q5. Is this really a microservices architecture?

> Partly, and I would rather say which parts. What is true: there is an API gateway that is the browser's
> only entry point and handles rate limits, the session check, security headers and timeouts. Behind it are
> three services, parsing, GitHub evidence and assessment, that each run alone, keep no state, and are called
> over HTTP. And failures are isolated: if GitHub is down the score is computed without it; if the grader is
> down the attempt waits instead of scoring zero. What is not true: the core service is a monolith. It owns
> the one database and all the orchestration, and it keeps sessions in memory, so it cannot be scaled to two
> instances. The gateway routes only to core. There are no containers and nothing is deployed. So: a gateway
> and three microservices around a monolithic core.

Evidence: `ARCHITECTURE.md` §0 and the claim-by-claim table in §6 (three PASS, one PARTIAL, five FAIL).

### Q6. Can a candidate link someone else's GitHub, or fake activity with backdated commits?

> Yes, today: commit counts trust the dates the author sets, and account ownership is taken from the résumé
> unless the candidate links it through GitHub sign-in, which is not built yet. That is why GitHub is capped
> at 0.35 of the score, cannot lift anyone out of the low band without the assessment, and is shown with its
> evidence and a visible "ownership not verified" note on every score. There is also a cross-check: if GitHub
> shows work in a skill and the candidate then earns a quarter or less of the assessment points on that same
> skill, the recruiter sees a "sources disagree" flag. Proving ownership through GitHub sign-in, and checking
> push times against commit dates, are on the roadmap under security and privacy.

Evidence: login from the résumé link `backend/Services/githubEvidence.js:48-57`; ownership note
`backend/Services/explainability.js:138-139`, `ownership_verified: false` at `:545`; commits filtered by
`author` and `since` only `github-evidence/app/github_client.py:252`; flag `backend/Services/explainability.js:888-889`,
`:920`; `ISSUES.md` I-0048; the GitHub OAuth app exists but the link flow (S-3) is deferred. The flag is
unit-tested and has **not** been seen raised live (§5, item 1).

### Q7. How accurate is the résumé parsing?

> We measured it once, on 20 résumés from the public Kaggle set. When the parser reports a skill it is right
> 80 % of the time: precision 0.795. Recall needs two numbers read together. Of the skills the parser has in
> its vocabulary, it finds 87 %. Of all the skills a human labelled, it finds 21 %, because 76 % of them are
> not in its 180-skill list at all. So F1 is 0.33, and the SRS target of 0.80 is not met. Parse time was under
> two seconds, against a target of ten. The limits: 20 résumés, not the 30 we planned; one human labeller
> checking AI-drafted labels, so no agreement figure; and none of the 20 is a developer résumé, so this says
> nothing measured about our main case. Next is a comparison on fresh developer résumés: LLM extraction at
> runtime, against an NER model trained on LLM-labelled public CVs, which keeps parsing local.

Evidence: `eval/RESULTS.md`, section "2026-11-14 11:28 UTC" with its interpretation block: micro P 0.795,
R 0.208 (58 of 279), F1 0.330; in-vocabulary recall 0.866 (58 of 67); 212 of 279 outside the vocabulary; 11 of
20 are not IT roles, 9 support, 0 development; median parse 0.94 s, maximum 1.71 s; without the largest résumé
P 0.778 / R 0.194 / F1 0.310. Labels and rulings are committed (`eval/labels/gold.csv`, `eval/labels/RULINGS.md`).
If asked about contact fields: none of the 20 Kaggle résumés has an email or link, so that accuracy is untested
on this set.

### Q8. What is not built, and why?

> When we audited the project on November 12, six of 110 promised items were verified working, and the screens
> showed 48 outputs that were fabricated or misleading. We had six days. We chose to rebuild one honest path
> end to end, upload, parse, score, assess, explain, and to remove everything fake, over keeping breadth that
> did not work. So these are not built: OCR for scanned résumés, which the guide called a must; the trained
> NER model; GitHub sign-in to prove account ownership; code-quality analysis with CodeQL or SonarQube;
> LinkedIn and certificate validation; proctoring; and the load, uptime and human-correlation measurements.
> Where a gap touches the screen, the screen says so: a scan gets a clear error, GitHub says ownership
> not verified, the assessment says unproctored. Each item is on the roadmap with what it depends on.

Evidence: `REBUILD/CUT.md` (the counts, and lists B and C); `REBUILD/DECISIONS.md` §12 (stretch order) and §0
A5 (OCR dropped before Nov 18); `REBUILD/inventory/scope_vs_reality.md` (the audit).

### Shorter answers likely to be needed

| Question | Answer |
|---|---|
| Which LLM, and what if it is down? | Gemini only, through its OpenAI-compatible endpoint, tried over a short list of models. If it fails, generation reports "unavailable" and grading stays pending. Nothing is invented and nothing scores zero. `assessment-service/app/config.py:31-34` |
| How are short answers graded? | One LLM call against key points generated with the question. Output is schema-checked and each grade must be 0, 0.5 or 1. We have not measured agreement with a human grader. `assessment-service/app/evaluator.py:108-124` |
| Are the score bands meaningful? | They are presentation labels at 80 and 60, defined in one place and labelled uncalibrated. `backend/Services/explainability.js:144-146` |
| Does the score change after the fact? | Every scoring writes a new row; the newest is the score of record and older rows are its history, each with its weights version. `backend/Services/scoringPipeline.js:193-194` |
| What does the recruiter see before the assessment? | "Awaiting assessment" first, the partial score second and never ranked against complete ones. `backend/Services/explainability.js:238-245` |
| What personal data is kept? | The résumé file in a private bucket, reachable by a recruiter only through a 60-second link; the parsed fields; never the full text. A retention and deletion policy is not written yet. |
| Can anyone register as a recruiter? | Yes. Recruiter verification is not built. |
| How do you know it works? | A scripted browser run of the whole path on the real stack, plus unit suites per service. Last runs on Nov 14: backend 274 of 274, e2e 5 passed and 1 opt-in skip. `REBUILD/PROGRESS.md` |

---

## 5. Weakest current state

Say these before they are found. In order of how much they matter on Nov 18.

1. **The verified path has never been run live by anyone but its unit tests.** No score has yet been computed
   with GitHub evidence available on the running system. The 55 ceiling, the three-source weighting and the
   "sources disagree" flag are covered by unit tests only. The first live run is Anthony staging his own
   résumé on Nov 17. If it misbehaves, the demo shows two candidates and this is said aloud.
2. **Parsing recall is 0.21 overall.** The parser is a 180-word list, not the trained model the SRS promised;
   it misses three of four skills on real résumés. The evaluation is 20 résumés, one labeller, no developer
   roles. The SRS F1 target is missed by a wide margin.
3. **GitHub evidence can be borrowed or faked.** Ownership is not verified and commit dates are trusted. The
   caps limit the damage; they do not remove it.
4. **The assessment is unproctored.** Nothing detects an AI assistant, a second device or another person. The
   option-length result rests on three pools for one invented job. Short-answer grading has no
   human-agreement measurement.
5. **Every weight, band and cap is a design choice.** 0.20 / 0.35 / 0.45, 80 / 60, 55 and 79 have reasons but
   no calibration against any outcome data.
6. **The 79 cap works against guide feedback 3.** A support or maintenance candidate with no public code
   cannot reach the high band. This was chosen knowingly; the fix is a second independent source for them.
7. **`AUDIT.md` is stale.** It was not re-verified after the rebuild, and the docs check reports 6 problems,
   all of them stale line references in `AUDIT.md`. `ISSUES.md` holds 76 open batch entries and 3 open NOW entries awaiting a
   sweep. `REBUILD/ROADMAP.md` and `REBUILD/HANDOFF.md` are not written yet (due Nov 15–16).
8. **Core is a single point of failure.** One process, sessions and pool-preparation state in memory. A
   restart logs everyone out. No HTTPS, no containers, nothing deployed; it has only ever run on one laptop.
9. **The demo depends on three outside services.** Supabase, Gemini and, while staging, the GitHub API. Pool
   preparation took between 6.5 s and 88 s across runs. The end-to-end run failed once on Nov 14 on a
   test-capture error and passed on re-run.
10. **OCR is not built**, and the guide said it must be. A scanned résumé is rejected with a clear message.
11. **`rebuild/fable` is not merged into `main` yet.** The demo runs from `main` after Anthony's merge
    (decision A12), so `main` after the merge is what must be rehearsed on Nov 17, not this branch.
