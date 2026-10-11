# Manual browser smoke test (T-0001)

The flow you check yourself: **login → upload → result → recruiter view**.
It writes real rows to the shared Supabase project, so it uses **only** the
`t0001_cand` / `t0001_recr` test accounts and ends with a sweep.

"Expected" columns are predictions from reading the code at each revision,
not observed behaviour. Write what you actually see in "Observed".

## Before you start (both targets)

1. `tests/.env` is filled in (copy `tests/.env.example`). Both accounts exist
   and have confirmed their email.
2. Use a **separate browser profile or an incognito window per target**.
   Cookies on `localhost` ignore the port, so a baseline session and a current
   session in the same profile overwrite each other's `patina_session`.
3. Only one target at a time on the default ports. Baseline uses its own ports
   and can run beside current.
4. Seed the test job (both targets read the same DB):
   `node tests/backend/sweep.mjs --seed-job`. Note the printed job id.

---

## A. Baseline (`../patina-baseline`, 32905c1): 3100 / 5100 / 8100

Start (three terminals, from the repo root):
```powershell
# 1  NLP
cd ..\patina-baseline\nlp-engine; $env:PYTHONHASHSEED='0'; ..\..\Patina\nlp-engine\venv\Scripts\python -m uvicorn app.main:app --port 8100
# 2  backend (port 5100 comes from the worktree's backend\.env)
cd ..\patina-baseline\backend; node index.js        # expect "Server running on http://localhost:5100"
# 3  frontend (REACT_APP_API_BASE_URL=http://localhost:5100 is in the worktree's frontend\.env)
cd ..\patina-baseline\frontend; $env:PORT='3100'; npm start
```

| # | Step | Expected (baseline) | Observed |
|---|---|---|---|
| A1 | Open `http://localhost:3100/login`, sign in as `t0001_cand` | Redirect to a candidate page; no error toast | Expection was meet |
| A2 | Go to `http://localhost:3100/candidate/upload` | **Predicted failure:** the Position area shows "Failed to fetch jobs". `Upload.jsx:121` fetches the hardcoded `http://localhost:5000/api/jobs` without `credentials:'include'`, and `GET /api/jobs` needs a session (`jobs.routes.js:11`). If you see this, record it and skip to A5. | Prediction confirmed in part. Select Job shows “Failed to fetch”; Analyze Resume stays disabled. Network tab: GET http://localhost:5000/api/jobs → (failed) net::ERR_CONNECTION_REFUSED. The hardcoded port is confirmed. The missing-credentials part is not tested, because nothing listens on 5000 in this setup. A3–A4 skipped. |
| A3 | *(Only if positions load)* Pick "[T-0001 TEST] harness job", choose `tests/fixtures/f1_dev_github.pdf`, submit | Navigates to `/candidate/processing`, then to `/candidate/results` | |
| A4 | Results page | "Your credibility score" with a number, plus skills and explanation (`Results.jsx`, data from `/api/candidate-analysis`) | |
| A5 | Sign out. Sign in as `t0001_recr`, open `/recruiter/dashboard` | Dashboard loads (`/api/candidates`, `/api/jobs/mine`). If A3 ran, `t0001_cand` appears with a Score. | Successfully signed in but since Upload failed there is no data |
| A6 | `/recruiter/jobs`, open "[T-0001 TEST] harness job" (`/recruiter/jobs/:id`) | The job's details render | The Jobs page was empty with only a create job button. There was no listing. This could be because I forgot to run node tests/backend/sweep.mjs --seed-job before my smoke test |
| A7 | Clean up: `node tests/backend/sweep.mjs` | Prints `remaining:` with every count `0`; exit code 0 | |

---

## B. Current (this repo, HEAD): 3000 / 5000 / 8000

Start:
```powershell
cd nlp-engine; venv\Scripts\python -m uvicorn app.main:app --port 8000
cd backend; node index.js                                   # port 5000
cd frontend; npm start                                      # port 3000
```

| # | Step | Expected (HEAD) | Observed |
|---|---|---|---|
| B1 | `http://localhost:3000/login`, sign in as `t0001_cand` | Lands on `/candidate/dashboard` | |
| B2 | `/candidate/upload` | "Checking your resume..." then "No resume uploaded yet" (`/api/resume/status`) | |
| B3 | Upload `tests/fixtures/f1_dev_github.pdf` | **Predicted failure:** "Could not upload your resume." `/api/resume/upload` returns 500, `path is not defined` (ISSUES I-0009). | |
| B4 | `/candidate/jobs`, open "[T-0001 TEST] harness job" (`/candidate/jobs/:id`), try Apply | Apply is blocked or fails, since no resume was stored (B3) | |
| B5 | There is no results route at HEAD (`Results.jsx` is unrouted; Processing goes to `/candidate/dashboard`) | Dashboard shows no score for this job | |
| B6 | Sign out. Sign in as `t0001_recr`, open `/recruiter/dashboard` | Loads (`/api/recruiter/applicants`, `/api/jobs/mine`, `/api/jobs/applications`). No applicant for the test job. | |
| B7 | Clean up: `node tests/backend/sweep.mjs` | Every count `0`; exit code 0 | |

---

If any sweep reports a non-zero count, or a guard error, stop and don't
delete anything by hand. The guard means something other than the test
accounts would have been touched.
