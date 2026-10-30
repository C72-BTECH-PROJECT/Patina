# Assessment Service — Implementation Plan

**Project:** Patina  
**Component:** `assessment-service/`  
**Status:** Phase 1 implementation exists; testing, hardening, and integration remain.  
**Purpose:** Track the assessment service from its current standalone implementation through safe integration with Patina's Node/Express backend. This plan is specific to the assessment service; it does not authorize changes to `nlp-engine/`.

---

## 1. Objective and Scope

Build an independent FastAPI microservice that generates a role-specific technical assessment from a job description and candidate evidence.

The service should:
- Accept job, candidate, resume, skills, project, and optional GitHub evidence.
- Generate exactly 20 questions: 10 multiple-choice questions (MCQs) and 10 short-answer questions.
- Validate the generated questions and corresponding answer key before returning them.
- Keep the answer key server-side when exposed to real candidates.
- Be callable by the existing Node/Express backend over HTTP.
- Remain isolated from the existing `nlp-engine/` implementation.

### In scope for this plan
1. Verify and stabilize the standalone service.
2. Add automated tests and repeatable manual tests.
3. Improve error handling, configuration, and security.
4. Define the backend-to-service API contract.
5. Integrate the service with Node/Express.
6. Verify end-to-end behaviour and document operation.

### Not in the first integration milestone
- Automated grading of candidate answers.
- A full anti-cheating/proctoring system.
- Replacing or modifying `nlp-engine/`.
- Direct database access from the assessment service.
- Queueing, caching, or distributed generation infrastructure unless performance tests show it is needed.

---

## 2. Current Implementation

The latest repository README describes the service as standalone and not yet integrated with the backend or frontend.

| File | Current responsibility |
|---|---|
| `app/__init__.py` | Marks `app` as a Python package. |
| `app/config.py` | Loads `.env`, model configuration, timeout/retry values, service name, and prompt version. |
| `app/schemas.py` | Pydantic request, question, answer-key, and output schemas. |
| `app/prompts.py` | Builds the prompt and treats supplied job/resume/project/GitHub content as untrusted data. |
| `app/llm_client.py` | Calls OpenRouter through the OpenAI-compatible SDK, with model fallback and retry handling. |
| `app/validators.py` | Checks question counts/types/IDs and consistency between questions and answer keys. |
| `app/generator.py` | Orchestrates normalization, prompt creation, generation, validation, and MCQ option shuffling. |
| `app/main.py` | FastAPI app, health endpoint, and generation endpoint. |
| `.env.example` | Template for environment variables. |
| `requirements.txt` | Python dependencies. |
| `tests/` | Directory reserved for tests; the README says it is currently empty. |

### Current HTTP endpoints

- `GET /` — basic health response.
- `POST /generate-assessment` — accepts an `AssessmentInput` and returns both `questions` and `answer_key`.

The current generation endpoint intentionally returns the answer key for development convenience. **Do not expose this response directly to a candidate-facing client.** Production integration must keep the answer key within trusted server-side code.

### Current generation contract

Required request fields include `candidate_id`, `job_id`, `job_title`, `job_description`, and `resume_text`. Optional context includes required/preferred skills, resume skills/projects, experience level, and GitHub evidence controlled by `include_github`.

Expected output:
- 20 questions with IDs `q1`–`q20`.
- 10 MCQs and 10 short-answer questions.
- MCQ options labelled A–D.
- A corresponding answer-key entry for each question.
- Assessment metadata including the assessment ID, model used, and prompt version.

### Known current limitations from the README

- No automated tests have been added yet.
- The service is not integrated with `backend/` or `frontend/`.
- The generation endpoint returns the answer key.
- Anti-cheating controls are not implemented.
- The request path is synchronous and has no queueing or caching.
- `.env.example` uses `openrouter/free`, while the in-code default model list differs. Configuration should be made consistent and verified against current provider availability.

---

## 3. Target Architecture

```text
Candidate / Recruiter UI
          |
          v
Patina Frontend
          |
          v
Node.js / Express Backend
  - authentication and authorization
  - fetches/assembles trusted candidate and job data
  - validates caller permissions
  - calls assessment service
  - stores assessment and answer key securely
  - returns candidate-safe questions only
          |
          | private HTTP request
          v
FastAPI Assessment Service
  - validates request
  - builds prompt
  - calls OpenRouter
  - validates generated output
  - returns structured result to backend
          |
          v
OpenRouter model provider
```

The assessment service should remain stateless in the initial design: it receives its required context in the request and does not connect directly to the Patina database. The Node/Express backend remains the trusted integration and persistence boundary.

The existing `nlp-engine/` remains a separate component. Integration should consume its output through the existing backend/data flow; do not import its internal Python modules into this service or edit its entry point as part of this plan.

---

## 4. Implementation Roadmap

### Phase 0 — Confirm the baseline

- [ ] Pull the latest repository changes and review `assessment-service/README.md`.
- [ ] Confirm the expected folder and interpreter/virtual environment arrangement.
- [ ] Confirm `assessment-service/.env` is ignored by Git and contains no committed secrets.
- [ ] Install dependencies from `assessment-service/requirements.txt`.
- [ ] Confirm the health endpoint works without making an LLM request.
- [ ] Confirm the API docs load at `/docs`.
- [ ] Confirm the active `.env` model configuration is consistent with `.env.example`.
- [ ] Record the exact successful baseline commit and test results.

**Exit condition:** The service imports, starts, and responds to `GET /` reliably.

### Phase 1 — Stabilize the generator and provider connection

- [ ] Verify the OpenRouter API key is loaded from the service-local `.env`.
- [ ] Test the configured model ID/router independently of assessment generation.
- [ ] Confirm the configured model can return JSON through the OpenAI-compatible endpoint.
- [ ] Make model configuration a single source of truth; document model fallback behaviour.
- [ ] Confirm retries are bounded and provider errors do not expose secrets.
- [ ] Confirm timeouts are appropriate for the expected generation duration.
- [ ] Fix and unit-test MCQ option shuffling so the correct answer text remains paired with the remapped answer label.
- [ ] Check that invalid JSON and invalid schemas cause controlled retries or a clear failure.
- [ ] Ensure exception handling logs enough diagnostic detail for developers while HTTP responses remain safe.

**Exit condition:** A valid assessment can be generated repeatedly with a configured available model, and a failed provider call produces a controlled error instead of a crash.

### Phase 2 — Automated tests

Create tests under `assessment-service/tests/`. Tests should not require a live OpenRouter call unless explicitly marked as integration tests.

#### Unit tests
- [ ] Request schema accepts a valid payload.
- [ ] Required fields and maximum lengths are enforced.
- [ ] GitHub data is ignored when `include_github` is false.
- [ ] Prompt construction truncates/caps context as intended.
- [ ] Prompt instructions treat supplied resume/job/GitHub content as untrusted.
- [ ] Exactly 20 questions are required.
- [ ] The 10-MCQ / 10-short-answer split is enforced.
- [ ] Question IDs must be exactly `q1` through `q20`.
- [ ] Duplicate question IDs and duplicate answer-key IDs are rejected.
- [ ] MCQs have four unique options labelled A–D.
- [ ] Answer-key entries match the corresponding question types.
- [ ] Correct MCQ answers remain correct after option shuffling.
- [ ] Invalid provider JSON and provider exceptions are handled.
- [ ] Missing API key returns a clear configuration error.

#### API tests
- [ ] `GET /` returns the expected health payload.
- [ ] Invalid request bodies return HTTP 422.
- [ ] Provider/generation failures return a controlled HTTP error.
- [ ] Successful mocked generation returns the expected shape.
- [ ] Candidate-safe response does not include the answer key.

#### Live provider smoke test
- [ ] Run a small number of manual requests against OpenRouter.
- [ ] Record selected model, latency, success/failure, and validation outcome.
- [ ] Keep API keys and sensitive resume text out of test logs and committed fixtures.

**Exit condition:** Unit/API tests pass offline with mocked provider calls, and a separate live smoke test succeeds when the provider is available.

### Phase 3 — Security and API contract

- [ ] Separate the trusted backend response from the candidate-facing response.
- [ ] Keep `answer_key` out of all candidate-facing API responses.
- [ ] Require backend-to-service authentication (for example, a shared service credential or deployment-level identity); never trust a public unauthenticated generation endpoint.
- [ ] Keep the service private to the backend network in deployed environments.
- [ ] Validate and limit request sizes and field lengths.
- [ ] Apply request timeouts and bounded retries to avoid unbounded resource use.
- [ ] Avoid logging API keys, full resumes, private GitHub data, answer keys, or other unnecessary personal data.
- [ ] Define safe error messages for callers; retain detailed diagnostics only in controlled logs.
- [ ] Review prompt-injection resistance and ensure model output is treated as untrusted until schema validation succeeds.
- [ ] Decide whether CORS is needed. CORS is not a substitute for authentication and should not be used to let browsers call the service directly.
- [ ] Document the request and response JSON contract, status codes, and timeout behaviour.
- [ ] Add a versioning strategy before making breaking API changes.

**Exit condition:** Only trusted backend code can request/store answer keys, and candidate-facing responses cannot reveal them.

### Phase 4 — Backend integration (Node/Express)

Keep all provider credentials in the assessment service. The Node backend calls the service over HTTP; it does not need the OpenRouter API key.

#### 4.1 Integration design
- [ ] Identify the existing backend controller/service/route that should initiate an assessment.
- [ ] Decide how the authenticated recruiter/job flow triggers generation.
- [ ] Use the backend to gather trusted job description, candidate resume text, extracted skills/projects, and optional GitHub evidence.
- [ ] Map backend data to the `AssessmentInput` contract.
- [ ] Ensure the caller is authorized to assess the specified candidate/job.
- [ ] Add an environment variable such as `ASSESSMENT_SERVICE_URL` to the backend configuration.
- [ ] Add a backend-only credential if service authentication is implemented.
- [ ] Implement an HTTP client/service module with connection and response timeouts.
- [ ] Handle 422, 502, 500, network errors, and timeouts explicitly.
- [ ] Avoid exposing raw internal errors or the answer key to the frontend.

#### 4.2 Backend response handling
- [ ] Receive the generated questions and answer key from FastAPI.
- [ ] Persist the answer key only in a trusted server-side location with appropriate access controls.
- [ ] Persist or associate the candidate-facing questions with an `assessment_id`, candidate, and job.
- [ ] Return only candidate-safe assessment data to the frontend.
- [ ] Ensure candidate endpoints cannot fetch answer keys.
- [ ] Add authorization checks for reading, starting, and submitting an assessment.
- [ ] Make duplicate requests safe: define whether to reuse an existing assessment or create a new one.
- [ ] Ensure a failed generation does not leave a partially persisted assessment.

**Exit condition:** A valid authenticated backend flow can request an assessment and return candidate-safe questions without exposing the answer key or provider credentials.

### Phase 5 — Persistence and assessment lifecycle

The service itself remains stateless; persistence belongs in the backend/database layer.

- [ ] Review the current Patina data model before adding tables or columns.
- [ ] Define an assessment record linked to candidate and job identifiers.
- [ ] Store questions and the answer key separately or apply strict field-level access controls.
- [ ] Track status, such as `pending`, `generated`, `in_progress`, `submitted`, `evaluated`, and `failed`, only where the application lifecycle requires it.
- [ ] Store prompt version and model metadata for traceability.
- [ ] Record timestamps and generation failures without storing unnecessary sensitive data.
- [ ] Define retention/deletion behaviour for resumes, generated questions, answers, and GitHub evidence.
- [ ] Use transactions or equivalent safeguards when persisting related assessment records.
- [ ] Keep schema changes backward-compatible with existing backend consumers.

**Exit condition:** Assessments can be associated with a candidate/job, retrieved through authorized backend routes, and stored without exposing the answer key.

### Phase 6 — Frontend integration

- [ ] Add or connect the recruiter action that triggers assessment generation through the Node backend.
- [ ] Display loading, success, retry, and failure states.
- [ ] Render MCQs and short-answer questions from the response schema rather than hard-coded question types.
- [ ] Submit candidate responses to the backend, not directly to FastAPI/OpenRouter.
- [ ] Do not include answer keys in frontend bundles, network responses, or client state.
- [ ] Confirm that candidates cannot choose arbitrary candidate/job IDs to access another assessment.
- [ ] Test empty, slow, failed, and expired assessment states.
- [ ] Keep frontend changes within the existing design and route conventions.

**Exit condition:** The candidate flow can display and submit an assessment while all trusted operations remain server-side.

### Phase 7 — End-to-end validation

- [ ] Test a full flow with a real job and test candidate.
- [ ] Test with GitHub evidence disabled.
- [ ] Test with GitHub evidence enabled and verify `github` question sources only use supplied evidence.
- [ ] Confirm exactly 20 questions and the expected type split.
- [ ] Confirm the answer key maps to the shuffled MCQ options.
- [ ] Confirm candidate API responses never contain answer keys or internal provider details.
- [ ] Test provider unavailable, rate-limited, slow, invalid-JSON, and timeout scenarios.
- [ ] Test malformed requests and authorization failures.
- [ ] Test repeated requests and duplicate-submission behaviour.
- [ ] Check logs for secrets or unnecessary personal data.
- [ ] Run existing relevant repository tests to detect regressions.
- [ ] Verify no files in `nlp-engine/` were changed as part of this work.

**Exit condition:** The assessment flow works end-to-end and failure modes are predictable, observable, and safe.

### Phase 8 — Deployment and operations

- [ ] Decide on deployment packaging (for example, a dedicated container for FastAPI).
- [ ] Pin or lock dependencies after compatibility testing.
- [ ] Configure secrets through the deployment environment or secret manager.
- [ ] Do not copy a developer `.env` into a public image or commit it.
- [ ] Deploy the service on a private network accessible to the backend.
- [ ] Configure readiness/liveness checks, resource limits, and request timeouts.
- [ ] Add structured logs and basic metrics for request count, generation latency, validation failures, provider errors, and model used.
- [ ] Avoid recording full resumes or generated answer keys in observability tools.
- [ ] Document how to start, stop, update, and roll back the service.
- [ ] Verify model/provider availability before relying on a free model for production workloads.

**Exit condition:** The service can be deployed and operated independently from the main backend, with configuration and secrets managed safely.

### Phase 9 — Future enhancement: answer evaluation (separate milestone)

This is not required to complete initial generation integration.

- [ ] Define an answer-submission contract linked to `assessment_id` and `question_id`.
- [ ] Retrieve the trusted answer key only in server-side evaluation code.
- [ ] Score MCQs deterministically from the stored correct option.
- [ ] Define a rubric for short answers using ideal answers and key points.
- [ ] Validate any LLM-generated evaluation against a structured schema.
- [ ] Store scores, feedback, and evaluation metadata securely.
- [ ] Test scoring consistency and guard against prompt injection in candidate answers.
- [ ] Keep the evaluation endpoint separate from candidate-safe question retrieval.
- [ ] Review fairness, explainability, and human-review requirements before using scores for consequential decisions.

**Exit condition:** Evaluation is separately specified, tested, and authorized; it does not weaken the confidentiality of the answer key.

---

## 5. Proposed API Contract at Integration

### Backend → Assessment Service

`POST /generate-assessment`

The backend sends the fields defined by `AssessmentInput`, including:
- Candidate/job IDs.
- Job title and description.
- Required/preferred skills.
- Resume text, skills, and projects.
- Experience level.
- Optional GitHub evidence and the explicit `include_github` flag.

### Assessment Service → Trusted Backend

The current development response contains:
- `questions`: question set plus assessment metadata.
- `answer_key`: matching answers and explanations.

The backend is trusted to receive both artifacts, store the answer key securely, and return only safe question data to the candidate.

### Candidate-facing backend response

Return only the candidate question artifact and the minimum metadata needed by the UI. Do not forward `answer_key`, provider credentials, prompt internals, or sensitive debugging details.

### Error handling expectations

| Condition | Expected handling |
|---|---|
| Invalid input | HTTP 422 from FastAPI; backend returns a suitable client error. |
| Provider/model failure after retries | Current service uses HTTP 502; backend reports a retryable generation failure where appropriate. |
| Unexpected service error | HTTP 500 with a generic response; detailed diagnostics remain server-side. |
| Backend cannot reach service | Backend returns a controlled temporary failure; no partial assessment should be presented as complete. |
| Unauthorized request | Reject at the backend and, once configured, at the service boundary. |

The exact backend-facing error format should be agreed before integration and tested as a contract.

---

## 6. Suggested Test Commands

Run these from the repository root, adapting the virtual-environment path to the environment actually used locally.

Install dependencies:

```powershell
python -m pip install -r assessment-service/requirements.txt
```

Start the service from the repository root:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001 --app-dir assessment-service
```

Open:
- Health check: `http://127.0.0.1:8001/`
- Swagger UI: `http://127.0.0.1:8001/docs`

When automated tests are added, install the test dependencies and run the service test suite separately from existing NLP tests. Keep unit tests independent of live model availability.

---

## 7. Definition of Done for Initial Integration

The initial assessment-service milestone is complete when:

- [ ] The service starts reproducibly from documented instructions.
- [ ] A configured available OpenRouter model can generate valid output.
- [ ] Output validation guarantees the required 20-question structure and answer-key mapping.
- [ ] Automated unit/API tests pass without needing live model access.
- [ ] The backend can call the service with trusted job/candidate context.
- [ ] The backend handles provider/service failures safely.
- [ ] The answer key is stored and accessible only to trusted server-side code.
- [ ] The frontend receives only candidate-safe questions.
- [ ] End-to-end tests cover success and key failure paths.
- [ ] Secrets and unnecessary personal data are not committed or logged.
- [ ] Documentation is updated with the actual implemented behaviour.
- [ ] No changes were made to the existing `nlp-engine/` as part of assessment-service implementation.

---

## 8. Working Rules

1. Keep assessment logic inside `assessment-service/`.
2. Do not edit `nlp-engine/app/main.py` or otherwise modify the existing NLP engine as part of this plan.
3. Make and test changes in small steps; do not integrate untested generation logic into the backend.
4. Keep OpenRouter credentials only in the assessment service's environment.
5. Treat model output as untrusted until validated.
6. Never expose the answer key to the candidate.
7. Prefer mocked automated tests for predictable development; use live provider calls only for smoke/integration testing.
8. Update this plan and the service README when implementation status materially changes.
