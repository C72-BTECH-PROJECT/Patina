# Project Developer Checklist: AI-Automated Skill Validation Framework

## 1. Project Initialization & Architecture

- [x] Set up the React frontend (Landing, Login, Candidate Dashboard, Upload, Recruiter Views).
- [x] Set up the Node.js/Express backend (Routing, CORS, Middleware).
- [x] Set up the Python/FastAPI microservice for the NLP engine.
- [x] Configure persistent database storage and application data access (Supabase schema, RLS, and queries).
- [ ] Implement User Authentication (Local email/password + Google OAuth & GitHub OAuth).
- [x] Implement prototype local email/password authentication with session-based login, logout, and current-user endpoints.
- [x] Configure a server-side Supabase client and environment-variable template; persistent tables and RLS are configured.
- [x] Establish microservice communication (Node.js backend forwarding files to Python FastAPI).

## 2. Intelligent Resume Parsing (NLP Module)

- [x] **FR-1:** Accept resumes in PDF and DOCX formats.
- [x] Extract raw text using layout-aware extraction tools (`pdfplumber` / `python-docx`).
- [ ] **Feedback #2:** Implement OCR (Optical Character Recognition) to handle scanned PDFs or image-based resumes.
- [x] Clean and tokenize text (implemented in `preprocessor.py`).
- [x] Custom NER Extraction: Extract Candidate Name, Contact Info (Email, Phone, Links).
- [x] Custom NER Extraction: Extract and structure Projects (Titles and Descriptions).
- [x] Custom NER Extraction: Extract Education and Experience.
- [x] Extract Skills and use semantic embeddings (S-BERT) to calculate semantic similarity against the Job Description (`embedder.py`).
- [ ] **FR-3:** Verify and optimize processing to ensure resumes are parsed in 10 seconds or less.

## 3. GitHub Validation Module (Aggregator)

- [x] **FR-4:** Extract a GitHub username from a resume profile URL.
- [ ] **FR-5:** Retrieve repository data and commits using the GitHub API (`githubAggregator.js`).
- [x] **Feedback #4:** Make GitHub validation optional; analysis continues when no GitHub URL is found.
- [ ] **FR-6:** Compute aggregate metrics: repository count, commit frequency, and language breakdown.
- [ ] **FR-7:** Implement the **8DFS heuristic algorithm** to fetch and analyze 5-10 core logic files for code quality (cyclomatic complexity, code smells), intentionally bypassing boilerplate.

## 4. Extended Validation (Review Feedback Additions)

- [ ] **Feedback #1:** Implement LinkedIn profile scraping/validation.
- [ ] **Feedback #1:** Implement Certificate parsing and validation (cross-referencing credential IDs).
- [ ] **Feedback #3:** Develop a distinct scoring matrix/solution to fairly evaluate candidates who work on Support/Maintenance projects rather than pure Development.

## 5. Generative AI Assessment Module

- [ ] **FR-8:** Integrate an LLM API (OpenAI/Gemini) to drive the dynamic assessment engine.
- [ ] **FR-9:** Implement the **PFQS (Planning First, Question Second)** framework:
  - Generate a structured "answer plan" based on the candidate's parsed projects.
  - Dictate the generation of dynamic, un-cheatable interview questions tailored to their experience.
- [ ] Develop the Candidate Assessment UI (the frontend testing environment).
- [ ] **FR-10:** Evaluate candidate responses against the generated rubrics using the LLM.

## 6. Unified Credibility Scoring

- [ ] **FR-12:** Develop the Scoring Engine to normalize and aggregate outputs (Parsing + GitHub Metrics + Assessment Results) into a single composite "Credibility Score".
- [ ] **FR-13 & Feedback #5:** Ensure **Score Explainability**. Retain the granular breakdown of all contributing factors (e.g., why a score was penalized).

## 7. Recruiter Dashboard & Output

- [x] Build the foundational Recruiter interface layout (`Recruiter/Dashboard.jsx`, `CreateJob.jsx`).
- [x] Implement job listing and creation endpoints backed by Supabase persistent storage.
- [x] Implement local resume upload and Express-to-FastAPI analysis.
- [ ] Link parsed resume analyses to persistent `applications` table (currently still using in-memory store in `analysis.controller.js`).
- [ ] **FR-14:** Display candidate rankings dynamically based on their Credibility Score.
- [ ] **FR-15:** Visualize the explainable insights (skills matched, repo metrics, test results) clearly in the UI.
- [ ] Implement an alert system for Flagged Inconsistencies (e.g., Candidate claims 'Expert' in Python, but failed the LLM Python assessment or has 0 Python repositories).
