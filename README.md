# Patina

Patina is an evidence-based hiring platform for technical roles. It helps candidates present credible evidence of their skills and gives recruiters a clearer view of fit than keyword-only resume review.

> **Status:** active development. The interface, API foundation, local NLP parsing flow, and Supabase connectivity are in place. Persistent database tables and their application integration are the next milestone.

## Business overview

### The problem

Keyword-based hiring workflows can make it hard to distinguish verified technical capability from resume inflation. Candidates also need a better way to show the work behind their claims.

### The product

Patina brings resume analysis, job-fit signals, and technical evidence into a candidate profile that recruiters can review. The intended flow is:

1. A candidate signs up, uploads a resume, and explores suitable roles.
2. Patina extracts structured resume information and compares it with a selected job description.
3. GitHub signals, when available, support skill verification.
4. Recruiters review candidates, skills, match signals, and evidence in one dashboard.

### Product scope

Patina currently focuses on technical and coding roles. The product direction includes evidence-based skill validation, GitHub-backed verification, and structured technical assessments. Degree verification and broad soft-skill validation are outside the current scope.

## Current implementation

This section is the source of truth for the current repository. Update it whenever a commit changes runtime behavior, architecture, dependencies, routes, or delivery status.

| Area | Status | Notes |
| --- | --- | --- |
| Candidate and recruiter UI | Implemented | React routes and role-specific screens are available. |
| Resume upload and analysis | Implemented locally | Express forwards a resume and job description to the FastAPI NLP service. |
| Resume parsing and job matching | Implemented locally | The NLP service extracts text/entities and produces semantic matching signals. |
| GitHub language lookup | Implemented | Used as an additional skill-verification signal when a GitHub account is available. |
| Authentication and job creation | Prototype | Users and jobs are held in application memory; they do not persist across server restarts. |
| Supabase connectivity | Verified | The backend has an authenticated Supabase client, but no tables or controller reads/writes are wired yet. |
| Persistent data model | Next | Supabase tables, policies, and backend data access will replace in-memory stores. |
| LLM technical assessments | Planned | Not implemented in the current runtime. |

## Architecture

```text
React frontend (port 3000)
        |
        v
Express API (port 5000)
        |---------------------> Supabase (connection configured; tables pending)
        |
        +---------------------> FastAPI NLP service (port 8000)
                                      |
                                      v
                         Resume extraction, entities, semantic matching
```

| Layer | Technology |
| --- | --- |
| Frontend | React, React Router, Tailwind CSS, Framer Motion, Recharts |
| Backend | Node.js, Express, Passport, Express Session |
| Database platform | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| NLP service | Python, FastAPI, spaCy, Sentence Transformers, pdfplumber, python-docx |
| External data | GitHub API integration |

## Repository structure

```text
Patina/
??? frontend/                 # React application
?   ??? src/
?       ??? components/       # Reusable UI and layouts
?       ??? context/          # Shared React state
?       ??? data/             # Temporary/mock UI data
?       ??? pages/            # Public, candidate, and recruiter screens
??? backend/                  # Express API
??? nlp-engine/               # FastAPI resume parsing service
??? Docs/                     # Supporting architecture/research documentation
??? README.md                 # Product and technical project documentation
```

## Local setup

### Prerequisites

- Node.js 18 or newer
- Python 3.11 or compatible
- A Supabase project for the backend environment variables

### Backend

```bash
cd backend
npm install
```

Create `backend/.env` from `backend/.env.example` and provide real values:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# Optional unless a backend feature specifically requires it
SUPABASE_ANON_KEY=your-anon-key

PORT=5000
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=replace-with-a-long-random-value
```

Start the API:

```bash
npm run dev
```

### NLP service

```bash
cd nlp-engine
venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app.main:app --reload --port 8000
```

On macOS/Linux, activate with `source venv/bin/activate`. The NLP environment belongs in `nlp-engine/venv`; do not create another virtual environment at the repository root.

### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend runs at `http://localhost:3000`, the API at `http://localhost:5000`, and the NLP service at `http://localhost:8000`.

## API surface

| Method | Endpoint | Current behavior |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Creates an in-memory candidate or recruiter account and starts a session. |
| `POST` | `/api/auth/login` | Authenticates a local prototype account and starts a session. |
| `GET` | `/api/auth/me` | Returns the authenticated session user. |
| `POST` | `/api/auth/logout` | Ends the current session. |
| `GET` | `/api/jobs` | Returns jobs from the in-memory job store. |
| `POST` | `/api/jobs` | Creates a job in the in-memory job store. |
| `POST` | `/api/analyze` | Sends an uploaded resume to the NLP service for the selected job. |
| `GET` | `/api/candidate-analysis` | Returns the most recent in-memory analysis. |
| `GET` | `/api/candidates` | Returns analyses created since the server started. |
| `POST` | `/api/parse` | Proxies a resume and job description directly to the NLP service. |
| `GET` | `/api/health` | Returns API health information. |

## Supabase and security

The backend connector is `backend/Config/supabase.js`. It reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `backend/.env`.

The service-role key must never be exposed to the frontend or committed to Git. `backend/.env` is ignored; `backend/.env.example` is the safe, tracked template. Connectivity has been verified with a read-only Auth API request. Database tables, Row Level Security policies, and application queries have not yet been created.

## Development notes

- `node_modules`, virtual environments, generated frontend builds, uploads, and local `.env` files are intentionally ignored by Git.
- Some mock and in-memory data remains while the persistent Supabase schema is introduced. It is prototype data, not production storage.
- The frontend production build succeeds. Existing lint warnings for unused variables do not prevent the build.

## Documentation maintenance policy

Keep the **Business overview** stable unless the product decision itself changes. In the same commit, update the relevant items below whenever implementation changes:

1. **Current implementation** for capability status and scope.
2. **Architecture** for a changed service, data flow, or system boundary.
3. **Repository structure** for important ownership or folder changes.
4. **Local setup / environment variables** for changed setup or configuration.
5. **API surface** for added, removed, or changed endpoints.

For a feature-sized commit, add a concise dated entry below.

### Change log

- **2026-08-23** ? Added the Supabase backend client and environment template; verified server-side connectivity. Persistent tables and application queries are pending.
- **2026-08-23** ? Reorganized frontend route screens into `pages/public`, `pages/candidate`, and `pages/recruiter`; moved reusable UI into `components`.
- **2026-08-23** ? Removed the unused local PostgreSQL connector and `pg` dependency.

## Next milestone

Design and create the Supabase schema, apply Row Level Security policies, and replace the backend's in-memory authentication, jobs, and analysis stores with Supabase-backed queries.
