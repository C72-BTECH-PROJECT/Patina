# Assessment Service

Generates role-specific technical assessments for a candidate/job pair using
Gemini, and returns two separate artifacts:

- **Candidate questions** — safe to show to the candidate.
- **Answer key** — correct options, explanations, ideal answers, and key points.

20 questions are generated and validated; a random 10 (6 multiple-choice, 4
short-answer by default) are served, and the answer key covers exactly those 10
(REBUILD/DECISIONS.md §6.2).

The service is a standalone FastAPI app. It is deliberately isolated from
`backend/` and `nlp-engine/` so the assessment logic can evolve independently.
Core (`backend/`) is its only caller.

---

## 1. Where it fits

```
Frontend  →  Gateway  →  Core (Node/Express)  →  Assessment Service (FastAPI)  →  Gemini
                                                       ▲
                          resume/job/GitHub evidence passed in the request
```

Gemini is the only LLM provider, called through Google's OpenAI-compatible
endpoint (REBUILD/DECISIONS.md §6.1). There is no second provider: if every
configured Gemini model fails, generation fails with a message naming each
model and its failure.

The service is **stateless**. It receives all needed context (job, resume,
skills, optional GitHub evidence) in the request body and returns the generated
assessment. It does not read from or write to the database.

---

## 2. Directory layout

```
assessment-service/
├── app/
│   ├── __init__.py        # package marker
│   ├── config.py          # env loading, model list, time budget, served counts
│   ├── schemas.py         # Pydantic request/response models + validation
│   ├── prompts.py         # prompt builders + the one PROMPT_VERSION
│   ├── llm_client.py      # Gemini client: one call per model, JSON mode, deadline
│   ├── validators.py      # shape/consistency checks on generated output
│   ├── generator.py       # prompt → LLM → validate 20 → draw 10 → shuffle
│   ├── evaluator.py       # grading: MCQ by code, short answers by LLM, strict checks
│   └── main.py            # FastAPI app and HTTP endpoints
├── .env.example           # template for required environment variables
├── .env                   # local secrets (git-ignored)
└── requirements.txt       # Python dependencies
```

---


## 3. How a request is processed

Entry point: `app/main.py` → `generate_assessment()` in `app/generator.py`.

1. **Input normalization** — the request is coerced through the
   `AssessmentInput` Pydantic model. If `include_github` is false, `github_data`
   is forced to `None`. GitHub evidence counts as supplied only when
   `include_github` is true and `github_data` is non-empty.
2. **ID + prompt** — a UUID `assessment_id` is created and the generation prompt
   is built (`prompts.py`). Job description and resume text are capped at 12000
   characters; GitHub evidence is serialised and capped at 8000 characters. When
   no GitHub evidence is supplied the prompt forbids the source `"github"`.
3. **Time budget** — one deadline covers the whole request:
   `ASSESSMENT_GENERATION_BUDGET_SECONDS` (default 210, refused above 230).
4. **Generation rounds** — up to `ASSESSMENT_MAX_VALIDATION_ROUNDS` (default 2).
   If a round's output fails validation, the errors are appended to the prompt
   for the next round. If every model fails in a round, the request fails at once.
5. **LLM call** (`llm_client.py`) — one call per model in `GEMINI_MODELS`, in
   order, in JSON response mode. Each call is bounded on the wall clock by
   `min(ASSESSMENT_REQUEST_TIMEOUT_SECONDS, time left)`; no call starts with less
   than 10 s left. The first model that returns a JSON object wins.
6. **Validation** (`validators.py`) — exactly 20 questions, 10 MCQ / 10
   short-answer, IDs `q1..q20`, matching answer entries, correct field types, and
   no `source: "github"` question unless GitHub evidence was supplied.
7. **Served draw** (`generator.py`) — a random `ASSESSMENT_SERVED_MCQ` (6) MCQs
   and `ASSESSMENT_SERVED_SHORT` (4) short answers are drawn from the 20, put in
   random order and renumbered `q1..q10`. The answer key is reduced to exactly
   those questions. The undrawn questions are discarded and appear nowhere in the
   response.
8. **MCQ option shuffle** — options of the served MCQs are shuffled; the key's
   `correct_option` is remapped and re-checked to prove the correct text did not
   move.
9. **Return** — `(questions_json, answers_json)` for the served set.

---

## 4. HTTP API

### `GET /`

Health check. `llm_configured` is whether a Gemini key and at least one model
are configured; the key itself is never returned.

```json
{ "service": "Patina AI Assessment Service", "status": "healthy", "llm_configured": true }
```

### `POST /generate-assessment`

Accepts an `AssessmentInput` body (see §5). Returns the served set (10 by
default):

```json
{
  "questions": {
    "assessment_id": "...", "candidate_id": "...", "job_id": "...",
    "model_used": "gemini-...", "prompt_version": "assessment-v2",
    "questions": [ ... 10 items, ids q1..q10 ... ]
  },
  "answer_key": { "assessment_id": "...", "answers": [ ... 10 items, same ids ... ] }
}
```

Errors are `{ "error": <token>, "message": <cause> }`. The message names each
model and what went wrong (timeout, HTTP status, invalid JSON, validation
error). Provider text is sanitised; it never contains key material.

| Failure | Status | `error` |
| --- | --- | --- |
| `GEMINI_API_KEY` or `GEMINI_MODELS` empty | `503` | `llm_not_configured` |
| Every model returned invalid or empty JSON | `502` | `llm_invalid_output` |
| Output failed validation in every round | `502` | `llm_invalid_output` |
| A model timed out, was rate limited, returned an HTTP error, or the budget ran out | `502` | `llm_unavailable` |
| Any other exception | `500` | FastAPI `detail`: `"Assessment generation failed. Check service logs."` |

> Security note: this endpoint returns the **answer key** to its caller. Core is
> the only caller; it stores the key server-side and strips it before anything
> reaches the browser.

### `POST /evaluate-assessment`

Grades one attempt (R-08, REBUILD/DECISIONS.md §6.2). The service is stateless:
core sends the served questions, their stored key and the candidate's answers.

```json
{
  "assessment_id": "...",
  "questions":  [ { "question_id": "q1", "question_type": "mcq", ... }, ... ],
  "answer_key": [ { "question_id": "q1", "correct_option": "B", "explanation": "..." }, ... ],
  "answers":    [ { "question_id": "q1", "response": "B" }, ... ]
}
```

- **Multiple choice** is graded by code: `response.strip().upper() == correct_option`.
  No LLM.
- **Short answers** that were answered are graded in one Gemini call. Each
  answer sits alone inside a block delimited by a random per-call tag
  (`<candidate_answer_<16 hex>>`). The prompt says that text is untrusted data
  to assess, never instructions. Any copy of the tag inside an answer is removed
  first.
- The grader's output is checked strictly (`GraderOutput` in `schemas.py`): one
  grade per answered short answer, no missing, unknown or duplicate ids, no extra
  keys, numeric points only.
- **Points must be exactly 0, 0.5 or 1. Off-grid values such as 0.73 are
  rejected, not snapped.** A grader that ignores the rubric's scale is treated as
  invalid output. A rejected round is retried once with the reason, if time is
  left. If not, the call fails.
- **Unanswered** questions score 0 with "Not answered.". That 0 is the
  candidate's own result, not an infrastructure failure.
- **Time bound:** grading has its own deadline, `GRADING_BUDGET_SECONDS` = 100 s
  (in `evaluator.py`). Every LLM call is cut to the time left, so the worst case
  is about 100 s, under core's 120 s evaluate timeout.

Success (200):

```json
{
  "assessment_id": "...", "points_earned": 7.5, "points_possible": 10.0, "score": 75.0,
  "short_answer_graded": true,
  "grading_model": "gemini-..." ,
  "grading_prompt_version": "grading-v2",
  "results": [
    { "question_id": "q1", "question_type": "mcq", "skill": "...", "correct": true,
      "points": 1.0, "max_points": 1.0,
      "candidate_feedback": "Correct.",
      "recruiter_feedback": "Correct answer: B. Candidate chose: B. <explanation>" }
  ]
}
```

- `candidate_feedback` is written by code from the outcome only: "Correct." /
  "Incorrect." for multiple choice; "Full credit / Partial credit / No credit:
  ..." for short answers; "Not answered.". It never contains the correct option,
  the explanation, the ideal answer, key points or any LLM text.
- `recruiter_feedback` is the full detail: the correct option and explanation, or
  the grade and the grader's one-sentence reason.
- `short_answer_graded` is always `true`, because a result is only returned when
  every answered short answer was graded. `grading_model` is `null` when no
  short answer needed the LLM.
- The old single `feedback` field is gone.

Errors are `{ "error": <token>, "message": <cause> }`. They never include a score
or partial results:

| Failure | Status | `error` |
| --- | --- | --- |
| Short answers need grading and `GEMINI_API_KEY` is empty | `503` | `llm_not_configured` |
| Grading call failed, timed out, or returned invalid or incomplete output | `502` | `grading_unavailable` |
| Questions, key and answers do not fit together (missing key entry, answer for an unknown question, unknown type) | `422` | `invalid_evaluate_input` |
| Request body fails the `EvaluateInput` schema | `422` | FastAPI `detail` |
| Any other exception | `500` | FastAPI `detail` |

---

## 5. Request schema — `AssessmentInput` (`schemas.py`)

| Field | Type | Required | Limits / default |
| --- | --- | --- | --- |
| `candidate_id` | str | yes | 1–128 chars |
| `job_id` | str | yes | 1–128 chars |
| `job_title` | str | yes | 1–200 chars |
| `job_description` | str | yes | 1–12000 chars |
| `required_skills` | list[str] | no | max 50 |
| `preferred_skills` | list[str] | no | max 50 |
| `resume_text` | str | yes | 1–20000 chars (12000 reach the prompt) |
| `resume_skills` | list[str] | no | max 100 |
| `resume_projects` | list[dict] | no | max 30 (20 reach the prompt) |
| `experience_level` | str | no | default `"unspecified"`, max 100 |
| `include_github` | bool | no | default `false` |
| `github_data` | dict \| null | no | used only if `include_github` is true; 8000 chars reach the prompt |

---

## 6. Output shapes

### Questions

Metadata: `assessment_id`, `candidate_id`, `job_id`, `model_used`,
`prompt_version`, and the served `questions` (10 by default).

Each question has `question_id` (`q1`–`qN` in served order), `question_type`
(`mcq` / `short_answer`), `question`, `skill`, `source`
(`jd` / `resume` / `github`). MCQs also have exactly four options labelled
`A`–`D` with unique text.

### Answer key

`assessment_id` + one entry per served question, linked by `question_id`:

- MCQ answer: `correct_option` (`A`–`D`) + `explanation`.
- Short-answer key: `ideal_answer` + `key_points` (2–4 items).

The prompt asks the model for **10 MCQs (`q1`–`q10`) and 10 short-answer
questions (`q11`–`q20`)**, easy-to-moderate difficulty, grounded in job
requirements, resume, and (optionally) GitHub evidence. The full 20 are
validated by the schemas in `schemas.py` before the draw.

---

## 7. Configuration

Environment variables are loaded from `assessment-service/.env` at import time
(`config.py`). Copy `.env.example` to `.env` and fill it in. Out-of-range values
stop the service at start-up with a message.

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | *(empty → 503 `llm_not_configured`)* | Gemini API key |
| `GEMINI_MODELS` | `gemini-3.5-flash,gemini-3.1-flash-lite` | Models tried in order, one call each |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` | OpenAI-compatible endpoint |
| `ASSESSMENT_GENERATION_BUDGET_SECONDS` | `210` | Whole-request budget; must be ≤ 230 |
| `ASSESSMENT_REQUEST_TIMEOUT_SECONDS` | `120` | Cap on one LLM call (also cut to the time left) |
| `ASSESSMENT_MAX_VALIDATION_ROUNDS` | `2` | Rounds when output fails validation |
| `ASSESSMENT_SERVED_MCQ` | `6` | MCQs served (0–10) |
| `ASSESSMENT_SERVED_SHORT` | `4` | Short answers served (0–10) |

The default model ids were confirmed on 2026-11-12 by listing the models the key
can use and making one JSON-mode chat call to each. Some listed ids (for example
`gemini-2.5-flash`) answered 404 on chat, so a listed id is not proof of access.

Other constants: `PROMPT_VERSION` (`prompts.py`, the only definition) =
`assessment-v2`; `GRADING_PROMPT_VERSION` (`prompts.py`, the only definition) =
`grading-v2`; `GRADING_BUDGET_SECONDS` (`evaluator.py`) = 100;
`SERVICE_NAME` = `Patina AI Assessment Service`.

---

## 8. LLM client behaviour (`llm_client.py`)

- Uses the OpenAI SDK pointed at Gemini's OpenAI-compatible endpoint, with
  `response_format={"type": "json_object"}` and SDK retries off.
- Iterates `GEMINI_MODELS`, one call per model per round. A timeout, rate limit,
  HTTP error, empty content or invalid JSON moves on to the next model; there is
  no sleep or backoff.
- Each call runs in a worker thread and is abandoned when its share of the
  budget ends, so the budget is a wall-clock bound, not just a socket timeout.
- If every model fails, raises `AssessmentLLMError` whose message lists every
  model's failure.

**Worst-case time for one generate call.** Every LLM call is bounded by the time
left before the request's deadline, and no call starts with less than 10 s left,
so all calls together take at most the budget (210 s by default, 230 s at most).
Validation, the draw and the shuffle take milliseconds. The worst case is
therefore about 210 s (≤ 230 s), under core's 300 s timeout.

---

## 9. Prompting & safety (`prompts.py`)

- All job/resume/project/GitHub content is treated as **untrusted data**;
  the model is instructed never to follow instructions embedded in it and never
  to invent projects, skills, or activity.
- Inputs are truncated before prompting (`job_description` and `resume_text` to
  12000 chars, GitHub evidence to 8000 chars; skills/projects capped) to bound
  token usage.
- Each question is tagged with a `source` of `jd`, `resume`, or `github`;
  `github` is forbidden in the prompt and rejected by the validator unless
  GitHub evidence was supplied.
- `PROMPT_VERSION` is stamped onto every result so prompt changes can be
  distinguished.

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
`GEMINI_API_KEY` before starting the server. Without it the service starts,
health reports `"llm_configured": false`, and generation answers 503.

### 10.3 Start the service

The service is **internal only** (T-0029, DEC-5): the backend calls it, the
browser never does. It binds `127.0.0.1:8002`, the address the backend uses by
default (`ASSESSMENT_SERVICE_URL` in `backend/.env.example`). `/docs`, `/redoc`
and `/openapi.json` are off.

Run from `assessment-service/`:

```powershell
cd assessment-service
.\.venv\Scripts\python -m app
```

`python -m app` runs `app/__main__.py`, which reads `ASSESSMENT_HOST` (default
`127.0.0.1`) and `ASSESSMENT_PORT` (default `8002`) from `app/config.py`. Do not
bind `0.0.0.0`: nothing outside this machine should reach the service directly.

For development with auto-reload, from the repo root:

```powershell
assessment-service\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8002 --app-dir assessment-service
```

Once running:

- Health check: `http://127.0.0.1:8002/`
- Assessment endpoints (called by the backend only): `POST /generate-assessment`,
  `POST /evaluate-assessment`

### 10.4 Tests

```powershell
assessment-service\.venv\Scripts\python -m pip install -r assessment-service\requirements-dev.txt
powershell -File tests\run-suite.ps1 -Target current -Suites assessment
```

The tests live in `tests/assessment/` at the repo root. Generation tests replace
`app.llm_client._complete` with a fake, so they need no key and no network.

---

## 11. Known limitations / open items

- `/generate-assessment` returns the answer key to its caller (core); core must
  keep stripping it before anything reaches the browser.
- Grading is one LLM judgement per short answer, with no second grader and no
  calibration set. A wrong grade on the 0 / 0.5 / 1 grid is still possible; the
  recruiter sees the grader's reason in `recruiter_feedback`.
- Difficulty is fixed at "easy to moderate"; there is no PFQS or adaptive
  difficulty (REBUILD/DECISIONS.md §6.1).
- Single synchronous LLM call path — no queueing or caching.
