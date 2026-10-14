# Assessment Service

Generates role-specific technical assessments for a candidate/job pair using an
LLM, and returns two separate artifacts:

- **Candidate questions** — safe to show to the candidate.
- **Answer key** — correct options, explanations, ideal answers, and key points.

The service is a standalone FastAPI app. It is deliberately isolated from
`backend/` and `nlp-engine/` so the assessment logic can evolve independently.

> Status: newly added, not yet wired into the backend/frontend or tracked in
> `AUDIT.md`/`CHECKLIST.md`. Treat this README as a description of the code as it
> exists in this folder.

---

## 1. Where it fits

```
Frontend  →  Backend (Node/Express)  →  Assessment Service (FastAPI)  →  OpenRouter
                                              ▲
                        resume/job/GitHub evidence passed in the request
```

The service is **stateless**. It receives all needed context (job, resume,
skills, optional GitHub evidence) in the request body and returns the generated
assessment. It does not read from or write to the database.

---

## 2. Directory layout

```
assessment-service/
├── app/
│   ├── __init__.py        # package marker
│   ├── config.py          # env loading, model list, timeouts, constants
│   ├── schemas.py         # Pydantic request/response models + validation
│   ├── prompts.py         # prompt builder + PROMPT_VERSION
│   ├── llm_client.py      # OpenRouter client, model fallback + retries
│   ├── validators.py      # shape/consistency checks on generated output
│   ├── generator.py       # orchestration: prompt → LLM → validate → shuffle
│   └── main.py            # FastAPI app and HTTP endpoints
├── tests/                 # reserved for tests (currently empty)
├── .env.example           # template for required environment variables
├── .env                   # local secrets (git-ignored)
└── requirements.txt       # Python dependencies
```

---

## 3. How a request is processed

Entry point: `app/main.py` → `generate_assessment()` in `app/generator.py`.

1. **Input normalization** (`generator.py:69`) — the request is coerced through
   the `AssessmentInput` Pydantic model. If `include_github` is false,
   `github_data` is forced to `None` (`generator.py:76`).
2. **ID + prompt** — a UUID `assessment_id` is created and the prompt is built
   from the trusted context (`prompts.py:7`).
3. **Generation loop** (`generator.py:84`) — up to `MAX_RETRIES_PER_MODEL`
   attempts. If a previous attempt failed validation, the errors are appended to
   the prompt and the model is asked to correct itself (`generator.py:87`).
4. **LLM call** (`llm_client.py:26`) — tries each configured model in order,
   with per-model retries and exponential backoff, until valid JSON is returned.
5. **Validation** (`validators.py:18`) — enforces exactly 20 questions, the
   10 MCQ / 10 short-answer split, ID set `q1..q20`, matching answer entries,
   and correct field types per question type.
6. **MCQ option shuffle** (`generator.py:13`) — options are shuffled so the
   correct answer position is not predictable; the answer key's `correct_option`
   label is remapped and re-checked to prove the correct text did not move.
7. **Return** — `(questions_json, answers_json)`.

---

## 4. HTTP API

### `GET /`

Health check.

```json
{ "service": "Patina AI Assessment Service", "status": "healthy" }
```

### `POST /generate-assessment`

Accepts an `AssessmentInput` body (see §5). Returns:

```json
{
  "questions": { "assessment_id": "...", "questions": [ ... 20 items ... ] },
  "answer_key": { "assessment_id": "...", "answers": [ ... 20 items ... ] }
}
```

Error handling (`main.py:39`):

| Failure | Status | Body |
| --- | --- | --- |
| All models failed / invalid after retries | `502` | the `AssessmentLLMError` message |
| Any other exception | `500` | `"Assessment generation failed. Check service logs."` |

> Security note (`main.py:32`): this endpoint returns the **answer key** to the
> caller for development convenience. In production the answer key must stay
> server-side and only `questions` should be exposed to the candidate.

---

## 5. Request schema — `AssessmentInput` (`schemas.py:6`)

| Field | Type | Required | Limits / default |
| --- | --- | --- | --- |
| `candidate_id` | str | yes | 1–128 chars |
| `job_id` | str | yes | 1–128 chars |
| `job_title` | str | yes | 1–200 chars |
| `job_description` | str | yes | 1–12000 chars |
| `required_skills` | list[str] | no | max 50 |
| `preferred_skills` | list[str] | no | max 50 |
| `resume_text` | str | yes | 1–20000 chars |
| `resume_skills` | list[str] | no | max 100 |
| `resume_projects` | list[dict] | no | max 30 |
| `experience_level` | str | no | default `"unspecified"`, max 100 |
| `include_github` | bool | no | default `false` |
| `github_data` | dict \| null | no | used only if `include_github` is true |

---

## 6. Output shapes (`schemas.py`)

### Questions (`AssessmentQuestions`)

Metadata: `assessment_id`, `candidate_id`, `job_id`, `model_used`,
`prompt_version`, and exactly 20 `questions`.

Each question has `question_id` (`q1`–`q20`), `question_type`
(`mcq` / `short_answer`), `question`, `skill`, `source`
(`jd` / `resume` / `github`). MCQs also have exactly four options labelled
`A`–`D` with unique text.

### Answer key (`AssessmentAnswerKey`)

`assessment_id` + exactly 20 `answers`, linked by `question_id`:

- MCQ answer: `correct_option` (`A`–`D`) + `explanation`.
- Short-answer key: `ideal_answer` + `key_points` (2–4 items).

The prompt (`prompts.py:35`) asks for **10 MCQs (`q1`–`q10`) and 10
short-answer questions (`q11`–`q20`)**, easy-to-moderate difficulty, grounded in
job requirements, resume, and (optionally) GitHub evidence.

---

## 7. Configuration

Environment variables are loaded from `assessment-service/.env` at import time
(`config.py:7`). Copy `.env.example` to `.env` and fill it in.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | *(empty → service errors)* | OpenRouter API key |
| `OPENROUTER_FREE_MODELS` | `openai/gpt-oss-20b:free,google/gemma-3-27b-it:free` | Comma-separated fallback model list |
| `ASSESSMENT_MAX_RETRIES_PER_MODEL` | `2` | Attempts per model |
| `ASSESSMENT_REQUEST_TIMEOUT_SECONDS` | `60` | Per-request LLM timeout |

Other constants (`config.py`): `OPENROUTER_BASE_URL` =
`https://openrouter.ai/api/v1`, `PROMPT_VERSION` = `assessment-v1`,
`SERVICE_NAME` = `Patina AI Assessment Service`.

> Note: `.env.example` currently ships `OPENROUTER_FREE_MODELS=openrouter/free`,
> which differs from the in-code default shown above. Update whichever you use.

---

## 8. LLM client behaviour (`llm_client.py`)

- Uses the OpenAI SDK pointed at OpenRouter's OpenAI-compatible endpoint.
- Iterates `FREE_MODELS`, retrying each up to `MAX_RETRIES_PER_MODEL` times.
- Retries on `RateLimitError`, `APITimeoutError`, `APIConnectionError`, and
  `APIStatusError` with status ≥ 500 or 408; non-retryable statuses skip to the
  next model.
- Backoff is `min(2 ** attempt, 4)` seconds.
- Invalid JSON / empty content also triggers a retry, then falls through.
- If every model fails, raises `AssessmentLLMError` with a summary of the most
  recent failures.

---

## 9. Prompting & safety (`prompts.py`)

- All job/resume/project/GitHub content is treated as **untrusted data**;
  the model is instructed never to follow instructions embedded in it and never
  to invent projects, skills, or activity.
- Inputs are truncated before prompting (`job_description` and `resume_text` to
  12000 chars; skills/projects capped) to bound token usage.
- Each question is tagged with a `source` of `jd`, `resume`, or `github`;
  `github` is only permitted when GitHub is enabled and evidence is present.
- `PROMPT_VERSION` (`assessment-v1`) is stamped onto every result so future
  prompt changes can be distinguished.

---

## 10. Running locally

### 10.1 Create and activate the virtual environment

From the repo root:

```powershell
# Create the venv (once)
python -m venv assessment-service/.venv

# Activate — Windows PowerShell
assessment-service\.venv\Scripts\Activate.ps1

# Activate — Windows cmd.exe
assessment-service\.venv\Scripts\activate.bat

# Activate — Git Bash / macOS / Linux
source assessment-service/.venv/Scripts/activate
```

> If PowerShell blocks the activation script
> (`... running scripts is disabled on this system`), either run
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first, or skip
> activation and call the venv's interpreter directly as shown in §10.3.

### 10.2 Install dependencies

```powershell
# With the venv activated:
python -m pip install -r assessment-service/requirements.txt

# Or without activating (point at the venv interpreter directly):
assessment-service\.venv\Scripts\python -m pip install -r assessment-service\requirements.txt
```

Create `assessment-service/.env` from `.env.example` and set
`OPENROUTER_API_KEY` before starting the server.

### 10.3 Start the FastAPI service with uvicorn

Run from the **repo root**. `--app-dir assessment-service` puts the service on
`sys.path` so `app.main:app` resolves.

```powershell
# With the venv activated:
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --app-dir assessment-service

# Or without activating:
assessment-service\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --app-dir assessment-service
```

- `--reload` auto-restarts on code changes (development only; drop it for prod).
- `--host 0.0.0.0` instead of `127.0.0.1` exposes the service on the LAN.

Once running:

- Health check: `http://127.0.0.1:8000/`
- Interactive docs: `http://127.0.0.1:8000/docs`
- Assessment endpoint: `POST http://127.0.0.1:8000/generate-assessment`

### 10.4 Alternative: run from inside the folder

If you prefer to `cd` into `assessment-service/`, the `--app-dir` flag is no
longer needed:

```powershell
uvicorn app.main:app --reload --port 8000
```

Then open `http://127.0.0.1:8000/` for the health check, or POST to
`/generate-assessment`.

---

## 11. Known limitations / open items

- No tests yet (`tests/` is empty).
- Not integrated with `backend/` or `frontend/`, and not recorded in
  `AUDIT.md` / `CHECKLIST.md`.
- `/generate-assessment` exposes the answer key; a real candidate-facing route
  must strip it.
- Anti-cheating controls for the assessment (guide review `GR-1`) are **not**
  implemented here.
- Single synchronous LLM call path — no queueing or caching.
