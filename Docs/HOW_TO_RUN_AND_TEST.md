# How to run and test Patina (assessment + whole stack)

> Windows PowerShell. Repo root in all commands: `C:\Users\Aditya\skill_validation_system\Patina`
> (adjust the path). Keep one terminal per service — do NOT kill the ports
> while testing.

## 1. Start the services (in this order)

| # | Service | Port | Directory | Command |
|---|---------|------|-----------|---------|
| 1 | NLP resume parser | 8000 | `nlp-engine` | .\venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 |
| 2 | Assessment (quiz LLM) | 8002 | `assessment-service` | `.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8002` |
| 3 | Backend API | 5000 | `backend` | `node index.js` |
| 4 | Frontend | 3000 | `frontend` | `npm start` → open http://localhost:3000 |

Config each service needs (already in place, git-ignored):

- `backend/.env` — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `assessment-service/.env` — `OPENROUTER_API_KEY`, `OPENROUTER_FREE_MODELS=openrouter/free`,
  `ASSESSMENT_REQUEST_TIMEOUT_SECONDS=240`, `ASSESSMENT_MAX_RETRIES_PER_MODEL=3`

Health check (any terminal):

```powershell
foreach ($p in 8000,8002,5000,3000) { $up = (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) -ne $null; "port ${p}: $(if ($up) {'UP'} else {'DOWN'})" }
try { (Invoke-WebRequest http://127.0.0.1:8002/openapi.json -UseBasicParsing -TimeoutSec 5).StatusCode } catch { "8002 down" }
```

Expected: all four UP, `8002 → 200`. (`GET /api/auth/me → 401` on the
backend means "up but logged out" — that is normal.)

## 2. Test the quiz in the UI (~5 min, free LLM is slow)

1. Log in as a **candidate** → **Upload** → upload a PDF/DOCX resume.
2. **Jobs** → open a published job → **Take assessment**
   (or `/candidate/assessment?jobId=<id>`).
3. Wait on *"Generating your assessment"* — **2–4 min, do not refresh**.
4. Answer → **Submit** → score % + per-question feedback.
   Your **latest** attempt counts toward the credibility score.
5. **Retake assessment** (score screen) → fresh questions.
   Up to **5 attempts per job**; the 6th shows *"used all 5 attempts"*
   with your latest score.
6. Recruiter dashboard shows the assessment pillar for the candidate.

Quiz rule: questions are generated from the **job description + the stored
NLP parse of your resume** — uploading once is enough, never re-upload.

## 3. Test via API (PowerShell)

```powershell
$u = "candidate_username"; $pw = "password"
$login = Invoke-WebRequest http://localhost:5000/api/auth/login -Method POST `
  -ContentType "application/json" -Body (@{username=$u;password=$pw} | ConvertTo-Json) -SessionVariable s
# Generate (waits up to ~5 min for the LLM)
$gen = Invoke-WebRequest http://localhost:5000/api/assessment/generate -Method POST `
  -ContentType "application/json" -Body (@{jobId="<job-uuid>"} | ConvertTo-Json) -WebSession $s -TimeoutSec 300
($gen.Content | ConvertFrom-Json).assessmentId
# Evaluate (answer at least one question; MCQ-only answers grade instantly)
$eval = Invoke-WebRequest http://localhost:5000/api/assessment/evaluate -Method POST `
  -ContentType "application/json" `
  -Body (@{assessmentId="<id>"; answers=@(@{question_id="<q1>"; response="A"})} | ConvertTo-Json) `
  -WebSession $s -TimeoutSec 180
$eval.Content
```

## 4. Automated tests

```powershell
node --test tests/backend/assessment-generate.smoke.mjs   # no credentials needed (401 guards)
.\tests\run-suite.ps1                                     # full harness (backend tier shown above)
node tests/docs/check-trackers.mjs                        # AUDIT/CHECKLIST consistency
```

The `live-*.test.mjs` tests need `tests/.env` (copy `tests/.env.example`;
usernames must start with `t0001_`); they skip without it.

## 5. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `generate → 502 "service is unavailable"` | :8002 down → start assessment service (§1) |
| `generate → 502 "generation failed"` | free-model 429/rate-limit or slow LLM → wait 1–2 min, retry; service terminal shows `Recent failures:` |
| `generate → 400 "Upload a resume first"` though uploaded | :8000 down, or a foreign process on :8000 → verify with the NLP check below, restart real parser |
| NLP `/parse → 401` | that is NOT our parser — kill the squatter on :8000, start `nlp-engine` (§1) |
| Port already in use (`10048` / uvicorn won't bind) | free it: `Get-NetTCPConnection -LocalPort 8000 -State Listen \| % { Stop-Process -Id $_.OwningProcess -Force }` (same for 3000/5000/8002) |
| Quiz takes minutes | normal on the free tier; backend aborts at 5 min |
| Console `api/auth/me → 401` | normal when logged out |
| `logo192.png` manifest error | cosmetic, ignore |

NLP identity check (must print `HTTP 200` + skills — if not, :8000 is a squatter):

```powershell
node -e "const fs=require('fs');(async()=>{const b=fs.readFileSync('tests/fixtures/f1_dev_github.pdf');const f=new FormData();f.append('resume',new Blob([b],{type:'application/pdf'}),'f1.pdf');f.append('jd','Need JavaScript and Node.js developer');f.append('required_skills',JSON.stringify(['JavaScript']));f.append('preferred_skills',JSON.stringify([]));const r=await fetch('http://127.0.0.1:8000/parse',{method:'POST',body:f});console.log('HTTP',r.status)})()"
```

Free-model note: OpenRouter retires `:free` slugs regularly. If generation
keeps 502ing, list live slugs with
`https://openrouter.ai/api/v1/models` (filter ids ending `:free`) and update
`OPENROUTER_FREE_MODELS` in `assessment-service/.env`, then restart :8002.
