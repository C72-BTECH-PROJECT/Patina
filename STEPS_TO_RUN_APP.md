# Steps to Run the App (Patina + Gateway)

## 1. Install dependencies
```powershell
cd C:\Users\Aditya\skill_validation_system\Patina
cd backend; npm install; cd ..
cd gateway; npm install; cd ..
cd nlp-engine; python -m venv venv; .\venv\Scripts\pip install -r requirements.txt; cd ..
cd github-evidence; python -m venv venv; .\venv\Scripts\pip install -r requirements.txt; cd ..
cd assessment-service; python -m venv venv; .\venv\Scripts\pip install -r requirements.txt; cd ..
```

## 2. Create .env files (copy .env.example -> .env and fill values)

backend/.env:
```
PORT=5001
SESSION_SECRET=dev-session-secret
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY=YOUR_ANON_KEY
NLP_PARSE_URL=http://localhost:8000/parse
FRONTEND_URL=http://localhost:3000
```

frontend/.env:
```
VITE_API_BASE_URL=http://localhost:5000
```

gateway/.env:
```
PORT=5000
CORE_URL=http://localhost:5001
NLP_URL=http://localhost:8000
GITHUB_EVIDENCE_URL=http://localhost:8001
ASSESSMENT_URL=http://localhost:8002
FRONTEND_URL=http://localhost:3000
FRONTEND_BUILD_DIR=
GLOBAL_RATE_LIMIT_MAX=300
GLOBAL_RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_MAX=20
AUTH_RATE_LIMIT_WINDOW_MS=900000
PASSWORD_RESET_RATE_LIMIT_MAX=5
PASSWORD_RESET_RATE_LIMIT_WINDOW_MS=900000
```

github-evidence/.env (or set $env:GITHUB_TOKEN):
```
GITHUB_TOKEN=YOUR_GITHUB_PAT
```

assessment-service/.env:
```
OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY
OPENROUTER_FREE_MODELS=openrouter/free
ASSESSMENT_MAX_RETRIES_PER_MODEL=2
ASSESSMENT_REQUEST_TIMEOUT_SECONDS=60
```

tests/.env:
```
TEST_CANDIDATE_USERNAME=t0001_cand
TEST_CANDIDATE_PASSWORD=pass123
TEST_RECRUITER_USERNAME=t0001_recr
TEST_RECRUITER_PASSWORD=pass123
```

## 3. Start services (each in its own terminal)

Terminal 1 - NLP:
```powershell
cd C:\Users\Aditya\skill_validation_system\Patina\nlp-engine
$env:PYTHONHASHSEED='0'; $env:HF_HUB_OFFLINE='1'; $env:TRANSFORMERS_OFFLINE='1'
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2 - github-evidence:
```powershell
cd C:\Users\Aditya\skill_validation_system\Patina\github-evidence
$env:GITHUB_TOKEN="YOUR_GITHUB_PAT"
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Terminal 3 - assessment-service (optional):
```powershell
cd C:\Users\Aditya\skill_validation_system\Patina\assessment-service
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002
```

Terminal 4 - core:
```powershell
cd C:\Users\Aditya\skill_validation_system\Patina\backend
$env:PORT='5001'
node index.js
```

Terminal 5 - gateway:
```powershell
cd C:\Users\Aditya\skill_validation_system\Patina\gateway
$env:PORT='5000'; $env:CORE_URL='http://localhost:5001'; $env:NLP_URL='http://localhost:8000'; $env:GITHUB_EVIDENCE_URL='http://localhost:8001'; $env:ASSESSMENT_URL='http://localhost:8002'; $env:FRONTEND_URL='http://localhost:3000'
node index.js
```

Terminal 6 - frontend:
```powershell
cd C:\Users\Aditya\skill_validation_system\Patina\frontend
npm start
```

## 4. Run tests
```powershell
cd C:\Users\Aditya\skill_validation_system\Patina
node --test "tests/gateway/*.mjs"
node --test tests/gateway/live-gateway.test.mjs
powershell -File tests\run-suite.ps1 -Target current -Suites backend
node tests\docs\check-trackers.mjs
git grep -n "8001" -- gateway
```

## 5. Manual smoke
Open http://localhost:3000 — login as candidate/recruiter, upload resume, apply, analyze.

## 6. Stop all services
```powershell
foreach ($port in 8000,8001,8002,5000,5001) {
  $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  foreach ($c in $conn) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
}
```