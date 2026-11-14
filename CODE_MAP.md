# CODE_MAP

Generated 2026-11-14 from the working tree on branch rebuild/fable at commit bd5aa4b plus uncommitted doc changes.

How to use: find the question in section 1, open the file at the line. Sections 2-11 list every file per unit. Line numbers are for this working tree; if a file was edited since, search for the function name instead. This is a lookup table, not a status document: it says where code is, not whether it works. The previous map (Nov 4) is archived at `Docs/archive/CODE_MAP_2026-11-04.md`.

Processes (start all: `powershell -File scripts\start-all.ps1`, stop: `scripts\stop-all.ps1`; from `scripts/start-all.ps1:47-73`)

| Process | Port | Start command (as run by start-all) |
|---|---|---|
| nlp-engine | 8000 | `nlp-engine\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000` |
| github-evidence | 8001 | `github-evidence\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001` |
| assessment-service | 8002 | `assessment-service\.venv\Scripts\python.exe -m app` (env ASSESSMENT_HOST/PORT) |
| core (backend/) | 5001 | `node index.js` in `backend/` (binds 127.0.0.1) |
| gateway | 5000 | `node index.js` in `gateway/` (the only public entry) |
| frontend (dev) | 3000 | `npm start` in `frontend/` (skipped with `-NoFrontend`) |

## 1. Where is...

### Score and explainability (all in `backend/Services/explainability.js` unless stated)

| Question | File:line |
|---|---|
| Base weights 0.20 / 0.35 / 0.45 (resume / GitHub / assessment) | explainability.js:173 (`DEFAULT_BASE_WEIGHTS`); env override `CREDIBILITY_WEIGHTS` read at :193 |
| Weights version string `w3-2026-11-14` | explainability.js:184 (`WEIGHTS_VERSION`); stored in explanation at :1089 and record at :1165 |
| Rule: resume weight never grows | explainability.js:733 (`weights[P] = share(P)` only if available); rule text :708-722; function `weightPlan` :725 |
| Ceiling 55 (GitHub without assessment: r + g) | explainability.js:740 (`else if (avail(G))` keeps g only); comment :719 |
| Partly-verified cap 79 | explainability.js:190 (`PARTLY_VERIFIED_CAP` = high - 1); `partlyVerifiedCap` :1050; applied in `finishRecord` :1148-1151 |
| Verification state unverified / partly_verified / verified | explainability.js:217 (`VERIFICATION`); `scoreVerification` :224; note text `verificationNote` :1001 |
| Score bands 80 / 60 | explainability.js:144 (`SCORE_BAND_THRESHOLDS`); `scoreBand` :149 |
| `score_state` awaiting_assessment / final | explainability.js:238-245 (`AWAITING_ASSESSMENT_STATES`, `scoreState`); sent in API at analysis.controller.js:684 |
| "Sources disagree" flag and its two settings (2 points, 25% share) | explainability.js:888-889 (defaults), :892 `readFlagSettings` (env `FLAG_DISAGREE_MIN_POINTS`, `FLAG_DISAGREE_MAX_SHARE`), :920 `buildFlags`, :967 flag kind; shown in `frontend/src/components/recruiter/ScoreBreakdown.jsx:176` |
| Skill evidence statuses claimed_only / evidenced / not_found | explainability.js:768 (`SKILL_STATUS`), :809 `buildSkillEvidence`; labels "Claimed only / Evidenced / Not found" at ScoreBreakdown.jsx:36-52 |
| GitHub ownership-not-verified note | explainability.js:138 (`GITHUB_OWNERSHIP_NOTE`), :545 (`ownership_verified: false`); shown in `frontend/src/pages/candidate/Results.jsx:131` |
| Inactive GitHub account text (`no_recent_public_activity`) | explainability.js:86; produced by `github-evidence/app/scoring.py:103` |
| Whole score record built | explainability.js:1131 `buildScoreRecord`, :1148 `finishRecord`, :1060 `buildExplanation` |

### Scoring on apply, score again

| Question | File:line |
|---|---|
| Score on apply | backend/Controllers/jobs.controller.js:195 `applyToJob`; calls `scoreApplication` at :257; assessment pool prepared after apply at :273 |
| "Score again" endpoint `POST /api/applications/:id/score` | backend/Routes/analysis.routes.js:26 -> analysis.controller.js:397 `rescoreApplication` (calls `scoreApplication` at :426) |
| Scoring steps (parse, GitHub, assessment, composite) | backend/Services/scoringPipeline.js:124 `scoreApplication`; resume pipeline :140; GitHub :167; `buildScoreRecord` :182 |
| New `scores` row inserted each time, never updated | scoringPipeline.js:193 (`.insert`); rule comment :6; failure reasons :41 |
| Score after grading (new row again) | assessment.controller.js:429 and :961 (`scoreApplication` with `assessmentOnlyFallback`) |

### Resume upload and parsing

| Question | File:line |
|---|---|
| Upload route `POST /api/resume/upload` | backend/Routes/analysis.routes.js:23 -> analysis.controller.js:298 `uploadResume` (array: `resumeUpload`, `requireResumeFile`, handler) |
| Size limit 10 MB, multer | backend/Config/uploadLimits.js:4; backend/Middlewares/resumeUpload.js:22 (413 on limit) |
| Leading-bytes file check (`%PDF-` in first 1024 bytes; DOCX `PK\x03\x04`) | resumeUpload.js:45 `RESUME_TYPES`, :67 `resumeBytesMatch`, :75 `requireResumeFile` (400 `file_content_mismatch`) |
| Parse then store, newest object is current resume | backend/Services/resumePipeline.js:350 `parseResumeBytes`, :360 `saveParsedResume`, :422 `runResumePipeline`; new key name :104 `newResumePath` |
| NLP call and its timeout (30 s default) | resumePipeline.js:265 `callParser`, :37 `NLP_TIMEOUT_MS_DEFAULT`, :40 |
| Unreadable document handling (core) | resumePipeline.js:69 (422 map), :291-293 (nlp 422 -> `ResumePipelineError`); nothing stored (analysis.controller.js:286-291); shown by `frontend/src/pages/candidate/Upload.jsx:47` |
| Unreadable document (nlp-engine, 422) | nlp-engine/app/main.py:232-242; reasons `extractor.py:28-30`, class :41 |

### Assessment

| Question | File:line |
|---|---|
| One attempt limit (default 1) | backend/Services/assessmentService.js:149 `maxAttempts` (env `ASSESSMENT_MAX_ATTEMPTS`); `summariseAttempts` :298; 409 `attempts_used` at assessment.controller.js:640-646 |
| Time limit (15 min default), checked on server | assessmentService.js:182 `timeLimitMinutes`; `deadlineOf` :197; `attemptPhase` :203 |
| Grace period 30 s | assessmentService.js:185 `SUBMIT_GRACE_MS`; used :209 (expired = deadline + grace) |
| Saves refused after deadline | assessment.controller.js:747 (`time_expired`) in `saveAnswers` :722 |
| `started_at` written once at start | assessment.controller.js:658 (atomic update, clock starts); read back `assessmentService.js:173` `startedAtOf` |
| Saving answers | assessment.controller.js:722 `saveAnswers` (`PUT /api/assessment/:id/answers`, Routes/assessment.routes.js:24) |
| Pool preparation after apply | jobs.controller.js:273 -> assessmentService.js:631 `triggerPreparation`, :597 `prepareAssessment`, :497 `runPreparation` |
| Serving 10 of 20 (6 MCQ + 4 short) | assessment-service/app/generator.py:79 `draw_served_questions` (sample at :102); counts `config.py:73-76` (`GENERATED_*` 10 / 10, `SERVED_MCQ` 6, `SERVED_SHORT` 4) |
| Option shuffling | generator.py:31 `_shuffle_mcq_options` (called :343) |
| Option-length rule (correct > 1.25x mean AND >= 10 chars longer) | assessment-service/app/validators.py:33 `mcq_option_tell` (test at :47); limits `config.py:54-55`; applied generator.py:286 |
| Answer-leak check | no check with that name found. Closest: option-length rule above; candidate question allowlist `assessment.controller.js:112` `candidateQuestion`; served key reduced to drawn questions `generator.py:79`; browser-side scan `tests/e2e/lib/network.mjs` |
| Answer key storage (`assessment_keys`) | backend/Services/assessmentService.js:576-577 (insert), :352 `loadPoolQuestions`; table `supabase/migrations/20261103120100_create_assessment_keys.sql:15`; column dropped `20261103120300_drop_assessments_answer_key.sql:31` |
| Candidate-safe result (no correct answers) | assessment.controller.js:287 `candidateResult`; evaluator side `assessment-service/app/evaluator.py:15-19` (docstring), `_mcq_result` :66 |
| Reset / void by recruiter or admin | assessment.controller.js:913 `resetAssessment`, :898 `mayActOnJob`; Routes/assessment.routes.js:25; record `assessmentService.js:239` `voidRecord`, :256 `voidAttempt` |
| Recruiter attempt list | assessment.controller.js:1012 `getAttemptsForRecruiter`, :989 `recruiterAttempt` |
| Grading pending / retry | assessment.controller.js:456 `settleOnRead`, :468 (retry call), :490 `candidateView`; gate `gradingClaim.js:87` `GRADING_RETRY_GATE_MS`, :106 `gradingRetryAllowed` |
| Grading claim (one grader per attempt) | backend/Services/gradingClaim.js:33 `gradeOnce`, :117 `runGrading`; RPC call assessment.controller.js:327; SQL `supabase/migrations/20261103120200_assessment_grading_claim.sql:45`; stale after 10 min `assessment.controller.js:86` |
| Grader prompt marks candidate text untrusted | assessment-service/app/prompts.py:152-157 (`GRADING_SYSTEM_PROMPT`), :169 `build_short_answer_evaluation_prompt`, :202 and :229 |
| Grades only 0 / 0.5 / 1 | assessment-service/app/evaluator.py:41 `ALLOWED_POINTS`, :108 `validate_grades` (check :122) |
| Generation call to the LLM | assessment-service/app/llm_client.py:132 `generate_json`; generator.py:189 `generate_pool`; prompt `prompts.py:35` |
| Evaluate endpoint | assessment-service/app/main.py:97; core `assessment.controller.js:809` `evaluateAssessment` |

### GitHub evidence

| Question | File:line |
|---|---|
| GitHub login taken from the resume link | backend/Services/scoringPipeline.js:167-168 (`parsed.contact?.github`); `githubEvidence.js:51` `normaliseGithubLogin` |
| Ownership not verified | explainability.js:138 (see above) |
| Inactive account -> unavailable | github-evidence/app/scoring.py:85 `compute_subscore`, :101-105 |
| Commit counting window (365 days) | core sends `window_days` githubEvidence.js:18, :119; service `main.py:30`, :183; `metrics.py:13`, :55 `commits_in_window`; fetch `github_client.py:247-249` |
| Sub-score components (activity, consistency, ownership, corroboration; weights .25/.25/.20/.30) | github-evidence/app/scoring.py:23 (weights), :68-84 (component functions) |
| Claims vs skills | github-evidence/app/claims.py:24 `build_claims`; skill-to-language table `skill_languages.py:21` |

### NLP engine (all `nlp-engine/app/`)

| Question | File:line |
|---|---|
| Text extraction (PDF / DOCX / TXT) | extractor.py:274 `extract_document` -> `_read_pdf` :80, `_read_docx` :228, `_read_txt` :258 |
| Skill vocabulary and aliases | ner.py:13 `SKILL_KEYWORDS`, :77 `SKILL_ALIASES`, :132 `CONTEXT_SKILLS`, :212 `GENERIC_SKILL_PATTERNS`, :368 `extract_skills`, :280 `normalize_skill` |
| Similarity model | embedder.py:11 (`all-MiniLM-L6-v2`), :34 `compute_similarity`, :117 `analyse`; blend 0.60 skills / 0.40 semantic :25-26 |
| `/parse` contract | main.py:189 `parse_resume` (multipart `resume`, `jd`, skill lists) |
| `unreadable_document` 422 | main.py:232-242; messages :68 |
| Parser version | main.py:48 (`nlp-engine@2.3.0`) |
| `/skills/vocabulary` | main.py:142 (builder :125); `/skills/extract` :147 |

### Gateway (all `gateway/`)

| Question | File:line |
|---|---|
| Proxy to core | index.js:40 `createCoreProxy`, :105-118 (route choice) |
| Timeouts per route (60 s / generate 310 s / evaluate 130 s) | index.js:34-36 (config), :106-108, :113-114; 504 body :56-62 |
| Rate limits (global 300/min, auth 20 failures/15 min, reset 5/15 min) | limits.js:22 `authLimiter`, :31 `resetLimiter`, :39 `globalLimiter`, :50-51 routing; defaults index.js:23-28 |
| Session pre-check | forwardAuth.js:9 (calls core `/api/auth/session`), :11 `createForwardAuth`, :31 call, :42 503 on failure |
| Public routes | public-routes.js:3 `ALLOWLIST`, :22 `isPublicRoute` |
| CORS | cors.js:6 (only `FRONTEND_URL`, credentials) |
| Security headers | index.js:89 (helmet) |
| Aggregated `/health` | health.js:30 (core, nlp, github-evidence, assessment-service) |
| Request id | requestId.js:10 `requestIdMiddleware` (generates at :12, header :15) |

### Core (`backend/`)

| Question | File:line |
|---|---|
| Bind address and port (127.0.0.1:5001) | backend/index.js:37 (`PORT`), :39 (`HOST`), :91 (`listen`) |
| Session setup, cookie `patina_session` | index.js:46-58 |
| `SESSION_SECRET` length check (>= 32) | index.js:23-33 |
| Login | backend/Controllers/auth.controller.js:326 `login` |
| Session regenerate on login | auth.controller.js:390 |
| `/api/auth/session` | auth.controller.js:117 `session`; Routes/auth.routes.js:20 |
| Role middleware | backend/Middlewares/auth.Middleware.js:5 `requireAuth` (suspension check :31-35), :41 `requireRole` |
| Error handler JSON shape `{error, message, requestId}` | backend/Middlewares/errorHandler.js:96 `shapeErrorBody`, :114 `errorContract`, :123 `notFoundHandler`, :129 `errorHandler` |
| Supabase client and timeout (10 s default) | backend/Config/supabase.js:97 (client), :82 (`SUPABASE_TIMEOUT_MS`), :84 `timeoutFetch`; `internalHttp.js:77` `createTimeoutFetch` |
| Internal HTTP client and its timeouts | backend/Services/internalHttp.js:110 `postJson` (one retry on connection errors); callers: assessmentService.js:54-55 (300 s / 120 s), githubEvidence.js:17 (8 s), resumePipeline.js:37 (30 s) |
| Request id | backend/Middlewares/requestId.js:7 |

### Recruiter, notifications, admin

| Question | File:line |
|---|---|
| Recruiter applications list | Routes/analysis.routes.js:20 -> analysis.controller.js:706 `listRecruiterApplications` (ranking :689-694) |
| Drill-down data for one application | analysis.routes.js:21 -> analysis.controller.js:844 `getRecruiterApplication` (`loadRecruiterDetail` :796); UI `frontend/src/components/recruiter/CandidateModal.jsx:514` |
| Shortlist / reject | Routes/jobs.routes.js:19 `POST /api/jobs/applications/shortlist` -> jobs.controller.js:344 `shortlistCandidate` (statuses `shortlisted`, `rejected`) |
| Resume signed link (60 s) | Routes/analysis.routes.js:24 -> analysis.controller.js:192 `getCandidateResume`, signed URL :273 |
| Notifications | Routes/notification.routes.js:11 (list), :21 (mark read); controller `notification.controller.js:13` `sendNotification`, :30, :54 |
| Admin | Routes/admin.routes.js:7-10; admin.controller.js:16 `getOverview`, :56 `getUsers`, :77 `updateSuspension` |

## 2. gateway/ (Express reverse proxy, port 5000)

| File | Lines | What it holds |
|---|---|---|
| index.js | 134 | `loadConfig` :13 (env names and defaults), `createCoreProxy` :40, `createApp` :77 (order: request id, helmet :89, CORS :92, health :95, limits :98, forward-auth :101, proxy :105, static, 404) |
| cors.js | 8 | `mountCors` :3 |
| forwardAuth.js | 59 | `createForwardAuth` :11, `checkAuth` :49 (2 s timeout) |
| health.js | 46 | `check` :4, `mountHealth` :23, `GET /health` :30 |
| limits.js | 56 | `mountLimits` :14 |
| public-routes.js | 31 | `ALLOWLIST` :3, `normalizePath` :16, `isPublicRoute` :22 |
| requestId.js | 92 | `requestIdMiddleware` :10, `errorContract` :62, `notFoundHandler` :76, `errorHandler` :82 |
| static.js | 20 | `mountStatic` :5 (serves `FRONTEND_BUILD_DIR` when set) |

Gateway has no route table of its own: everything under `/api` goes to core; only `/health` is answered locally.

## 3. backend/ ("core", Express, port 5001)

Mounts (index.js): `/api/auth` :62, `/api/jobs` :63, `/api/skills` :65, `/api` (analysis) :71, `/api/admin` :73, `/api/notifications` :74, `/api/assessment` :78, `GET /api/health` :81, 404 :85, error handler :86.

### Routes (METHOD path -> middleware -> controller)

| Route file:line | Method path | Middleware | Controller (file:line) |
|---|---|---|---|
| auth.routes.js:16 | POST /api/auth/signup | none | auth.controller.js:260 `signup` |
| :17 | POST /api/auth/login | none | :326 `login` |
| :18 | GET /api/auth/me | requireAuth | :101 `me` |
| :20 | GET /api/auth/session | none | :117 `session` |
| :21 | POST /api/auth/logout | none | :125 `logout` |
| :22 | POST /api/auth/resend-confirmation | none | :133 `resendConfirmation` |
| :23 | POST /api/auth/request-password-reset | none | :163 `requestPasswordReset` |
| :24 | POST /api/auth/reset-password | none | :212 `resetPassword` |
| jobs.routes.js:15 | GET /api/jobs | requireRole CANDIDATE, RECRUITER, ADMIN | jobs.controller.js:26 `getAllJobs` |
| :16 | GET /api/jobs/mine | RECRUITER | :40 `getMyJobs` |
| :17 | POST /api/jobs | RECRUITER | :67 `createJob` |
| :18 | GET /api/jobs/my-applications | CANDIDATE | :279 `getMyApplications` |
| :19 | POST /api/jobs/applications/shortlist | RECRUITER | :344 `shortlistCandidate` |
| :21 | GET /api/jobs/:id | CANDIDATE, RECRUITER, ADMIN | :105 `getJobById` |
| :22 | POST /api/jobs/:id/apply | CANDIDATE | :195 `applyToJob` |
| analysis.routes.js:17 | GET /api/candidate-analysis | CANDIDATE | analysis.controller.js:507 `getCandidateAnalysis` |
| :20 | GET /api/recruiter/applications | RECRUITER | :706 `listRecruiterApplications` |
| :21 | GET /api/recruiter/applications/:id | RECRUITER | :844 `getRecruiterApplication` |
| :22 | GET /api/resume/status | CANDIDATE | :127 `getMyResumeStatus` |
| :23 | POST /api/resume/upload | CANDIDATE | :298 `uploadResume` |
| :24 | GET /api/resume/candidate/:candidateId | RECRUITER | :192 `getCandidateResume` |
| :26 | POST /api/applications/:id/score | CANDIDATE, RECRUITER | :397 `rescoreApplication` |
| :28 | GET /api/applications/:id/result | CANDIDATE | :450 `getApplicationResult` |
| assessment.routes.js:17 | GET /api/assessment/status | CANDIDATE | assessment.controller.js:544 `getAssessmentStatus` |
| :18 | POST /api/assessment/start | CANDIDATE | :612 `startAssessment` |
| :21 | POST /api/assessment/generate | CANDIDATE | :705 `generateAssessment` (alias of `startAssessment`) |
| :22 | POST /api/assessment/evaluate | CANDIDATE | :809 `evaluateAssessment` |
| :24 | PUT /api/assessment/:id/answers | CANDIDATE | :722 `saveAnswers` |
| :25 | POST /api/assessment/:id/reset | RECRUITER, ADMIN | :913 `resetAssessment` |
| :26 | GET /api/assessment/attempts | RECRUITER, ADMIN | :1012 `getAttemptsForRecruiter` |
| notification.routes.js:11 | GET /api/notifications | requireAuth | inline handler -> notification.controller.js:30 `getNotifications` |
| :21 | POST /api/notifications/:id/read | requireAuth | inline handler -> :54 `markNotificationRead` |
| skills.routes.js:8 | GET /api/skills | RECRUITER | skills.controller.js:152 `searchSkills` |
| :9 | POST /api/skills/extract | RECRUITER | :175 `extractSkills` |
| admin.routes.js:7 | all /api/admin/* | requireRole ADMIN | (router-level) |
| :8 | GET /api/admin/overview | ADMIN | admin.controller.js:16 `getOverview` |
| :9 | GET /api/admin/users | ADMIN | :56 `getUsers` |
| :10 | PATCH /api/admin/users/:userId/suspension | ADMIN | :77 `updateSuspension` |

### Files

| File | Lines | What it holds |
|---|---|---|
| index.js | 139 | secret check :23-33, middleware order :41-58, route mounts :62-81, listen :91 |
| Config/supabase.js | 122 | env file load :12, service-role client :97, timeout fetch :84, `probeDatabase` :113, `configuredSessionSecret` :28 |
| Config/supabaseAuth.js | 35 | `getSupabaseAuth` :22 (anon-key client for login) |
| Config/uploadLimits.js | 4 | `MAX_RESUME_BYTES` :4 |
| Controllers/auth.controller.js | 396 | handlers listed above; `createUserScopedClient` :25, `AUTH_ERRORS` :38, `formatProfile` :56 |
| Controllers/jobs.controller.js | 405 | job CRUD, `sendExistingApplication` :152, apply :195, my applications :279, shortlist :344 |
| Controllers/analysis.controller.js | 911 | resume status :127, recruiter resume link :192, upload :298, rescore :397, application result :450, candidate analysis :507, recruiter list :706, detail :844 |
| Controllers/assessment.controller.js | 1034 | `candidateQuestion` :112, `candidateResult` :287, `gradeSubmitted` :322, `settleOnRead` :456, `candidateView` :490, handlers above, `recruiterAttempt` :989 |
| Controllers/admin.controller.js | 102 | overview, users, suspension |
| Controllers/notification.controller.js | 65 | `sendNotification` :13, `getNotifications` :30, `markNotificationRead` :54 |
| Controllers/skills.controller.js | 199 | `searchVocabulary` :67, `getSkillVocabulary` :139 (cached copy of nlp `/skills/vocabulary`), search :152, extract :175 |
| Middlewares/auth.Middleware.js | 48 | `requireAuth` :5, `requireRole` :41 |
| Middlewares/errorHandler.js | 190 | error contract (see section 1), `sendError` :88, `markDatabaseTimeout` :28, `createHealthHandler` :165 |
| Middlewares/requestId.js | 19 | `requestIdMiddleware` :7 |
| Middlewares/resumeUpload.js | 92 | multer :22, `RESUME_TYPES` :45, `requireResumeFile` :75 |
| Services/scoringPipeline.js | 235 | `scoreApplication` :124, `findScoringAssessment` :79, `scoringSummary` :68 |
| Services/explainability.js | 1176 | see section 1; `buildParsingSubScore` :275, `buildGithubSubScore` :483, `buildAssessmentSubScore` :609, `UNPROCTORED_NOTE` :584 |
| Services/resumePipeline.js | 441 | `listStoredResumes` :118, `findStoredResume` :205, `callParser` :265, `collectProjectLinks` :326, parse/save/run :350/:360/:422 |
| Services/assessmentService.js | 637 | attempt policy :149-317, preparation :383-637 (`runPreparation` :497, `prepareAssessment` :597), clients `generateAssessment` :59, `evaluateAnswers` :62 |
| Services/gradingClaim.js | 151 | `gradeOnce` :33, `gradingRetryAllowed` :106, `runGrading` :117 |
| Services/githubEvidence.js | 132 | `REASON_CODES` :21, `normaliseGithubLogin` :51, `fetchGithubEvidence` :103 |
| Services/internalHttp.js | 157 | `resolveRequestId` :18, `InternalHttpError` :23, `createTimeoutFetch` :77, `postJson` :110 |
| Services/applicantIdentity.js | 52 | `loadApplicantIdentities` :22 (names and emails for recruiter list) |
| Services/skillNames.js | 69 | `skillKey` :34, `sameSkill` :41, `skillIndex` :52 |
| Services/signupProfile.js | 39 | `ensureProfileOrRollback` :14 |
| Services/validation.js | 7 | `isUuid` :7 |

## 4. nlp-engine/ (FastAPI, port 8000)

| Endpoint | Line |
|---|---|
| GET / (health) | app/main.py:101 |
| GET /skills/vocabulary | app/main.py:142 |
| POST /skills/extract | app/main.py:147 |
| POST /parse | app/main.py:189 (422 `unreadable_document` :238; invalid-request handler :88) |

| File | Lines | What it holds |
|---|---|---|
| app/main.py | 295 | `PARSER_VERSION` :48, `RAW_TEXT_LIMIT` :52, request id middleware :75, endpoints above, `_parse_skill_list` :167 |
| app/extractor.py | 309 | `extract_document` :274, `extract_text` :289, `extract_links` :294, readers :80/:228/:258, error classes :33/:41 |
| app/preprocessor.py | 66 | `preprocess` :9 |
| app/ner.py | 1151 | skill vocabulary :13-235, `extract_skills` :368, `split_sections` :681, `_extract_experience` :790, `_extract_education` :830, `_extract_projects` :872, `_candidate_name` :975, `extract_entities` :1033 |
| app/embedder.py | 204 | model :11, `compute_similarity` :34, `_match_level` :76, `analyse` :117 |
| app/__main__.py | 20 | `main` :13 (env `NLP_HOST`, `NLP_PORT`) |

## 5. github-evidence/ (FastAPI, port 8001)

| Endpoint | Line |
|---|---|
| GET /health | app/main.py:172 |
| POST /v1/evidence | app/main.py:179 (body `EvidenceRequest` contract.py:46) |

| File | Lines | What it holds |
|---|---|---|
| app/main.py | 203 | `build_evidence` :48, `create_app` :128, request id :143, error handlers :163-167, `.env` load :202 |
| app/github_client.py | 321 | `GitHubClient` :121, `fetch` :129, `_profile` :179, `_repos` :186, `_details` :208, `_commits` :247, `RateLimitState` :68, `MAX_COMMIT_PAGES` :28 |
| app/metrics.py | 69 | `DEFAULT_WINDOW_DAYS` :13, `is_owned` :32, `language_breakdown` :43, `commits_in_window` :55, `weekly_buckets` :61 |
| app/scoring.py | 126 | `DEFAULT_WEIGHTS` :23, component functions :68-83, `compute_subscore` :85 |
| app/claims.py | 55 | `build_claims` :24 |
| app/skill_languages.py | 62 | alias table :21, `language_for` :60 |
| app/contract.py | 155 | `CONTRACT_VERSION` :7, `ERRORS` :29, models :46-142 |
| app/config.py | 76 | `Settings` :46 (`from_env` :61) |
| tools/record_github.py | 143 | records GitHub responses for the test suite |

## 6. assessment-service/ (FastAPI, port 8002, no browser access)

| Endpoint | Line |
|---|---|
| GET / (health) | app/main.py:49 |
| POST /generate-assessment | app/main.py:59 |
| POST /evaluate-assessment | app/main.py:97 |

| File | Lines | What it holds |
|---|---|---|
| app/main.py | 122 | request id :38, endpoints above |
| app/generator.py | 352 | `_shuffle_mcq_options` :31, `draw_served_questions` :79, `generate_pool` :189, `generate_assessment` :327 |
| app/validators.py | 309 | `mcq_option_tell` :33, `option_tell_violations` :56, `validate_assessment` :83 |
| app/evaluator.py | 278 | `ALLOWED_POINTS` :41, `_mcq_result` :66, `validate_grades` :108, `_grade_short_answers` :139, `evaluate_assessment` :182 |
| app/prompts.py | 231 | `PROMPT_VERSION` :11, `build_generation_prompt` :35, `GRADING_PROMPT_VERSION` :150, grading prompt :152-169 |
| app/llm_client.py | 208 | Gemini calls: `_complete` :71, `generate_json` :132, errors :39-56 |
| app/schemas.py | 149 | pydantic models: input :13, questions :31-62, key :73-85, evaluate :91-149 |
| app/config.py | 96 | env settings (names in section 11), `llm_configured` :94 |
| app/__main__.py | 13 | `python -m app` runs uvicorn on the configured bind |

## 7. frontend/src/ (React, port 3000)

Route table (`App.jsx`, 94 lines):

| Path | Page component | Guard |
|---|---|---|
| / | Landing (pages/public) | none |
| /select-role | RoleSelection | none |
| /login, /signup | Login | none |
| /login/:role, /signup/:role | redirect | none |
| /email-confirmed | EmailConfirmed | none |
| /reset-password | ResetPassword | none |
| /admin/dashboard | admin/Dashboard | `RequireRole role="ADMIN"` |
| /candidate/upload | candidate/Upload | CANDIDATE |
| /candidate (layout CandidateLayout) | dashboard Dashboard; results, results/:applicationId Results; jobs CandidateJobs; jobs/:id JobDetail; profile CandidateProfile; notifications Notifications; assessment Assessment | CANDIDATE (on the layout) |
| /recruiter (layout RecruiterLayout) | profile Profile; dashboard Dashboard; applications Applications; candidates (redirects to applications); jobs Jobs; jobs/:id JobDetails; create-job CreateJob | RECRUITER (on the layout) |
| * | NotFound | none |

Guard: `components/auth/RequireRole.jsx:6`. Auth state: `context/AuthContext.jsx:7` `AuthProvider`, :81 `useAuth`; `context/sessionCheck.js:15` `checkSession`.

| File | Lines | What it holds |
|---|---|---|
| lib/api.js | 239 | `API_BASE_URL` :43 (default `http://localhost:5000`), `ApiError` :49, `request` :91, `pollServerState` :197, `api` object :230 |
| lib/education.js | 38 | `educationLine` :19 |
| components/ScoreBadge.jsx | 142 | `bandTone` :32, `VerificationBadge` :78, `weightsVersionLabel` :116, `AWAITING_ASSESSMENT` :127, `partialScoreLabel` :134 |
| components/Badge.jsx, Button.jsx, EmptyState.jsx, Spinner.jsx | 152, 75, 45, 56 | UI primitives |
| components/layouts/CandidateLayout.jsx, RecruiterLayout.jsx | 101, 107 | navigation shells |
| components/assessment/assessmentLogic.js | 217 | clock anchor :62, `shouldAutoSubmit` :79, `answersPayload` :122, `candidateResultView` :154, `saveErrorAction` :206 |
| components/assessment/AppliedJobPicker.jsx, QuestionCard.jsx, ResultView.jsx | 90, 79, 100 | job picker, one question, result display |
| components/recruiter/ApplicationsTable.jsx | 447 | `useApplications` :42, `ScoreCell` :101, `DecisionButtons` :219, table :324 |
| components/recruiter/CandidateModal.jsx | 618 | drill-down modal :514, `ResetForm` :146, `Detail` :262 |
| components/recruiter/ScoreBreakdown.jsx | 539 | `skillStatusView` :55, `sourcesDisagreeView` :176, `FlagsPanel` :194, `SkillEvidenceTable` :391, `ScoreBreakdown` :441 |
| components/recruiter/applicationsLogic.js | 239 | status text :44, assessment state text :108, `resettableAttempt` :164, `scoringFailureText` :194 |
| pages/candidate/Upload.jsx | 562 | `unreadableDetail` :47, `ParsedSummary` :104, page :200 |
| pages/candidate/Results.jsx | 503 | `nextVerificationStep` :93, `showGithubOwnershipNote` :131, `ApplicationResult` :257 |
| pages/candidate/Assessment.jsx | 723 | `AssessmentForJob` :58 (timer, autosave, submit) |
| pages/candidate/JobDetail.jsx, Dashboard.jsx, CandidateJobs.jsx, CandidateProfile.jsx, Notifications.jsx, applicationState.jsx | 445, 240, 87, 67, 166, 160 | job apply and scoring state :31/:93, dashboard :104, lists; `ScoreAgainButton` applicationState.jsx:89 |
| pages/public/Login.jsx | 460 | `buildSignupPayload` :29, `Login` :147 |
| pages/public/Landing, RoleSelection, ResetPassword, EmailConfirmed, NotFound | 271, 100, 255, 26, 27 | public pages |
| pages/recruiter/CreateJob.jsx | 631 | skill search `normaliseTypedSkill` :35 |
| pages/recruiter/Dashboard, Jobs, JobDetails, Profile, Applications | 187, 159, 143, 93, 29 | recruiter pages |
| pages/admin/Dashboard.jsx | 157 | `AdminDashboard` :20 |
| index.js, index.css | 10, 441 | entry, styles |

Frontend tests (Jest, `npm test` in `frontend/`): `components/assessment/assessmentLogic.test.js` (clock, polling, answers payload), `components/recruiter/applicationsLogic.test.js` (status filter, text helpers), `components/recruiter/scoreWeights.test.jsx` (score badge helpers, weights label), `components/recruiter/skillStatus.test.js` (skill status badges), `context/sessionCheck.test.js` (what `/api/auth/me` answers mean), `lib/api.test.js` (request wrapper), `lib/education.test.js`, `pages/candidate/Results.test.jsx` (results text rules), `pages/candidate/Upload.test.jsx` (parsed summary), `pages/public/Login.test.jsx` (signup payload), `pages/recruiter/CreateJob.test.jsx` (skill search input).

## 8. supabase/migrations/

| File | Lines | Creates or changes |
|---|---|---|
| 20260823000000_create_profiles.sql | 95 | enum `patina_user_role`, table `profiles`, unique lowercase username index, `handle_new_user` + trigger, `set_updated_at`, RLS + policy "Users can read their own profile" |
| 20260830000000_create_jobs_and_applications.sql | 121 | enums `job_status`, `application_status`; tables `jobs`, `applications`; indexes; RLS policies (published jobs, recruiter manage, candidate read/create own applications, recruiter read/update) |
| 20260831000000_add_single_admin_role.sql | 19 | adds enum value `admin` |
| 20260831000100_add_single_admin_index.sql | 8 | unique index `profiles_single_admin_role` |
| 20260901000000_add_profile_suspension.sql | 7 | `profiles` suspension column + index |
| 20260903000000_create_notifications.sql | 36 | table `notifications`, indexes, RLS (read own, recruiter insert) |
| 20260903000100_create_resumes_and_scores.sql | 100 | storage bucket `resumes`, tables `resumes`, `scores`, indexes, RLS (candidate and recruiter read) |
| 20261015004738_create_assessments.sql | 62 | table `assessments`, unique open/completed indexes, RLS (candidate and recruiter read) |
| 20261015034725_allow_five_assessment_attempts.sql | 5 | drops `assessments_candidate_job_completed_idx` |
| 20261103120000_restrict_signup_role.sql | 71 | `assert_signup_role` (service_role only), replaces `handle_new_user` |
| 20261103120100_create_assessment_keys.sql | 45 | table `assessment_keys` (RLS on, no policy, revoked from anon/authenticated), copies existing keys, `answer_key` nullable |
| 20261103120200_assessment_grading_claim.sql | 66 | `assessments.grading_started_at`, new status check, new open index, function `claim_assessment_for_grading` (service_role only) |
| 20261103120300_drop_assessments_answer_key.sql | 31 | copies keys, drops `assessments.answer_key` |
| 20261104120000_resumes_bucket_limits.sql | 18 | updates `storage.buckets` size cap and MIME list for `resumes` |
| 20261104120100_scores_subscores_comment.sql | 8 | comment on `scores.subscores` |
| 20261104120200_function_bodies_lf.sql | 90 | re-creates `set_updated_at`, `assert_signup_role`, `handle_new_user`, `claim_assessment_for_grading` (line endings) |
| 20261104120300_applicant_emails.sql | 29 | function `applicant_emails` (service_role only) |
| config.toml | 416 | local Supabase CLI config |

## 9. scripts/

| File | Lines | What it holds |
|---|---|---|
| start-all.ps1 | 333 | service table :47-75, listener check :77, warm-up parse `Invoke-WarmParse` :107, refuse-if-busy check :183, start :225, report :300; PIDs written to `tests\.out\start-all\pids.json` |
| stop-all.ps1 | 108 | stops only the PIDs start-all recorded |

## 10. eval/

| File | Lines | What it holds |
|---|---|---|
| run_parsing_eval.py | 680 | parsing evaluation against `POST /parse`: `read_labels` :66, `NlpClient` :212, `evaluate` :295, `render_section` :384, `main` :592 |
| parsing_metrics.py | 249 | pure metrics: `compare_skills` :98, `micro_prf` :126, `macro_prf` :139, `contact_accuracy` :203 |
| mcq_option_report.py | 258 | live MCQ option report: `longest_option_stats` :73, `run_live` :121, `main` :236 |
| aliases.json, out_of_scope_terms.json, vocabulary_frozen.json | 62, 52, 857 | frozen inputs |
| smoke/gold.csv | 7 | labels for synthetic fixtures |
| labels/ | (untracked) | gold labels, not listed |
| LABELLING_GUIDE.md, README.md, RESULTS.md | 126, 28, 352 | docs and recorded runs |

## 11. tests/

Suites of `tests/run-suite.ps1` (`-Suites`, ValidateSet at :56): `nlp` (pytest `tests/nlp`, :175), `backend` (:182), `gateway` (:223), `docs` (`tests/docs/check-trackers.mjs`, :236), `github` (pytest `tests/github` in github-evidence venv, :244), `assessment` (pytest `tests/assessment` in assessment-service venv, :261), `e2e` (Playwright, :275; run alone), `frontend` (`npm run build`, :293). `-Target baseline|current` is required except for e2e.

| File | Lines | Covers |
|---|---|---|
| run-suite.ps1 | 308 | the runner |
| backend/applicant-identity.test.mjs | 98 | applicant name and email lookup |
| backend/apply-scoring-throws.test.mjs | 127 | apply still 201 when scoring or preparation throws |
| backend/assessment-evaluate-live.test.mjs | 56 | evaluate input validation (live) |
| backend/assessment-generate.smoke.mjs | 62 | assessment routes exist and are session-guarded |
| backend/assessment-orchestration.test.mjs | 897 | start, status, preparation, retries, error text |
| backend/assessment-service-client.test.mjs | 175 | client to assessment-service, timeouts |
| backend/assessment-time-reset.test.mjs | 728 | deadline, grace, save/submit, reset |
| backend/auth-session.test.mjs | 322 | session endpoint, login fixation, username matching |
| backend/backend-cruft.test.mjs | 22 | removed files stay removed |
| backend/candidate-results.test.mjs | 292 | candidate result for one application |
| backend/error-contract.test.mjs | 339 | JSON error shape and request id |
| backend/explainability.test.mjs | 773 | weights, verification, cap, bands, skill table, flags |
| backend/github-evidence-client.test.mjs | 206 | link normalising, service outcomes |
| backend/grading-claim.test.mjs | 94 | grade-once claim and release |
| backend/live-analysis-isolation.test.mjs | 95 | one candidate cannot read another's analysis |
| backend/live-analyze-github.test.mjs | 162 | GitHub folded into the score |
| backend/live-analyze.test.mjs | 125 | apply and score again, new row each time |
| backend/live-answer-key-access.test.mjs | 99 | answer key not readable by candidate or recruiter |
| backend/live-applicants.test.mjs | 153 | recruiter list emails, per-recruiter isolation |
| backend/live-auth-failclosed.test.mjs | 79 | missing profile row gives 401 |
| backend/live-evaluate-once.test.mjs | 108 | concurrent submits grade once |
| backend/live-evaluate-release.test.mjs | 57 | claim released on grading failure |
| backend/live-notifications-authz.test.mjs | 93 | notification authorization |
| backend/live-resume-authz.test.mjs | 88 | resume link authorization |
| backend/live-shortlist-authz.test.mjs | 177 | shortlist and reject authorization |
| backend/live-signup-role.test.mjs | 122 | `assert_signup_role` |
| backend/live-upload-gates.test.mjs | 96 | upload size and type gates |
| backend/migration-guards.test.mjs | 187 | migration naming and rules |
| backend/recruiter-applications.test.mjs | 576 | recruiter list scope, shape, ordering |
| backend/resume-current-on-apply.test.mjs | 516 | newest resume is the one scored |
| backend/resume-links.test.mjs | 152 | stored links and education reach the response |
| backend/resume-pipeline.test.mjs | 671 | upload, parse, store, errors |
| backend/score-on-apply.test.mjs | 679 | apply scoring, score again, degraded sources |
| backend/signup-profile.test.mjs | 85 | profile rollback on signup |
| backend/skills-api.test.mjs | 274 | skill search and extract API |
| backend/smoke.test.mjs | 118 | health, error shape |
| backend/upload-limits.test.mjs | 68 | 10 MB limit, wrong field |
| backend/lib/{assessment,env,session,stub-server,supabase-stub,testdb}.mjs | 178, 41, 32, 87, 199, 264 | helpers (seed attempts, env reader, login, stub HTTP server, in-memory Supabase, service-role test DB) |
| backend/sweep.mjs, purge-orphan-resume-files.mjs, repair-test-accounts.mjs | 37, 97, 130 | owner-run clean-up and repair scripts |
| gateway/auth-limits.test.mjs | 108 | login and reset rate limits |
| gateway/auth-routing.test.mjs | 127 | public allowlist, forward-auth |
| gateway/edge.test.mjs | 102 | aggregated health, CORS, limits |
| gateway/error-contract.test.mjs | 203 | 502 / 504 JSON bodies, default core URL |
| gateway/live-gateway.test.mjs | 23 | live gateway checks |
| gateway/skills-routing.test.mjs | 57 | skills routes not public, passed unchanged |
| gateway/slow-core-timeout.test.mjs | 96 | proxy timeouts with a slow core |
| nlp/conftest.py, test_contact_determinism.py, test_model_load.py | 62, 76, 44 | fixtures; contact fields under hash seeds; model load |
| nlp/test_parse.py, test_parse_contract.py | 122, 213 | parse fixtures vs snapshots; `/parse` contract incl. unreadable files |
| nlp/test_r21_skills.py, test_r30_parsing.py, test_r32_skills_api.py | 228, 266, 143 | skill vocabulary rules; names, links, text extraction; vocabulary API |
| github/conftest.py, test_client.py, test_metrics.py, test_scoring.py, test_service.py | 131, 218, 497, 181, 441 | recorded-response fixtures; client; metrics; sub-score formula and inactive account; service endpoints |
| assessment/conftest.py, test_generation.py, test_grading.py, test_internal_only.py, test_option_rule.py, test_request_id.py | 35, 417, 309, 59, 338, 31 | fixtures; 6+4 from 20 draw and key mapping; grading; loopback bind, docs off; option-length rule; request id |
| eval/test_metrics.py | 154 | `eval/parsing_metrics.py` |
| docs/check-trackers.mjs | 285 | CHECKLIST/AUDIT drift check |
| arch/nlp-outage-probe.mjs | 430 | prints behaviour with NLP down or hung (no asserts) |
| e2e/spine.spec.mjs | 617 | recruiter and candidate flow through the browser |
| e2e/signup.spec.mjs, smoke.spec.mjs, unreadable.spec.mjs | 57, 24, 52 | sign-up form; landing and login load; unreadable résumé shown |
| e2e/lib/{auth,diagnostics,env,leftovers,network,pages,provider,stack}.mjs, network.test.mjs | 85, 32, 36, 73, 96, 101, 36, 24, 72 | login helper, page diagnostics, env, leftover rows, API response capture and key-field scan, page helpers, provider-failure note, stack probe, scan unit test |
| e2e/global-setup.mjs, global-teardown.mjs, shot.mjs, playwright.config.mjs | 15, 10, 145, 46 | stack check, leftover report, screenshot tool, config |
| README.md, MANUAL_SMOKE.md, BASELINE_RESULTS.md | 257, 164, 200 | test docs |

## 12. Environment variable names (names only; no `.env` opened)

| Name | Read at | Purpose |
|---|---|---|
| PORT, HOST | backend/index.js:37, :39 | core bind |
| NODE_ENV | backend/index.js:53 | secure cookie in production |
| SESSION_SECRET | backend/Config/supabase.js:19, :26 | session signing key |
| BACKEND_ENV_FILE | backend/Config/supabase.js:12 | alternate env file for tests |
| SUPABASE_URL | backend/Config/supabase.js:30, supabaseAuth.js:25, auth.controller.js:30, admin.controller.js:45 | Supabase project |
| SUPABASE_SERVICE_ROLE_KEY | backend/Config/supabase.js:31 | service client |
| SUPABASE_ANON_KEY | backend/Config/supabaseAuth.js:26, auth.controller.js:26 | login client |
| SUPABASE_TIMEOUT_MS | backend/Config/supabase.js:82 | database call timeout |
| FRONTEND_URL | backend/Controllers/auth.controller.js:10; gateway/index.js:21 | reset redirect; CORS origin |
| NLP_PARSE_URL | backend/Services/resumePipeline.js:39; skills.controller.js:31 | nlp-engine `/parse` |
| NLP_PARSE_TIMEOUT_MS | backend/Services/resumePipeline.js:41 | parse timeout |
| NLP_SKILLS_TIMEOUT_MS | backend/Controllers/skills.controller.js:36 | skills timeout |
| SKILLS_VOCABULARY_TTL_MS | backend/Controllers/skills.controller.js:140 | vocabulary cache time |
| GITHUB_EVIDENCE_URL | backend/Services/githubEvidence.js:61; gateway/index.js:19 | service address |
| GITHUB_EVIDENCE_TIMEOUT_MS | backend/Services/githubEvidence.js:62 | call timeout |
| ASSESSMENT_SERVICE_URL | backend/Services/assessmentService.js:57 | service address |
| ASSESSMENT_MAX_ATTEMPTS | backend/Services/assessmentService.js:149 | attempt limit |
| ASSESSMENT_PREPARE_RETRIES | backend/Services/assessmentService.js:150 | pool preparation retries |
| ASSESSMENT_PREPARE_ON_APPLY | backend/Services/assessmentService.js:158 | prepare pool after apply |
| ASSESSMENT_TIME_LIMIT_MINUTES | backend/Services/assessmentService.js:182 | time limit |
| CREDIBILITY_WEIGHTS | backend/Services/explainability.js:193 | weight override |
| FLAG_DISAGREE_MIN_POINTS, FLAG_DISAGREE_MAX_SHARE | backend/Services/explainability.js:899, :900 | sources-disagree thresholds |
| PORT, CORE_URL, NLP_URL, ASSESSMENT_URL, FRONTEND_BUILD_DIR | gateway/index.js:15-22 | gateway bind and targets |
| GLOBAL/AUTH/PASSWORD_RESET_RATE_LIMIT_MAX and _WINDOW_MS (six names) | gateway/index.js:23-28 | rate limits |
| PROXY_TIMEOUT_MS, PROXY_TIMEOUT_GENERATE_MS, PROXY_TIMEOUT_EVALUATE_MS | gateway/index.js:34-36 | proxy timeouts |
| REACT_APP_API_BASE_URL | frontend/src/lib/api.js:43 | API base (default gateway) |
| NLP_HOST, NLP_PORT | nlp-engine/app/__main__.py:14-15 | nlp bind |
| GITHUB_TOKEN | github-evidence/app/config.py:62 | GitHub API token |
| GITHUB_API_URL | github-evidence/app/config.py:65 | API base |
| GITHUB_MAX_REPOS, GITHUB_HTTP_TIMEOUT_S, GITHUB_DEADLINE_S, GITHUB_MIN_REMAINING, GITHUB_DETAIL_REPOS, GITHUB_CONCURRENCY | github-evidence/app/config.py:69-74 | fetch limits |
| GITHUB_SUBSCORE_WEIGHTS | github-evidence/app/config.py:75 | component weight override |
| GEMINI_API_KEY | assessment-service/app/config.py:22 | LLM key |
| GEMINI_BASE_URL, GEMINI_MODELS | assessment-service/app/config.py:24, :34 | LLM endpoint and model list |
| ASSESSMENT_GENERATION_BUDGET_SECONDS, ASSESSMENT_REQUEST_TIMEOUT_SECONDS | assessment-service/app/config.py:43-44 | generation time |
| ASSESSMENT_MAX_VALIDATION_ROUNDS | assessment-service/app/config.py:48 | regeneration rounds |
| ASSESSMENT_MCQ_MAX_LENGTH_RATIO, ASSESSMENT_MCQ_MIN_LENGTH_GAP | assessment-service/app/config.py:54-55 | option-length rule |
| ASSESSMENT_SERVED_MCQ, ASSESSMENT_SERVED_SHORT | assessment-service/app/config.py:75-76 | questions served |
| ASSESSMENT_HOST, ASSESSMENT_PORT | assessment-service/app/config.py:88-89 | bind |
| TEST_CANDIDATE/RECRUITER(2)_USERNAME/PASSWORD | tests/.env.example | live test accounts (read by tests/backend/lib/env.mjs) |
| PYTHONHASHSEED, HF_HUB_OFFLINE, TRANSFORMERS_OFFLINE | scripts/start-all.ps1:51 | set for nlp-engine at start |

## 13. Dead or unreferenced code

Verified by grep on 2026-11-14 (`git grep -w` over the repo, excluding Docs/archive and `*.md`):

- `nlp-engine/app/embedder.py:29` `get_embedding`: no caller anywhere.
- `nlp-engine/app/extractor.py:300` `extract_from_pdf`, `:304` `extract_from_docx`, `:308` `extract_from_txt`: no caller anywhere (the service uses `extract_document`).
- JS files: every non-test file under `backend/`, `gateway/`, `frontend/src/` has a reference to its file name from another file; none unreferenced.
- JS exports with no importer in any other file (each still used inside its own file or only exported): `SCORED_FILE_UNAVAILABLE_NOTE`, `NO_APPLICATION_NOTE` (analysis.controller.js); `aliasMap`, `searchVocabulary`, `getSkillVocabulary` (skills.controller.js); `currentRequestContext`, `DATABASE_TIMEOUT`, `describeError` (errorHandler.js); `resumeExtension`, `resumeBytesMatch`, `UNSUPPORTED_RESUME_MESSAGE` (resumeUpload.js); `SUBMIT_GRACE_MS`, `prepareRetries`, `UNAVAILABLE_RETRIGGER_MS`, `failureIsStale` (assessmentService.js); `partlyVerifiedCap`, `aggregate`, `verificationNote`, `unavailableSubScore`, `SOURCE_MARK`, `SUBSCORE_LABELS`, `buildAssessmentSubScore` and others (explainability.js); `GRADING_RETRY_GATE_MS` (gradingClaim.js); `PIPELINE_MESSAGES`, `RESUME_DISPLAY_STEM`, `STALE_DOWNLOAD_RETRY_DELAYS_MS` (resumePipeline.js); `SCREEN_FOR_STATE`, `PREPARING_POLL_MS`, `GRADING_POLL_MS`, `UNAVAILABLE_POLL_DEFAULT_MS` (assessmentLogic.js); `WRITTEN_STATUSES`; `SIGNED_OUT_STATUSES`; `nextVerificationStep` (Results.jsx); `SEARCH_DEBOUNCE_MS`, `SkillPicker` (CreateJob.jsx). Not dead; the `export` is not used by another file.
- Comment that contradicts the code: `backend/index.js:96` prints an endpoint list including `POST /api/analyze` and `GET /api/candidates`; no route with those paths exists in `backend/Routes/`.
