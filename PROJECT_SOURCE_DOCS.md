# Source Documents: AI-Automated Skill Validation and Credibility Framework

> This file consolidates the Objectives, SRS, and Literature Review docs for
> this project into one plain-text source. Use it to derive an ideal
> checklist — do not treat project_checklist.md or the current codebase as
> input for that exercise.

---

## PART 1: OBJECTIVES & SCOPE (from Objectives.docx)

### Problem Statement
The recruitment industry faces "Resume Inflation," where candidates exaggerate
skills or list technologies they've barely touched. Traditional ATS rely
solely on keyword matching, which is easily manipulated and doesn't verify
actual competency. This project shifts the paradigm from *keyword matching*
to *skill validation*: an AI-driven engine that generates dynamic, practical
challenges to test skills in real-time and cross-references claims with
verifiable data, producing a "Confidence Score" based on evidence, not claims.

### Core Objectives
1. **Automated Intelligent Parsing** — resume parsing engine using NLP to
   extract structured data (skills, experience, project links) from
   unstructured PDF resumes.
2. **Evidence-Based Verification** — validation algorithm cross-referencing
   candidate claims with real-time GitHub API data: code complexity, commit
   frequency, repository ownership, activity consistency → composite score.
3. **Generative AI Assessment** — dynamic assessment module replacing static
   question banks with an LLM-driven engine generating unique, un-cheatable
   technical interview questions tailored to the candidate's stated projects.
4. **Unified Credibility Visualization** — recruiter-facing "Credibility
   Score" dashboard visualizing validation results and skill breakdowns,
   removing human bias by evaluating technical merit only.

### Scope layers
- **Input Layer:** web portal, candidates upload resumes (PDF/DOCX).
- **Processing Layer:**
  - NLP Module: extract technical skills + project descriptions from diverse
    resume layouts.
  - Validation & Aggregator Module: fetch GitHub data, verify actual code
    contributions in claimed languages, cross-reference commit history for
    authorship/capability.
  - Generative Assessment Module: LLM-generated context-aware interview
    questions based specifically on the candidate's projects.
- **Output Layer:**
  - Recruiter Dashboard: weighted "Truth Score" (0–100%), skill breakdowns,
    flagged inconsistencies.
- **Exclusions:** technical/coding roles only. Does NOT validate non-technical
  soft skills or verify university degrees via registrar databases.

### Guide feedback (post Sem-End Review) — must be reflected in the ideal design
1. LinkedIn and certificate validation.
2. OCR is a must (for scanned/image resumes).
3. Need a fair scoring solution for candidates who work on support/maintenance
   projects, not just development.
4. GitHub must be optional.
5. Score explainability is crucial.

---

## PART 2: SOFTWARE REQUIREMENTS SPECIFICATION (from SRS docx)

### 1.1 Purpose
Specifies functional/non-functional requirements. System replaces
keyword-based ATS with verifiable, evidence-based skill evaluation using
resume parsing, GitHub-based validation, and AI-driven assessment.

### 1.2 Scope
- Ingest unstructured resumes (PDF/DOCX).
- Extract technical entities, cross-reference against real GitHub data.
- Administer dynamically generated, un-cheatable technical assessments.
- Output a Credibility Score with explainable breakdown for recruiters.
- Focus strictly on technical/coding roles; excludes degree verification and
  non-technical soft-skill validation.

### 2.1 Product Perspective
Web-based distributed app, microservices architecture. Frontend (candidate +
recruiter interfaces) + backend microservices (NLP, validation, assessment).
Interfaces with external APIs (GitHub) and external LLMs.

### 2.2 User Classes
- **Candidates:** upload resumes, authenticate GitHub, attempt assessments.
- **Recruiters:** view candidate scores, analyze explanations, compare
  applicants.

### 2.3 Assumptions & Constraints
- Assumes candidates provide valid GitHub profiles; external APIs stay
  available.
- Constraints: limited access to private repos; dependence on third-party
  APIs; LLM response variability.

### 3. System Models (for reference — recreate as diagrams if needed)
- **Use Case:** Candidate → Upload Resume / Authenticate GitHub / Take
  Assessment. Recruiter → View Dashboard / Filter Candidates / Audit Score
  Breakdown. GitHub API + LLM API are secondary actors.
- **Data Flow (Level 1):** Candidate → raw PDF/DOCX → NLP Parser → structured
  entities (JSON) → Aggregator → (fetches GitHub metadata) → Scoring Engine.
  In parallel: candidate skills → LLM Assessment Module → results → Scoring
  Engine → consolidated Credibility Score → Recruiter Dashboard.
- **Sequence (Assessment flow):** Frontend requests assessment → Backend
  retrieves parsed projects → pings LLM API (PFQS framework) to generate
  question plan → questions served to candidate → answers sent back →
  evaluated by LLM via rubric → stored in DB.
- **System Architecture:** Presentation (React) / Application (Node/Express
  routing) / Microservices (Python NLP Engine, Assessment Engine, GitHub
  Aggregator) / Data (MongoDB, though implementation has moved to Supabase —
  treat Supabase as the actual data layer). External: OpenAI/Gemini, GitHub.

### 3.1 Data Model
- **User Entity:** auth + contact details for Candidates and Recruiters.
- **Resume Entity:** raw file reference + structured parsed arrays (Skills,
  Experience, Education).
- **Repository Entity:** fetched GitHub metadata (commit frequency, language
  breakdown, code quality flags) linked to a Candidate.
- **Score Entity:** composite Credibility Score + granular sub-scores
  (Parsing Semantic Alignment, GitHub Evidence, Assessment Results) feeding
  the explainability dashboard.

### 4. Functional Requirements

**4.1 Resume Parsing Module**
- FR-1: Accept resumes in PDF and DOCX format.
- FR-2: Extract structured entities (skills, projects, experience) with ≥85%
  accuracy.
- FR-3: Process each resume within 10 seconds.

**4.2 GitHub Validation Module**
- FR-4: Extract GitHub usernames from resumes or user input.
- FR-5: Retrieve repository data using GitHub API.
- FR-6: Compute metrics: repository count, commit frequency, code quality
  indicators.
- FR-7: Analyze at least 5–10 core files per repository for code quality
  (the "8DFS heuristic" — targets up to 8 core logic files, approximates
  cyclomatic complexity/code smells, bypasses boilerplate/config files).

**4.3 Generative Assessment Module**
- FR-8: Generate technical questions based on candidate skills and projects.
- FR-9: Control question difficulty using a structured generation approach
  — the PFQS (Planning First, Question Second) framework: an
  instruction-tuned LLM first generates a structured "answer plan" (controls
  topic/difficulty), which then dictates dynamic question generation.
- FR-10: Evaluate candidate responses using predefined rubrics.
- FR-11: Achieve ≥0.75 correlation with human evaluation (target benchmark).

**4.4 Credibility Scoring Module**
- FR-12: Compute a composite score from resume parsing output + GitHub
  validation metrics + assessment results.
- FR-13: Display a breakdown of contributing factors (explainability).

**4.5 Dashboard Module**
- FR-14: Allow recruiters to view candidate rankings.
- FR-15: Provide explainable insights (skills matched, repo metrics, test
  results).

### 5. External Interfaces
- **GitHub API:** OAuth 2.0 auth; access to repositories, commits, metadata.
- **LLM API:** OpenAI/Gemini for question generation and answer evaluation.

### 6. Non-Functional Requirements
- NFR-1: Resume processing ≤10 seconds.
- NFR-2: Support ≥100 concurrent users.
- NFR-3: Microservices scale independently.
- NFR-4: Assessment module supports parallel execution.
- NFR-5: Resume parsing accuracy ≥85%.
- NFR-6: Skill classification F1-score ≥0.80.
- NFR-7: LLM evaluation correlation with human grading ≥0.75.
- NFR-8: OAuth 2.0 for authentication.
- NFR-9: API keys stored securely.
- NFR-10: HTTPS for data transmission.
- NFR-11: System uptime ≥95%.
- NFR-12: Graceful failure on API errors.

### 7. Risk Analysis
| Risk | Impact | Mitigation |
|---|---|---|
| No GitHub data | Incomplete evaluation | Allow assessment-only fallback |
| AI hallucination | Incorrect scoring | Use rubric + constraints |
| Biased evaluation | Unfair ranking | Add explainability layer |
| API failure | System downtime | Retry + fallback |

### 8. Dataset (for training/eval, not runtime dependency)
- Unstructured resumes: Kaggle "Resume Classification Dataset for NLP";
  Hugging Face "Annotated NER PDF Resumes" (5,029 CV samples, IT skills NER
  annotations — for training the custom NER model).
- Job descriptions: Kaggle "IT Job Posts Descriptions"; "IT Job Roles &
  Skills Dataset."
- Live repo evidence: GitHub REST/GraphQL API (real-time, not static).
- QA/assessment calibration: Hugging Face/GitHub "APPS" dataset (coding
  problems + unit tests) to calibrate LLM evaluation rubrics.

### 9. Methodology (four sequential algorithms)
1. **Intelligent Resume Parsing & Semantic Extraction** — layout-aware
   extraction (pdfplumber, IBM DocLing) → preprocessing (tokenize,
   lemmatize) → custom NER model → S-BERT semantic vectors. Rationale: rigid
   keyword intersection fails on synonyms/vocabulary differences; S-BERT
   captures semantic proximity.
2. **Evidence-Based Verification (GitHub Aggregation)** — extract GitHub
   username → crawl public repos via GitHub API → 8DFS heuristic (≤8 core
   logic files) approximates cyclomatic complexity/code smells, bypassing
   boilerplate. Rationale: parsing alone only confirms claims; static
   analysis on real code introduces verifiability.
3. **Generative AI Technical Assessment** — PFQS framework: LLM reads
   verified GitHub projects → generates structured "answer plan" (controls
   topic/difficulty) → plan dictates dynamic, un-cheatable question
   generation tailored to actual experience. Rationale: standard zero-shot
   prompting is less consistent/diverse than planning-first generation.
4. **Unified Credibility Scoring** — normalize + aggregate NLP parser output,
   GitHub evidence metrics, LLM assessment output into a weighted composite
   score with a dedicated explainability layer. Rationale: avoids "black
   box" scoring; lets recruiters audit reasoning.

---

## PART 3: LITERATURE REVIEW — KEY TAKEAWAYS (from Literature Review docx)

### Research Gap Identified
No existing system integrates all of: (1) resume parsing, (2) external
evidence validation (GitHub), and (3) dynamic technical assessment, into a
single explainable pipeline. Existing solutions solve one layer well —
parsing systems extract/rank; GitHub-based systems validate code evidence;
LLM-based systems generate/grade interview content — but rarely connect all
three with a final transparency layer for recruiters. **This integration is
this project's actual contribution — not any single module in isolation.**

### Design implications that should shape the "ideal" architecture
- **Parsing module** should use a *hybrid* extraction strategy (layout-aware
  tools + NER + semantic embeddings together), not a single technique —
  literature shows each alone has coverage gaps.
- **GitHub module** should be treated as *evidence augmentation, not
  absolute truth* — it should strengthen/weaken confidence in resume claims,
  not act as a binary pass/fail gate. This directly supports the guide's
  feedback that GitHub must be optional.
- **Assessment module** should generate controlled, rubric-based questions
  tied to verified projects — a planning step (PFQS) before question
  generation is what literature shows improves control over difficulty/topic
  vs. free-form/zero-shot prompting.
- **Dashboard/scoring** should expose intermediate evidence, not just a
  final number — explainability is described as a key differentiator from a
  black-box model, reinforcing FR-13/FR-15 and guide feedback #5.

### Realistic metric targets (grounded in the literature, adjusted downward
for real-world/uncontrolled conditions — use these, not the raw paper
numbers, when the ideal checklist states success criteria)
- Resume parsing extraction accuracy: target **85–90%** (papers report
  90–95% but only on controlled datasets).
- Skill classification F1-score: target **≥0.80** (papers: 0.83–0.91).
- GitHub-based evaluation: no ground truth exists in the literature; frame
  as "correlation with human evaluation ≥0.7" rather than an accuracy claim.
- LLM-based assessment: target **≥0.75 correlation** with human grading
  (papers: 0.82–0.90).
- Processing throughput: target **≤5–10 seconds per resume** (papers
  demonstrate ~500 resumes in 15 minutes under batch conditions).

### What "done right" looks like, module by module (use this as the bar for
the ideal checklist, not just "feature exists")
- Parsing is not "done" if it only extracts text — it must produce
  structured entities via NER *and* semantic embeddings, layered together.
- GitHub validation is not "done" as a binary check — it must produce
  graded evidence metrics that feed a weighted score, and must degrade
  gracefully to an assessment-only fallback when absent.
- Assessment is not "done" as generic LLM Q&A — questions must be generated
  from a structured plan tied to the *specific* candidate's parsed projects,
  and evaluated against an explicit rubric, not open-ended chat grading.
- Scoring is not "done" as a single number — it must retain and expose the
  sub-scores (parsing alignment, GitHub evidence, assessment result) so the
  dashboard can show *why*, per FR-13/FR-15 and guide feedback #5.
