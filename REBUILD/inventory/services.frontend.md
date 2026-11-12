# Inventory: frontend (`frontend/`)

Auditor: patina-auditor (Phase 1). Date: 2026-11-12. Branch `rebuild/fable`, HEAD `6da8d3f` (working tree as found).
Scope: `frontend/` (tracked: 37 source files under `src/`, 8,033 lines incl. CSS and config), plus the backend and gateway lines needed to check the frontend's contracts.

Labels: **VERIFIED** = I ran it. **READ** = I read the code. **UNKNOWN** = not established.
`.env` values are never reproduced. Only variable names appear here.

---

## 0. Commands I ran (VERIFIED evidence base)

| # | Command | Result |
|---|---|---|
| V1 | `BUILD_PATH=<scratchpad>/fe-build CI=false npx react-scripts build` in `frontend/` | **Compiles with warnings.** 9 ESLint `no-unused-vars`: `CandidateLayout.jsx:10` `navigate`; `RecruiterLayout.jsx:8` `navigate`; `AllCandidates.jsx:4` `Filter`, `ExternalLink`; `CreateJob.jsx:4` `Plus`, `X`; `Jobs.jsx:4` `MapPin`, `Users`, `Sparkles`. Bundle 266.84 kB gz JS, 7.74 kB CSS. The repo's `frontend/build/` was not touched. |
| V2 | Same with `CI=true` (this is what `tests/run-suite.ps1:186-192`, the repo's `frontend` suite, runs) | **FAILS, exit 1**: "Treating warnings as errors because process.env.CI = true". The repo's only automated frontend check is red at HEAD. |
| V3 | grep of the V1 bundle for the base-URL constants | Every API base constant compiles to the same origin. `AllCandidates.jsx:8` (`import.meta.env.VITE_API_BASE_URL \|\| ...`) compiles to the **literal fallback** (`oV="http://localhost:5000"`); webpack resolves `import.meta.env` to undefined, so that file ignores all configuration. The same is true of the older `frontend/build/` (Nov 5). The value configured in `frontend/.env` currently resolves to the same origin as the in-code fallback, so the inconsistency is hidden today (value not reproduced). |
| V4 | grep of the V1 CSS bundle for `--border`, `--primary`, `--success`, `--warning`, `--destructive`, `--muted`, `--background`, `--foreground` | **0 definitions.** See §9.3: the score rings and charts reference these variables. |
| V5 | `git ls-files frontend` and grep for `*.test.*`, `setupTests` | No frontend test files exist (§10). |
| V6 | `grep -rnE "localStorage\|sessionStorage\|document\.cookie" frontend/src` | 0 hits. No token or session data is kept in browser storage. |
| V7 | `grep -rnE "supabase\|createClient\|:8000\|:8001\|:8002" frontend/src` | 0 hits. The browser never talks to Supabase or a Python service directly. |
| V8 | Import graph grep (`from '.../<Component>'`) | `Card`, `Input`, `Logo`, `Skeleton` are imported by nothing (§6). |

Env variable **names** present: `frontend/.env` defines `REACT_APP_API_BASE_URL` only (untracked; ignored by root `.gitignore` rule `**/.env`). There is no `frontend/.env.example`. `backend/.env` defines no `PORT`. There is no `gateway/.env`.

---

## 1. Entry points and structure

### 1.1 Toolchain (READ, VERIFIED by V1)
- **Create React App**, not Vite: `frontend/package.json:16` `react-scripts 5.0.1`; scripts `:23-27`; entry template `frontend/public/index.html` (CRA boilerplate, meta description still "Web site created using create-react-app", `:9-11`). `frontend/README.md` is the unmodified CRA README.
- React 19.2, react-router-dom 7.15, framer-motion 12, recharts 3, lucide-react (`package.json:5-19`).
- **Two Tailwind majors at once:** `tailwindcss ^3.4.19` (devDep, `:44`, the one in use through `postcss.config.js:3`) and `@tailwindcss/vite ^4.2.4` (dep, `:6`, a Vite plugin, unused in CRA).
- `@testing-library/*` and `web-vitals` are dependencies with no test files and no `reportWebVitals` file.
- The rebuild brief says "React (Vite)" (`REBUILD/KICKOFF.md:10`). The code is CRA. This needs a decision.

### 1.2 Entry
- `frontend/src/index.js:6-11` renders `<App/>` in `React.StrictMode` and imports `index.css`.
- `frontend/src/App.jsx:35-86`: `<AuthProvider>` wraps `<BrowserRouter>` wraps `<Routes>`. There is no 404 / catch-all route: an unknown path renders an empty `div.min-h-screen` (READ, `App.jsx:39-82`).

### 1.3 Route table (READ, `frontend/src/App.jsx`)

| Line | Path | Component | Guard |
|---|---|---|---|
| 44 | `/` | `pages/public/Landing` | none |
| 45 | `/select-role` | `pages/public/RoleSelection` | none |
| 46 | `/login` | `pages/public/Login` | none |
| 47 | `/signup` | `pages/public/Login` (same component, mode from pathname, `Login.jsx:55`) | none |
| 49 | `/login/:role` | redirect to `/login` | none |
| 50 | `/signup/:role` | redirect to `/signup` | none |
| 51 | `/email-confirmed` | `pages/public/EmailConfirmed` | none |
| 52 | `/reset-password` | `pages/public/ResetPassword` | none |
| 53 | `/admin/dashboard` | `pages/admin/Dashboard` | `RequireRole role="ADMIN"` (plus its own check, `admin/Dashboard.jsx:25-27,74`) |
| 56 | `/candidate/upload` | `pages/candidate/Upload` (outside the candidate layout, has its own header) | `RequireRole CANDIDATE` |
| 57 | `/candidate/processing` | `pages/candidate/Processing` (outside layout) | `RequireRole CANDIDATE`; **unreachable**, see §2.9 |
| 58 | `/candidate` | `components/layouts/CandidateLayout` (no index route: `/candidate` itself renders the nav with an empty body) | `RequireRole CANDIDATE` |
| 59 | `/candidate/dashboard` | `pages/candidate/Dashboard` | inherited |
| 60 | `/candidate/results` | `pages/candidate/Results` | inherited; **not linked from any nav**, see §2.10 |
| 61 | `/candidate/jobs` | `pages/candidate/CandidateJobs` | inherited |
| 62 | `/candidate/jobs/:id` | `pages/candidate/JobDetail` | inherited |
| 63 | `/candidate/profile` | `pages/candidate/CandidateProfile` | inherited |
| 64 | `/candidate/notifications` | `pages/candidate/Notifications` | inherited |
| 65 | `/candidate/assessment` | `pages/candidate/Assessment` | inherited |
| 69 | `/recruiter` | `components/layouts/RecruiterLayout` (no index route) | `RequireRole RECRUITER` |
| 71 | `/recruiter/profile` | `pages/recruiter/Profile` | inherited; **always renders "unavailable"**, see §2.20 |
| 72 | `/recruiter/dashboard` | `pages/recruiter/Dashboard` | inherited |
| 73 | `/recruiter/candidates` | `pages/recruiter/AllCandidates` | inherited; **not linked from any nav** (grep for `recruiter/candidates` in `src`: only `App.jsx:73`) |
| 74 | `/recruiter/jobs` | `pages/recruiter/Jobs` | inherited |
| 75 | `/recruiter/jobs/:id` | `pages/recruiter/JobDetails` | inherited |
| 76 | `/recruiter/create-job` | `pages/recruiter/CreateJob` | inherited |

### 1.4 How the guard works (READ, `frontend/src/components/auth/RequireRole.jsx:5-27`)
- Reads `{user, loading}` from `AuthContext`. While `loading`, it renders a blank full-screen div (`:9-11`). With no `user`, it redirects to `/login` with `state.from` (`:13-15`). If `user.role !== role` (exact string compare against `ADMIN` / `RECRUITER` / `CANDIDATE`), it redirects to that role's dashboard (`:17-24`).
- `user` comes only from `GET /api/auth/me` (`AuthContext.jsx:41`). The role string is uppercased by the backend (`backend/Controllers/auth.controller.js:42`).
- This is UI routing only. Authorisation is enforced server-side: the gateway's deny-by-default allowlist (`gateway/public-routes.js:3-21`) and the backend's `requireRole` (backend audit's scope). The frontend trusts no client-side flag for data access (READ). See §4.
- `Login.jsx` ignores `state.from` and always sends the user to their role's dashboard (`Login.jsx:117`), so deep links are lost after login (READ).

### 1.5 Navigation (READ)
- Candidate nav (`CandidateLayout.jsx:13-18`): About (`/candidate/dashboard`), Jobs, Assessment, Profile, plus the notifications bell (`:75-85`) and Sign out. **No link to Results or Upload** (Upload is reachable from Dashboard `:69`, Profile `:48`, JobDetail `:248`).
- Recruiter nav (`RecruiterLayout.jsx:10-13`): Dashboard, Jobs; Create Job (`:67-73`); avatar to Profile (`:75-87`); Sign out. **No link to `/recruiter/candidates`.**

---

## 2. Every screen: what it shows and where each datum comes from

Abbreviations: **API** = backend call (through the gateway, §3). **HC** = hardcoded in the JSX. **CALC** = computed in the browser from API data.

### Public

**2.1 Landing `/`** (`pages/public/Landing.jsx`, 450 lines). READ.
- **Entirely HC, and several numbers are invented claims:**
  - Animated "Credibility Score" demo ring fixed at **82** (`:61`, `:118`), skills `Python/React/Node` (`:134`), a "✓ Verified" pill (`:149`).
  - Stats: **"10000+ Candidates Verified", "500+ Companies Using", "95% Accuracy Rate"** (`:170-174`).
  - **"Trusted by 500+ companies", 5 stars, "4.9/5"** (`:305-310`).
  - Four stock avatars hot-linked from `i.pravatar.cc` (`:295`), a third-party request on every visit.
- Copy promises "Connect GitHub ... get instant credibility scores" (`:264`, `:347-349`). There is no GitHub connect UI anywhere (§2.15).
- These figures are fabricated, which the rebuild forbids.

**2.2 RoleSelection `/select-role`** (`RoleSelection.jsx`). READ. Static. Both cards link to `/signup` (`:77`, `:86`) without passing a role; the role is chosen again in a `<select>` on the signup form (`Login.jsx:273-280`). The page has no effect on anything. The `color` prop is unused (`:6`, `:82`, `:91`). It is reached from the "← Back" link on Login (`Login.jsx:211`).

**2.3 Login / Signup `/login`, `/signup`** (`Login.jsx`). READ.
- Login form: Username + Password only (`:284-335`; the email field is shown only in signup mode, `:315`). Calls `AuthContext.login` (`:115`), then `refreshUser` (`:116`), then navigates by role (`:117`).
- Signup: role select (candidate/recruiter), username, full name, email, password; for recruiters, optional "Company Name" and "LinkedIn / Company Website" (`:338-374`). Calls `POST /api/auth/signup` (`:120`), then **immediately logs out** (`:138`) and returns to `/login` with a success banner (`:139-142`).
- Bugs (READ):
  - "Resend confirmation email" (`:175-194`) sends `{ email }`, but in login mode the email field is never rendered, so `email` is always `''`. The button cannot work.
  - The error box is always titled "Account access paused" (`:249`), even when it shows "Confirmation email sent" (`:187`).
  - "Skip Verification & Continue" (`:157-169`) calls `setCompanyName('')` and `setVerificationInfo('')` and then immediately `handleSubmit`, which reads the **stale** closure values. The company and verification info are still sent, so "skip" does not skip.
  - Errors other than suspension use `alert()` (`:129`, `:150`).
- `whileFocusWithin` (`:17`) is not a documented framer-motion gesture prop. It is probably a no-op (UNKNOWN; harmless).

**2.4 EmailConfirmed `/email-confirmed`** (`EmailConfirmed.jsx`). READ. Static confirmation and a link to `/login`. Presumably the target of the Supabase confirmation redirect (the backend sets the redirect; UNKNOWN from frontend code).

**2.5 ResetPassword `/reset-password`** (`ResetPassword.jsx`). READ.
- Two modes. **Request:** username-or-email field, `POST /api/auth/request-password-reset {username: identifier}` (`:64-68`). **Recovery:** parses the Supabase recovery params from the URL hash or query (`:11-29`), strips them from the address bar (`:51-53`), then `POST /api/auth/reset-password {newPassword, tokenHash, accessToken, refreshToken}` (`:101-110`). Client-side check: at least 8 characters and matching confirmation (`:90-97`).
- **Uses a hardcoded base URL**, `const API_BASE_URL = 'http://localhost:5000'` (`:6`), not the env variable.

### Admin

**2.6 Admin dashboard `/admin/dashboard`** (`admin/Dashboard.jsx`). READ.
- Four cards (candidates, recruiters, jobs, suspended) from `GET /api/admin/overview` (`:35`); `'—'` while loading (`:98`). A "Live sync" line shows `source`, `project`, recruiter count and time from the same response (`:39-44`, `:92`).
- Candidate / recruiter tabs list `overview.users.candidates|recruiters` (`:51-56`). Suspend / Reactivate calls `PATCH /api/admin/users/:id/suspension` (`:62-65`).
- Bug: after a toggle, only the local `accounts` list and the `suspended` counter are updated (`:68-69`), not `overview.users`. Switching tabs re-derives `accounts` from the stale `overview` (`:51-56`), so the change **visually reverts** until reload.
- There is no admin nav; admins cannot reach any other page.

### Candidate

**2.7 Candidate "Dashboard" `/candidate/dashboard`** (`candidate/Dashboard.jsx`). READ. **100 % HC marketing copy**: a features array (`:15-37`), a steps array (`:39-43`), CTAs to Upload and Jobs. No API call. Labelled "About" in the nav (`CandidateLayout.jsx:14`). The candidate never sees their own score, applications or assessment results on their dashboard.

**2.8 Upload `/candidate/upload`** (`candidate/Upload.jsx`). READ.
- Status from `GET /api/resume/status` (`:100`): `hasResume`, `fileName` (shape matches `backend/Controllers/analysis.controller.js:195-200`). A network error is swallowed and the page shows "No resume uploaded yet" (`:106-107`).
- Upload: client-side type check (PDF/DOCX, `:18-26`, `:144-147`), then `POST /api/resume/upload` multipart `resume` (`:157-160`). This **only stores the file** (`analysis.controller.js:258-285`): no parsing, no score.
- No client-side size check (the server caps at 10 MB per AUDIT 5.1; not re-verified here).
- The footer claims "Your resume is stored securely" (`:395`). That is copy, not a verified property.

**2.9 Processing `/candidate/processing`** (`candidate/Processing.jsx`). READ.
- Needs `location.state.{file, jobId}` (`:158-159`). Without it, it shows "Processing context missing" (`:233-258`).
- With it, it does a real XHR `POST /api/analyze` with upload progress (`:173-222`), then navigates to `/candidate/results` with the analysis (`:201`).
- **Nothing in `src` navigates here with state.** The grep for `candidate/processing` finds only `App.jsx:57`. Upload's navigation into Processing was removed in `71c632d` (2026-09-03, "add resume upload and status endpoints"). The page is honest (it explicitly refuses to show fake GitHub or assessment steps, `:8-17`), but it is dead in practice.
- **Consequence: no UI path calls `/api/analyze`, the only endpoint that writes a `scores` row** (`analysis.controller.js:287-449`; apply at `backend/Controllers/jobs.controller.js:103-157` inserts only an `applications` row). See Top risk #1.

**2.10 Results `/candidate/results`** (`candidate/Results.jsx`). READ.
- Data: `location.state.analysis` (only Processing supplies it, so never in practice) else `GET /api/candidate-analysis` (`:103`). That returns the candidate's **single most recent score across all jobs** (`analysis.controller.js:451-475`). A 404 shows "No analysis yet".
- Shows: score ring (`credibilityScore`, `:155`, `:181`); `matchLevel` badge; Evidence-limited badge; `explanation.summary` with an **HC fallback sentence** when absent (`:190-191`); parsed skills, experience, education and projects (`:156-159`, `:204-288`); and the shared `ScoreBreakdown` (`:297`).
- `const score = Number(analysis.credibilityScore) || 0` (`:155`): a missing or NaN score renders as **0**, not as "unavailable".
- **Not linked from any navigation**; reachable only by typing the URL.

**2.11 CandidateJobs `/candidate/jobs`** (`CandidateJobs.jsx`). READ. `GET /api/jobs` (`:15`); shows title, location and experience level. Loading, error and empty states are present.

**2.12 JobDetail `/candidate/jobs/:id`** (`candidate/JobDetail.jsx`). READ.
- `GET /api/jobs/:id` (`:17`): title, location, level, `requiredSkills`, `preferredSkills`, description (rendered line-by-line with `#` headings, `:122-149`). `data.applied` sets the Applied state (`:22`).
- `GET /api/resume/status` (`:49`) gates Apply. `GET /api/jobs/my-applications` (`:70`) **also** sets applied (`:73`): two sources for one flag, see §5.
- Apply: `POST /api/jobs/:id/apply {}` (`:92-96`); handles 409 (already applied) and 400 `RESUME_REQUIRED` (`:98-109`).
- **Applying does not score**, and there is no "analyse against this job" action. No candidate-side flow exists from here to a credibility score.

**2.13 CandidateProfile `/candidate/profile`** (`CandidateProfile.jsx`). READ. Shows `user.name`, `user.email`, `user.location || "Location not set"` (`:34-42`). The backend user object has **no `location` field** (`auth.controller.js:34-46`), so it always reads "Location not set". No GitHub or LinkedIn fields and no edit.

**2.14 Notifications `/candidate/notifications`** (`Notifications.jsx`). READ.
- `GET /api/notifications` returns `{notifications, unreadCount}` (`notification.controller.js:34-40`). "Mark read" calls `POST /api/notifications/:id/read` (`:33`).
- **Bug at `:37-39`:** `prev.map(n => n.id === id ? {...n, read: true} : prev)` returns the whole `prev` array for every non-matching item. After one click the list holds nested arrays and renders broken rows (blank message, "Invalid Date").
- Notifications are created only by `sendNotification` (`notification.controller.js:3`), called only from the shortlist handler (`jobs.controller.js:3`, `:179+`), which **no frontend code calls**. So the page is always "No notifications yet." in a UI-only demo (READ). The layout bell polls `?unread=true` every 30 s (`CandidateLayout.jsx:26-42`).

**2.15 Assessment `/candidate/assessment`** (`candidate/Assessment.jsx`, 495 lines). READ.
- Job picker from `GET /api/jobs` (`:38`). This lists **every published job**, not only jobs applied to, so a candidate can take an assessment for a job they never applied to.
- Generate: `POST /api/assessment/generate {jobId}` (`:58-62`). It handles 409 "all N attempts used" (`:64-69`, HC fallback max 5 at `:65`) and accepts two response shapes (`data.questions.questions` or a bare array, `:75-80`).
- MCQ and short-answer UI. Submit: `POST /api/assessment/evaluate {assessmentId, answers}` (`:126-130`). The result shows `score%`, points and per-question feedback from the API (`:212-289`).
- **Misleading copy:**
  - "Your latest attempt counts toward your credibility score for this job" (`:234-236`, `:484-486`). The backend only updates an *existing* score row (`backend/Controllers/assessment.controller.js:490-506`), and the UI never creates one (§2.9), so in a UI-only flow the assessment folds into nothing.
  - "You can leave and come back ... the same attempt is resumed" (`:485-486`). Answers live only in React state (`:27-28`) and are lost on reload. The server resumes the questions, not the answers.
- **GR-1 (anti-cheat): nothing client-side.** No timer, no tab/visibility detection, no paste blocking, no proctoring. HC "Up to 5 attempts per job" (`:482`).
- Undefined CSS classes `badge`, `badge-primary` (`:350-356`) and `btn` (`:186`): see §9.

### Recruiter

**2.16 Recruiter Dashboard `/recruiter/dashboard`** (`recruiter/Dashboard.jsx`, 498 lines). READ.
- `GET /api/candidates` and `GET /api/jobs/mine` in parallel (`:196-199`). A failed response silently becomes `[]` (`:200-201`): an API outage looks exactly like "no candidates".
- Stat cards: Active jobs = `jobs.length` (`:267`; every job the recruiter owns, whatever its status, so "Active" is a label not a filter, READ against `jobs.controller.js:31-40`); Candidates scored (`:271`); **Average credibility = CALC** mean of `credibilityScore` (`:218-220`); Evidence-limited count (`:217`).
- "Applications scored, last 7 days" bar chart: **CALC**, bucketed by `appliedAt`, which is the **score's `created_at`** (`analysis.controller.js:127`), not the application date (`:136-161`).
- "Skill evidence": **CALC** across candidates from `skillEvidence` rows (`:168-184`).
- Top 5 candidates ranked by `credibilityScore` (`:211-214`, `:384`). Clicking one opens `CandidateModal` (§8).
- "Attention required": evidence-limited count and the flags-unavailable reason from the API (`:445-489`).
- `/api/candidates` returns **score rows only**, so candidates who applied but were never scored (all of them, §2.9) do not appear. The dashboard shows "No candidates scored yet" after real applications (AUDIT and MANUAL_SMOKE C12 agree).

**2.17 Jobs `/recruiter/jobs`** (`recruiter/Jobs.jsx`). READ.
- `GET /api/jobs/mine` (`:75`).
- **HC `count={0}`** for every card (`:125`), so every job reads **"0 Applications Total"** (`:52`) regardless of real applications, and the "N New" badge (`:32-36`) never shows.
- Uses `job._id` for the link (`:54`). This works because the backend sends an `_id` alias (`backend/Controllers/jobs.controller.js:7`).
- **Old dark-theme styling on the current white theme:** `text-white` headings and title (`:31`, `:103`), `text-white/50`, `bg-white/5` chips. On a `#ffffff` card (`index.css:108-113`) the **job titles and page title are white on white** (READ; exact rendering UNKNOWN until a browser check).

**2.18 JobDetails `/recruiter/jobs/:id`** (`recruiter/JobDetails.jsx`). READ.
- Fetches **all** of the recruiter's jobs and all of their candidates, then picks this job client-side (`:86-99`).
- Shows the job header, a candidate count, filters (min-score slider, evidenced skill, evidence availability, `:111-126`), ranked rows, and the CandidateModal.
- **Correctness bug:** `/api/candidates` keeps **one row per candidate across all the recruiter's jobs** (latest score only, `analysis.controller.js:504-510`). Filtering that list by `jobId` (`JobDetails.jsx:99`) drops a candidate from every job except the one with their most recent score.
- The candidate count is scored candidates, not applicants. Shortlist / reject is absent (§5).

**2.19 AllCandidates `/recruiter/candidates`** (`recruiter/AllCandidates.jsx`). READ.
- `GET /api/recruiter/applicants` (`:20`): **application rows** with `candidateInfo.{name,email}`, `jobTitle`, `status`, `credibilityScore` (null if unscored) (`analysis.controller.js:531-597`).
- Search by name, email or job (`:37-44`); status filter (`:132-141`).
- Résumé button: `GET /api/resume/candidate/:candidateId` (`:61`), then opens the returned signed URL in a new tab (`:67-69`).
- Bugs:
  - The status vocabulary disagrees. Apply inserts `status: 'submitted'` (`jobs.controller.js:142`); the page's filter and badges expect `applied | shortlisted | rejected` (`:76-87`, `:137-141`). "Pending" never matches anything, and the badge prints the raw word "submitted" with the amber style.
  - A `null` score renders as an **empty red score** (`:192-194`; `getScoreColor(null)` falls through to `text-destructive`).
- The base URL comes from `import.meta.env.VITE_API_BASE_URL` (`:8`), which compiles to the literal fallback (V3).
- Unlinked from navigation (§1.5). Initials avatar has a fallback `'UN'` (`:168`).

**2.20 Recruiter Profile `/recruiter/profile`** (`recruiter/Profile.jsx`). READ.
- Guard `user.role !== 'recruiter'` (lowercase, `:24`), but roles are uppercase (`auth.controller.js:42`), so it **always renders "Recruiter profile is unavailable."**
- The hidden body has **HC stats "5 Jobs Posted" and "2 Candidates Hired"** (`:97`, `:108`) and a "Verified / Not Verified" badge from `user.isVerified`, which the backend never sends (`auth.controller.js:34-46`). The "Edit Profile" button has no handler (`:131-138`). It uses the same white-on-white dark-theme classes as Jobs.
- This is the target of the avatar link in the recruiter nav (`RecruiterLayout.jsx:75-77`).

**2.21 CreateJob `/recruiter/create-job`** (`recruiter/CreateJob.jsx`, 547 lines). READ.
- Three-step form: title, location (default "Remote", `:166`) and experience level (HC three options, `:339-342`); skills chosen **only** from an HC list of 20 (`SUGGESTED_SKILLS`, `:7-12`; no free text, no preferred skills even though the backend accepts `preferredSkills`, `jobs.controller.js:43`); description.
- Submit: `fetch('http://localhost:5000/api/jobs', POST)` with `{title, skills, description, experienceLevel, location}` (`:202-215`). This is a **hardcoded literal URL with plain `fetch`**. Cookies are attached only because the global fetch patch matches the URL prefix (§3.3). If `REACT_APP_API_BASE_URL` changes, job creation loses its session cookie.
- **Fake AI:** an "AI Suggestion" panel appears when `description.length > 50 && Math.random() > 0.7` (`:231-235`). "Accept" appends a **hardcoded string** ("Technologies: React 18, TypeScript. Remote work available.", `:461-465`). No model is called.
- **Unsourced claim:** "Detailed job descriptions ... receive 3x more qualified applications" (`:540`).
- **Unreadable controls:** primary buttons use `bg-primary` (#0a0a0a) with `text-foreground` (#0a0a0a) (`:355`, `:423`, `:505`), and the active progress step uses `bg-accent-purple` (#0a0a0a, `tailwind.config.js:30`) with `text-foreground` (`:100`). That is **black text on black**: "Next Step", "Post Job Listing" and the step number are invisible (READ; confirm in a browser).
- Renders its own `min-h-screen` page, a noise overlay and a `fixed` back link (`:238-265`) inside `RecruiterLayout`'s `<main>`. Errors are reported with `alert()`.

### Shared recruiter components

**2.22 CandidateModal** (`components/recruiter/CandidateModal.jsx`). READ. Name, applied job, contact links (email, GitHub, LinkedIn), match level, evidence-limited, résumé file name, applied date, a score ring, and `ScoreBreakdown`. All values come from the `serializeCandidate` object (`analysis.controller.js:79-129`).
- The **"location" shown as the candidate's location is the job's location**: `candidate.location: job?.location` (`analysis.controller.js:98`), rendered at `CandidateModal.jsx:117-121`.
- `candidate.name` falls back to the placeholder **"Candidate"** (`analysis.controller.js:97`).

**2.23 ScoreBreakdown**: see §8.

---

## 3. Outbound calls

### 3.1 Which service the browser talks to (READ + VERIFIED V3, V7)
- **Every API call goes to one origin**, the base URL. Its in-code fallback is port 5000 on localhost. The configured `REACT_APP_API_BASE_URL` resolves to the same origin (V3).
- By default **port 5000 is the gateway** (`gateway/index.js:14`, `:75`) and the core backend is on 5001 (`backend/index.js:22`; `backend/.env` sets no `PORT`). The gateway proxies `/api/*` to `CORE_URL` only (`gateway/index.js:51-63`). **So the frontend talks to the gateway, the gateway talks to the backend, and the browser never contacts the NLP, GitHub-evidence or assessment services, nor Supabase directly** (V7). The one exception is that the browser opens a **signed Supabase Storage URL** for a résumé, returned by the backend (`AllCandidates.jsx:67-69`).
- Consistency: the *destination* is consistent. The *way the URL is built* is not (§3.2), and neither is the way credentials are attached (§3.3).
- If the gateway is not running, every call fails, because nothing in the frontend points at 5001 (READ).
- Public (no-session) calls the gateway allows: signup, login, logout, resend-confirmation, request-password-reset, reset-password (`gateway/public-routes.js:3-12`). `GET /api/auth/me` is not public, so a logged-out user gets a gateway 401, which `AuthContext` treats as logged out (`AuthContext.jsx:42-45`) (READ; fine).

### 3.2 Base-URL construction: three mechanisms (READ, VERIFIED V3)
1. `process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'`, **copy-pasted into 14 files**: `AuthContext.jsx:4`, `CandidateLayout.jsx:7`, `admin/Dashboard.jsx:6`, `Assessment.jsx:14`, `CandidateJobs.jsx:5`, `candidate/JobDetail.jsx:6`, `Notifications.jsx:6`, `Processing.jsx:6`, `Results.jsx:12`, `Upload.jsx:16`, `Login.jsx:7`, `recruiter/Dashboard.jsx:15`, `recruiter/JobDetails.jsx:11`, `recruiter/Jobs.jsx:7`. There is no shared API module.
2. **Hardcoded literal:** `ResetPassword.jsx:6`, `CreateJob.jsx:211`.
3. **`import.meta.env.VITE_API_BASE_URL`** in `AllCandidates.jsx:8`, a Vite idiom that compiles to the literal under CRA (V3).

### 3.3 Credential attachment: four mechanisms (READ)
- `authFetch` / `withCredentialsFetch` sets `credentials: 'include'` (`AuthContext.jsx:6-12`, `:106`).
- A **global `window.fetch` monkey-patch** installed in an effect (`AuthContext.jsx:18-37`) adds `credentials: 'include'` to any URL starting with the base URL. Plain `fetch` calls (Results, CandidateJobs, JobDetail `:17`, ResetPassword, CreateJob) rely on it. It only matches if the literal URL begins with the env base, so the literals in mechanism 2 depend on the env value staying equal to the fallback.
- An explicit `credentials: 'include'` in `CandidateLayout.jsx:28-30`.
- XHR `withCredentials = true` in `Processing.jsx:178`.

### 3.4 Call table

All URLs are relative to the base URL unless noted. "Exists" = a matching route in `backend/Routes/*` (READ). Backend mounts: `backend/index.js:47-61`.

| # | Caller | Method + path | Base | Creds via | Response used for | Exists |
|---|---|---|---|---|---|---|
| 1 | `context/AuthContext.jsx:41` | GET `/api/auth/me` | env | authFetch | `user` (role, name, email, firstName, companyName) | `auth.routes.js:17` |
| 2 | `context/AuthContext.jsx:73` | POST `/api/auth/login` `{email:'',password,username}` | env | authFetch | sets `user`; `code` for suspension | `auth.routes.js:16` |
| 3 | `context/AuthContext.jsx:92` | POST `/api/auth/logout` | env | authFetch | clears user | `auth.routes.js:18` |
| 4 | `pages/public/Login.jsx:120` | POST `/api/auth/signup` `{email,password,username,role,name,companyName?,verificationInfo?}` | env | authFetch | ok / message | `auth.routes.js:15` |
| 5 | `pages/public/Login.jsx:138` | POST `/api/auth/logout` (right after signup) | env | authFetch | none | yes |
| 6 | `pages/public/Login.jsx:178` | POST `/api/auth/resend-confirmation` `{email}` (always empty, §2.3) | env | authFetch | message | `auth.routes.js:19` |
| 7 | `pages/public/ResetPassword.jsx:64` | POST `/api/auth/request-password-reset` `{username}` | **literal** | patch | message | `auth.routes.js:20` |
| 8 | `pages/public/ResetPassword.jsx:101` | POST `/api/auth/reset-password` `{newPassword,tokenHash,accessToken,refreshToken}` | **literal** | patch | message | `auth.routes.js:21` |
| 9 | `pages/admin/Dashboard.jsx:35` | GET `/api/admin/overview` | env | authFetch | counts, user lists, sync info | `admin.routes.js:8` |
| 10 | `pages/admin/Dashboard.jsx:62` | PATCH `/api/admin/users/:id/suspension` `{isSuspended}` | env | authFetch | updated user | `admin.routes.js:10` |
| 11 | `pages/candidate/Upload.jsx:100` | GET `/api/resume/status` | env | authFetch | hasResume, fileName | `analysis.routes.js:11` |
| 12 | `pages/candidate/Upload.jsx:157` | POST `/api/resume/upload` (multipart `resume`) | env | authFetch | success flag | `analysis.routes.js:12` |
| 13 | `pages/candidate/Processing.jsx:175` | XHR POST `/api/analyze` (multipart `resume`, `jobId`) | env | XHR | analysis object to Results | `analysis.routes.js:7`. **No reachable caller** |
| 14 | `pages/candidate/Results.jsx:103` | GET `/api/candidate-analysis` | env | patch | latest analysis | `analysis.routes.js:8` |
| 15 | `pages/candidate/CandidateJobs.jsx:15` | GET `/api/jobs` | env | patch | job list | `jobs.routes.js:15` |
| 16 | `pages/candidate/JobDetail.jsx:17` | GET `/api/jobs/:id` | env | patch | job + `applied` | `jobs.routes.js:21` |
| 17 | `pages/candidate/JobDetail.jsx:49` | GET `/api/resume/status` | env | authFetch | gate Apply | yes |
| 18 | `pages/candidate/JobDetail.jsx:70` | GET `/api/jobs/my-applications` | env | authFetch | `applied` (second source) | `jobs.routes.js:18` |
| 19 | `pages/candidate/JobDetail.jsx:92` | POST `/api/jobs/:id/apply` `{}` | env | authFetch | applied / 409 / RESUME_REQUIRED | `jobs.routes.js:22` |
| 20 | `pages/candidate/Notifications.jsx:16` | GET `/api/notifications` | env | authFetch | list | `notification.routes.js:7` |
| 21 | `pages/candidate/Notifications.jsx:33` | POST `/api/notifications/:id/read` | env | authFetch | local state (buggy) | `notification.routes.js:13` |
| 22 | `components/layouts/CandidateLayout.jsx:28` | GET `/api/notifications?unread=true`, **polled every 30 s** (`:41`) | env | explicit | badge count | yes (query param ignored; `unreadCount` always computed) |
| 23 | `pages/candidate/Assessment.jsx:38` | GET `/api/jobs` | env | authFetch | job picker | yes |
| 24 | `pages/candidate/Assessment.jsx:58` | POST `/api/assessment/generate` `{jobId}` | env | authFetch | questions, assessmentId | `assessment.routes.js:9` |
| 25 | `pages/candidate/Assessment.jsx:126` | POST `/api/assessment/evaluate` `{assessmentId,answers}` | env | authFetch | score, per-question results | `assessment.routes.js:10` |
| 26 | `pages/recruiter/Dashboard.jsx:197` | GET `/api/candidates` | env | authFetch | ranked score rows | `analysis.routes.js:9` |
| 27 | `pages/recruiter/Dashboard.jsx:198` | GET `/api/jobs/mine` | env | authFetch | job cards, count | `jobs.routes.js:16` |
| 28 | `pages/recruiter/Jobs.jsx:75` | GET `/api/jobs/mine` | env | authFetch | job list | yes |
| 29 | `pages/recruiter/JobDetails.jsx:87` | GET `/api/jobs/mine` | env | authFetch | find one job | yes |
| 30 | `pages/recruiter/JobDetails.jsx:88` | GET `/api/candidates` | env | authFetch | filter by job (lossy, §2.18) | yes |
| 31 | `pages/recruiter/AllCandidates.jsx:20` | GET `/api/recruiter/applicants` | **import.meta, literal in practice** | authFetch | application rows | `analysis.routes.js:10` |
| 32 | `pages/recruiter/AllCandidates.jsx:61` | GET `/api/resume/candidate/:candidateId` | import.meta | authFetch | signed URL, then `window.open` (`:68`) | `analysis.routes.js:13` |
| 33 | `pages/recruiter/CreateJob.jsx:211` | POST `/api/jobs` `{title,skills,description,experienceLevel,location}` | **literal** | patch | none (navigates) | `jobs.routes.js:17` (body fields match `jobs.controller.js:43`) |
| X1 | `src/index.css:1` | GET Google Fonts CSS (third party) | n/a | n/a | Inter font | n/a |
| X2 | `pages/public/Landing.jsx:295` | GET `i.pravatar.cc` x4 (third party) | n/a | n/a | stock avatars | n/a |

Backend routes with **no frontend caller**: `GET /api/admin/users` (`admin.routes.js:9`) and **`POST /api/jobs/applications/shortlist`** (`jobs.routes.js:19`). The shortlist / reject workflow and the notifications that hang off it have no UI.

---

## 4. Auth on the client (READ)

- **Mechanism:** a server session cookie. The browser stores no token: no `localStorage`, `sessionStorage` or `document.cookie` use (V6). Every authenticated call relies on the cookie through `credentials: 'include'` (§3.3). Cookie flags (HttpOnly, SameSite, Secure) are set server-side: UNKNOWN from frontend code (backend audit).
- **Login:** username + password only (`Login.jsx:103`, `:115`). The payload also carries `email: ''` because the email field is hidden in login mode. On success `user` is set from the login response (`AuthContext.jsx:86`), then `refreshUser()` calls `/api/auth/me` (`Login.jsx:116`). A suspended account gets `code === 'ACCOUNT_SUSPENDED'` and an inline banner (`Login.jsx:147-148`).
- **Signup:** the client chooses the role (`Login.jsx:106`). The server allowlists `candidate` and `recruiter` only (`backend/Controllers/auth.controller.js:7`, `:218-220`), so admin self-signup is blocked server-side.
- **Recruiter "verification" is cosmetic:** the optional company and LinkedIn fields are sent and stored as `verification_info` (`auth.controller.js:250`). Nothing checks them, and the user object has no verified flag (`auth.controller.js:34-46`). After signup the client logs out and asks for a fresh sign-in (`Login.jsx:135-143`).
- **Session restore:** on mount `AuthProvider` calls `/api/auth/me`. Until it answers, `RequireRole` renders a blank page (`RequireRole.jsx:9-11`).
- **Role detection:** `user.role` from `/me`, compared as uppercase strings in `RequireRole.jsx:17` and `Login.jsx:81-86`. The same mapping is duplicated in both. The one place that compares lowercase (`recruiter/Profile.jsx:24`) is broken (§2.20).
- **Logout:** four variants:
  - Both layouts: `logout()` then a hard reload to `/login` (`CandidateLayout.jsx:20-23`, `RecruiterLayout.jsx:15-18`).
  - Both profile pages: `navigate('/')`.
  - Admin: `navigate('/login')`.
  - `logout()` always clears local state even if the server call fails (`AuthContext.jsx:101-103`).
- **Password reset:** Supabase recovery tokens are read from the URL fragment or query and POSTed in a JSON body to the backend, then stripped from history (`ResetPassword.jsx:11-29`, `:51-53`, `:101-110`). The browser never calls Supabase Auth itself.
- **Client-side trust:** route guards and the admin page's own role check are UI conveniences only. The frontend does not decide data access. Data scoping (for example "recruiter sees only own jobs") is server-side (`analysis.controller.js:479-496`, `:533-550`). I found no place where the client sends a role or user id that the server is supposed to trust. The client sends `role` only at signup, where it is allowlisted.
- **No OAuth.** Login and Landing copy mention GitHub, but there is no OAuth button or flow. `backend/.env` has `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` names present, but no frontend code uses OAuth (READ, V7 grep).

---

## 5. Duplicated or contradicting implementations (READ)

1. **Two competing sources for "the recruiter's candidates":**
   - `GET /api/candidates`: score rows, one per candidate across all jobs, ranked. Used by `recruiter/Dashboard.jsx:197` and `recruiter/JobDetails.jsx:88`.
   - `GET /api/recruiter/applicants`: application rows with status and an optional score. Used by `AllCandidates.jsx:20`.
   - They disagree: an applied-but-unscored candidate (today, every applicant) is in the second and absent from the first; a candidate scored for two jobs appears once in the first. The status vocabulary also differs (`submitted` stored vs `applied` expected, §2.19). This mirrors the past "three competing job-description sources" lesson.
2. **Two sources for "has this candidate applied?"** in `candidate/JobDetail.jsx`: `data.applied` from `GET /api/jobs/:id` (`:22`) **and** `GET /api/jobs/my-applications` (`:70-74`). They race to set the same state.
3. **Two job-list endpoints for the candidate** (`/api/jobs` in CandidateJobs and in the Assessment picker). They are consistent, but the Assessment picker is not restricted to applied jobs (§2.15).
4. **Recruiter single job:** JobDetails filters `/api/jobs/mine` client-side instead of using a by-id call, because `GET /api/jobs/:id` returns published jobs only (`jobs.controller.js:76-86`). That is two different job lookups with different visibility rules.
5. **Four credential mechanisms and three base-URL mechanisms** (§3.2, §3.3). `authFetch` and the global fetch patch do the same job twice.
6. **Score-ring implementations x4:** `Results.jsx:37-68`, `CandidateModal.jsx:35-66`, Landing `CredibilityDemo` (`Landing.jsx:57-166`), Processing `CircularProgress` (`Processing.jsx:35-92`).
7. **Score banding duplicated x5**, 80/60 thresholds hardcoded in each: `Results.jsx:20-21`, `recruiter/Dashboard.jsx:17-18`, `JobDetails.jsx:13-14`, `CandidateModal.jsx:24-25`, `AllCandidates.jsx:53-57`. The colour band is a frontend invention, independent of the backend's `matchLevel`, so a badge can say one level (from the NLP `match_level`) in the colour of another.
8. **Input components x3:** `Login.jsx:10-49` `AnimatedInput`, `CreateJob.jsx:22-42` `AnimatedInput` (different), and the unused `components/Input.jsx`.
9. **Wordmark / header markup inlined x8** (Landing, Login, RoleSelection, ResetPassword, Upload, both layouts, Admin), while `components/Logo.jsx` (unused) exists.
10. **Spinners:** `components/Spinner` and lucide `Loader2` (Upload, JobDetail) and inline framer-motion spinners (Login `:385-389`, ResetPassword `:253-257`, CreateJob `:513-517`).
11. **Card:** the `components/Card.jsx` component (unused) vs the `.card` CSS class (`index.css:31-36`, used everywhere) vs the legacy `.glass-card` (`index.css:108-113`, Jobs and Profile).
12. **Role-to-dashboard mapping** duplicated: `Login.jsx:81-86` and `RequireRole.jsx:18-22`.
13. **Two "role pick" UIs:** the RoleSelection page (no effect) and the select inside the signup form.
14. **Two styling generations** coexist: the current light "quiet" theme vs the abandoned dark theme in `recruiter/Jobs.jsx`, `recruiter/Profile.jsx` and parts of `CreateJob.jsx` (`text-white`, `bg-white/5`, `accent-purple`, `GlowOrb`, `corner-decoration`, `noise-overlay`). `index.css:99` labels them "Aaron's original classes - updated for light theme".

---

## 6. Dead code (READ; import graph VERIFIED V8, lint VERIFIED V1)

- **Never imported:** `components/Card.jsx` (102 lines), `components/Input.jsx` (279), `components/Logo.jsx` (77), `components/Skeleton.jsx` (126, includes `Math.random()` bar heights at `:90`).
- **Unused sub-components:** `Badge.Dot`, `Badge.Verified`, `Badge.Pending`, `Badge.Failed` (`Badge.jsx:56-150`) and `Spinner.Button` (`Spinner.jsx:52-54`). Only `Spinner.Page` is used (`Results.jsx:126`).
- **Routed but unreachable:** `Processing.jsx` (no navigation with state, §2.9). Effectively unreachable without a typed URL: `Results.jsx`, `AllCandidates.jsx`. `recruiter/Profile.jsx` is reachable but always shows the "unavailable" branch, so its body is dead.
- **Unused variables:** the 9 lint warnings in V1 (unused `navigate` in both layouts; unused icon imports in AllCandidates, CreateJob and Jobs). RoleSelection's `color` prop.
- **CSS:** of ~25 legacy classes in `index.css`, **unused (0 references):** `glass-card-hover`, `glow-border`, `magnetic-btn`, `glow-orb*`, `gradient-text`, `floating-particle`, `input-glow`, `scan-line`, `pulse-ring`, `counter-value`, `animated-underline`, `reveal-up`, `spotlight`, `neon-edge`, `progress-glow`, `shadow-glow-purple`. `index.css` contains 10 `display: none` declarations. Most custom animations in `tailwind.config.js:80-135` (float, scan, rotate-slow, particle-drift, gradient-shift, border-rotate, counter, reveal-*) are unreferenced except `animate-glow-pulse`.
- **Dependencies:** `@tailwindcss/vite` (Vite plugin in CRA), `@testing-library/*` (no tests), `web-vitals` (no call).
- **CRA boilerplate:** `frontend/README.md`, `public/index.html` description, `public/manifest.json` and `public/robots.txt` are the CRA defaults.
- **Commented-out blocks of note:** none. Only explanatory comments. One `eslint-disable-next-line react-hooks/exhaustive-deps` (`Assessment.jsx:102`). No TODO or FIXME markers.

---

## 7. Hardcoded values (READ)

| Kind | Location | Note |
|---|---|---|
| API origin fallback (localhost:5000) | 14 env-fallback sites (§3.2), `ResetPassword.jsx:6`, `CreateJob.jsx:211`, `AllCandidates.jsx:8` | Port 5000 = gateway default (`gateway/index.js:14`) |
| Third-party URLs | `index.css:1` (Google Fonts), `Landing.jsx:295` (`i.pravatar.cc`) | External requests on page load |
| Fabricated marketing metrics | `Landing.jsx:61,118` (score 82), `:170-174` (10000+, 500+, 95%), `:305-310` (500+ companies, 4.9/5) | No data source |
| Fabricated recruiter stats | `recruiter/Profile.jsx:97` ("5" jobs), `:108` ("2" hired) | |
| Hardcoded zero | `recruiter/Jobs.jsx:125` (`count={0}`) gives "0 Applications Total" | |
| Fake AI | `CreateJob.jsx:231-235` (`Math.random() > 0.7`), `:461-465` (suggestion text) | |
| Unsourced claim | `CreateJob.jsx:540` ("3x more qualified applications") | |
| Fake unread indicator | `RecruiterLayout.jsx:62-65` (permanent red dot on a bell with no handler) | |
| Non-functional search box | `RecruiterLayout.jsx:53-60` (no state, no handler) | |
| Score thresholds 80/60 | 5 places (§5.7) | Client-side banding |
| Assessment attempt limit 5 | `Assessment.jsx:65`, `:482` | Should come from the server (`data.max_attempts` is already preferred at `:65`) |
| Skill vocabulary (20 skills) | `CreateJob.jsx:7-12` | Recruiters cannot enter other skills |
| Experience levels (3) | `CreateJob.jsx:339-342` | |
| Default location "Remote" | `CreateJob.jsx:166` | |
| Polling interval 30 s | `CandidateLayout.jsx:41` | |
| Password minimum 8 | `ResetPassword.jsx:90` | Matches the backend (`auth.controller.js:224`) |
| Placeholder text | `Login.jsx:290,308,322,359` ("johndoe", "John Doe", "you@example.com", "Acme Corp"); fallbacks "Unnamed Candidate" (`CandidateProfile.jsx:34`), "Unknown"/"UN" (`AllCandidates.jsx:168,174`), "Candidate" (backend, shown in the modal) | |
| Credentials or secret-looking strings | **None found** in `frontend/src` (READ; V7 shows no Supabase keys or client) | |
| Sample candidates or mock data arrays | **None** in `frontend/src` (`grep -i mock` gives 0). The earlier mock and random-score pages were deleted (per AUDIT 5.15, `5446ebe`; not re-verified) | |

---

## 8. Explainability and score display (READ)

### 8.1 Where scores appear
- **Recruiter:** Dashboard top-5 cards (`recruiter/Dashboard.jsx:68-70`), JobDetails rows (`JobDetails.jsx:56-58`), AllCandidates rows (`AllCandidates.jsx:192-194`), and the CandidateModal ring plus `ScoreBreakdown` (`CandidateModal.jsx:178-188`).
- **Candidate:** only `Results.jsx` (ring plus the **same** `ScoreBreakdown`, `:297`), and only by typing the URL. Assessment shows its own `score%` (`Assessment.jsx:224`), which is the assessment result, not the credibility score.

### 8.2 ScoreBreakdown (`components/recruiter/ScoreBreakdown.jsx`)
- It renders the persisted `explanation` object as stored, with no re-derivation. Every key it reads is produced by `backend/Services/explainability.js`: `factors[].{label, available, direction, weight_pct, value, contribution, reason, evidence}` (`explainability.js:692-705`); `summary`, `generated_at`, `version` (`:710-713`); `skill_evidence` rows `{name, status, required_by_job, evidence_sources_confirming, evidence_sources_available}` (`:597-615`); `flags_available` and `flags_unavailable_reason` (`:637-649`). Serialised by `analysis.controller.js:108-119`.
- Per factor, it shows the sub-score `value/100`, `weight_pct%` and `contribution` points (`ScoreBreakdown.jsx:134-153`). The weights are the **renormalised** weights (`explainability.js:551-565`), so unavailable sources show 0 % weight and an "Evidence not available" panel with the stored reason, not a zero score (`ScoreBreakdown.jsx:166-168`).
- Evidence items: metric bars (`value*100` %, `display` text, `note`, `weight_within_factor`) and skill-set badge lists (`:59-117`).
- Skill table: Evidenced / Not found / Claimed only, plus "x of y sources" (`:173-210`).
- Flags: shown if available. Otherwise an honest "Inconsistency detection not available" with the stored reason (`:268-293`). Flags are never computed upstream (`flags_available: false` at `explainability.js:637`, `:648`).
- If the explanation is missing, it shows "No score explanation stored ... Re-run the analysis" (`ScoreBreakdown.jsx:215-222`). That is honest, but the advice cannot be followed from the UI (§2.9).
- The assessment fold-in rebuilds `composite_score`, `subscores`, `explanation` and `evidence_limited` together (`backend/Controllers/assessment.controller.js:498-506`), so the breakdown stays consistent with the composite after an assessment (READ).

### 8.3 Does every number trace to a backend value?
- **Yes, directly:** `credibilityScore`, factor values, weights, contributions, evidence metrics, skill-evidence counts, flags, `matchLevel`, `evidenceLimited`.
- **Derived in the browser (CALC), from backend values:** the recruiter Dashboard average (`:218-220`), the 7-day chart (`:136-161`; labelled "Applications scored" but bucketed on score creation time), the skill-evidence summary percentages (`:168-184`, `:338`), "N of M required skills evidenced" (`JobDetails.jsx:49`), and all score colour bands (80/60, frontend-only).
- **Not traceable / fallback values:**
  - `Results.jsx:155` turns a missing score into **0**.
  - `Results.jsx:190-191` shows an HC summary sentence when `explanation.summary` is absent.
  - `CandidateModal` "location" is actually the job location (backend `analysis.controller.js:98`).
  - The name falls back to "Candidate".
  - In AllCandidates a null score renders blank in red.
  - Everything on Landing and Recruiter Profile is HC (§7).
- **In a UI-only demo, no score is ever produced** (§2.9), so none of the explainability UI renders with data unless scores are created out-of-band, for example by calling `/api/analyze` directly.

---

## 9. State of the UI code

### 9.1 Styling approach (READ)
- Tailwind v3 utilities with a custom colour palette in hex (`tailwind.config.js:8-69`), plus global component classes in `index.css` (`.card`, `.text-h1..caption`, `.btn-primary`, legacy dark-theme classes). Some inline `style` and SVG attributes. framer-motion is used on almost every element.
- **Inconsistent:**
  - Typography mixes `.text-h1/.text-body-sm` and raw `text-2xl/text-sm`.
  - Buttons mix the unused `Button` component (used only in Assessment), the `.btn-primary` class and ad-hoc `bg-primary` utilities.
  - `accent-purple`, `accent-cyan` and `accent-pink` are all mapped to near-black (`tailwind.config.js:29-32`, `index.css:8-10`). The legacy "accent" styling now renders as black, which causes the CreateJob black-on-black controls.

### 9.2 Undefined classes (READ, VERIFIED by V4 for CSS variables)
- `btn` (`Assessment.jsx:186`, `recruiter/Dashboard.jsx:433`, `JobDetails.jsx:159`) is undefined. Only `.btn-primary` exists (`index.css:145-155`, with `padding: 1rem 2rem`).
- `badge` and `badge-primary` (`Assessment.jsx:350-356`) are undefined, so those render as unstyled inline text.

### 9.3 CSS custom properties that do not exist (VERIFIED V4 + READ)
- SVG and chart colours use `hsl(var(--border))`, `hsl(var(--primary))`, `hsl(var(--muted-foreground))`, `hsl(var(--muted))`, `hsl(var(--background))`, `hsl(var(--foreground))` and `hsl(var(--${tone}))`. Sites: `Landing.jsx:90,99`; `Processing.jsx:58,66`; `Results.jsx:45,51`; `CandidateModal.jsx:43,49`; `recruiter/Dashboard.jsx:304-316`.
- **None of these variables is defined** (`index.css:7-13` defines only `--accent-*` and `--glow-intensity`; the compiled CSS has none).
- Expected effect: the score-ring arcs and background circles get an invalid `stroke` and are likely **not drawn** (the number still shows); the recharts bars and grid fall back to SVG defaults. **Exact rendering UNKNOWN; needs a browser check.** If confirmed, this is the most visible defect on the recruiter's audit view and the candidate Results page.

### 9.4 Loading, empty and error states (READ)
- **Good:** Results, JobDetails, Assessment, CandidateJobs, Upload, Admin.
- **Weak:**
  - Recruiter Dashboard and AllCandidates turn API errors into empty lists ("No candidates scored yet"), hiding outages (`recruiter/Dashboard.jsx:200-204`, `AllCandidates.jsx:21-27`).
  - Notifications ignores non-OK responses (`Notifications.jsx:18-20`).
  - Upload treats a status failure as "No resume" (`Upload.jsx:106-107`).
  - Errors use `alert()` in 10 places across Login, CreateJob, AllCandidates and both Profiles.
- Accessibility is partial: `aria-*` labels in recruiter components; icon-only buttons in AllCandidates use `title` only.

### 9.5 Broken flows visible from reading the code (READ)
1. No path from candidate actions to a credibility score (§2.9, §2.12).
2. Recruiter Profile is always "unavailable" (§2.20).
3. Notifications "Mark read" corrupts the list (§2.14).
4. Resend-confirmation sends an empty email (§2.3).
5. "Skip Verification" does not skip (§2.3).
6. Admin suspension visually reverts on tab switch (§2.6).
7. JobDetails drops multi-job candidates (§2.18).
8. AllCandidates status filter never matches; null scores render blank (§2.19).
9. CreateJob primary buttons are black-on-black, and Jobs / Profile text is white-on-white (§2.17, §2.21).
10. Assessment answers are lost on reload despite the "resumed" copy (§2.15).
11. The Results page is unlinked; the candidate "Dashboard" is marketing copy (§2.7, §2.10).
12. `/candidate` and `/recruiter` have no index route, so they show an empty body.
13. There is no 404 route.

---

## 10. Tests (VERIFIED V2, V5; READ)

- **No frontend unit or component tests exist.** No `*.test.js(x)`, no `setupTests.js` in `frontend/`, and no `tests/frontend/` directory (V5). `react-scripts test` is configured (`package.json:25`) but has nothing to run.
- **The only automated frontend check** is the `frontend` suite in `tests/run-suite.ps1:186-192`: `CI=true npm run build`. It **fails at HEAD** (V2: 9 lint warnings treated as errors).
- **Manual:** `tests/MANUAL_SMOKE.md` (last changed `3b29a9f`, 2026-11-05) has 16 browser steps (C1-C16) covering login, upload, apply, notifications, results, the recruiter dashboard and reset. Its own expected results record "(no score)" on Results and the recruiter dashboard (C10, C12).
- `tests/gateway/*.test.mjs` exercise the gateway, not the UI.
- Explainability rendering (`ScoreBreakdown`), the JobDetails filters and the evidence-limited display have **never been tested** with data. AUDIT names the would-be tests (`tests/frontend/*.test.jsx`, AUDIT 5.6, 5.10, 5.11), and none exist.

---

## Docs contradicted by code

| Doc claim | Code at HEAD |
|---|---|
| `AUDIT.md:66`: "candidate Processing and Assessment pages are unreachable" | Assessment is routed (`App.jsx:65`) and in the candidate nav (`CandidateLayout.jsx:16`). Only Processing is unreachable. |
| `AUDIT.md:133` and `:237`: Assessment is "a UI shell", calls routes "which do not exist", "falls back to a static MOCK_QUESTIONS", "not routed" | The routes exist (`backend/Routes/assessment.routes.js:9-10`); `grep -i mock frontend/src` gives 0; routed at `App.jsx:65`. (AUDIT `:138` and `:178` already say otherwise, so AUDIT contradicts itself.) |
| `AUDIT.md:172`: `GET /api/recruiter/applicants` "exists but no frontend file calls it" | `AllCandidates.jsx:20` calls it (AUDIT `:190` itself says so). |
| `AUDIT.md:179`: "the only callers of /candidate/results are Processing.jsx:201 and Assessment.jsx:112, and nothing navigates to either" | Assessment has no `navigate` at all (grep count 0) and is nav-linked. Processing is the only caller of `/candidate/results`. |
| `CODE_MAP.md:532`, `:566`, `:571`: Assessment not routed, mock questions, navigates to results; Button imported only by an "orphan" | All stale (see above). |
| `CODE_MAP.md:535`: dead `SkillsSelector` in `Upload.jsx` | Gone (`grep SkillsSelector` gives 0). |
| `CODE_MAP.md:538`: the Jobs "View" link is broken because it uses `job._id` | The backend sends an `_id` alias (`backend/Controllers/jobs.controller.js:7`), so the link resolves. The "0 Applications Total" part is still true. |
| `ARCHITECTURE.md:37`: "We don't have an API gateway yet ... The browser calls only Express (port 5000)" | A gateway exists and defaults to 5000 (`gateway/index.js:14`); the backend defaults to 5001 (`backend/index.js:22`; `backend/.env` sets no PORT). The browser calls the gateway. (ARCHITECTURE's as-is section is pinned to an older verified-at commit.) |
| `STEPS_TO_RUN_APP.md:28`: set `VITE_API_BASE_URL` for the frontend | CRA reads only `REACT_APP_*`. 14 files read `REACT_APP_API_BASE_URL`. The one `VITE_` read (`AllCandidates.jsx:8`) compiles to a literal (V3), so the documented variable does nothing. |
| `tests/BASELINE_RESULTS.md:36`: 6 ESLint warnings fail the CI build | That was the baseline commit. HEAD has 9 (V1), and the build still fails (V2). |
| `REBUILD/KICKOFF.md:10`: "React (Vite) frontend" | CRA `react-scripts 5.0.1` (`package.json:16`). |

---

## Top risks for the rebuild (ordered by damage to a live demo or a correctness review)

1. **No UI path produces a credibility score.** Upload only stores the file, Apply only inserts an application, and the sole scoring call (`Processing.jsx:175`, `/api/analyze`) has no reachable caller since `71c632d`. In a live demo the recruiter dashboard, JobDetails, CandidateModal / ScoreBreakdown and candidate Results all show empty states, and the Assessment's "counts toward your credibility score" has no score row to fold into.
2. **Fabricated content on screen:**
   - Landing: 10,000+ / 500+ / 95 % / 4.9/5 / "Trusted by 500+ companies", demo score 82, stock avatars.
   - CreateJob: random "AI Suggestion" with canned text, and the "3x" claim.
   - Recruiter Profile: "5 Jobs Posted" / "2 Candidates Hired".
   - Jobs: "0 Applications Total" on every card.
   - Recruiter bell with a permanent unread dot, and a dead search box.

   All of this breaks the rebuild's no-faked-data rule and is easy for an evaluator to spot.
3. **The score visualisation may not render.** Rings and charts use undefined CSS variables (`hsl(var(--border|primary|success…))`, VERIFIED absent from the compiled CSS), so the ring arcs on Results and CandidateModal are likely invisible. Needs a browser check before deciding.
4. **Unreadable controls:** black-on-black primary buttons and progress steps on CreateJob (the only way to create a job), and white-on-white titles on Recruiter Jobs and Profile. Recruiter job creation is a core demo step.
5. **Contradicting recruiter data sources.** `/api/candidates` (score rows, one per candidate across jobs) vs `/api/recruiter/applicants` (applications): JobDetails drops candidates scored for another job, AllCandidates is unlinked, its status filter never matches (`submitted` vs `applied`), null scores render blank, and there is no shortlist / reject UI although the backend has it, so candidate notifications can never be generated.
6. **Broken pages:** Recruiter Profile always "unavailable" (role case); Notifications "Mark read" corrupts state; Login "Resend confirmation" always sends an empty email; "Skip Verification" sends the data anyway; Admin suspension visually reverts on tab switch; Results reachable only by typed URL; the candidate "Dashboard" is static marketing copy.
7. **The repo's own frontend suite is red** (`CI=true` build fails on 9 lint warnings, VERIFIED). There are zero frontend tests, so explainability UI, filters and evidence-limited display have never run against data.
8. **Fragile, inconsistent API wiring:** 14 copy-pasted env fallbacks, 2 hardcoded literals (ResetPassword, CreateJob), 1 Vite-only `import.meta.env` (AllCandidates), and four credential mechanisms including a global `window.fetch` monkey-patch. Pointing `REACT_APP_API_BASE_URL` at any other origin (deployment, split ports) silently breaks password reset, job creation (no cookie, so a 401 is likely) and the applicants page. The run guide documents the wrong variable name.
9. **Stack mismatch to decide early.** The brief says Vite; the code is CRA 5 (deprecated toolchain) with a stray Tailwind v4 Vite plugin next to Tailwind v3, two theme generations, ~20 dead CSS classes and 4 never-imported components. Any migration touches every file's env access.
10. **Assessment UX vs GR-1:** no client-side anti-cheat at all (no timer, no visibility or paste detection); candidates can assess against jobs they never applied to; in-progress answers are lost on reload despite the "resumed" copy.
