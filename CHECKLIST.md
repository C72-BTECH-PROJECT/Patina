# CHECKLIST.md — Ground-Truth Feature List

Derived **only** from `PROJECT_SOURCE_DOCS.md` (Objectives + SRS + Literature
Review). This describes what the system **should** be if built correctly. It is
not a status report — nothing here is claimed to exist. Every item states what
"done correctly" means per the spec, not merely that a feature is present.

Traceability tags: `FR-n` / `NFR-n` from the SRS, `GF-n` from guide feedback,
`M-n` from the four methodology algorithms, `LR` from literature-review design
implications.

**The project's actual contribution is the integration of all four modules into
one explainable pipeline (LR: Research Gap).** A module that works in isolation
but does not feed the unified score is not done.

---

## Module 0: Cross-Cutting Requirements

These apply to every module; a module is not "done correctly" if it violates them.

| # | Requirement | "Done correctly" means |
|---|---|---|
| 0.1 | Microservices architecture (§2.1, NFR-3) | React presentation layer, Node/Express application/routing layer, and independently deployable Python services (NLP Engine, GitHub Aggregator, Assessment Engine). Each scales independently; Node forwards work rather than implementing NLP/LLM logic inline. A monolith that merely has folders named after services does not satisfy this. |
| 0.2 | Data layer (§3, §3.1) | Supabase is the authoritative store (SRS says MongoDB; implementation choice supersedes). All four entities persist: **User**, **Resume**, **Repository**, **Score**. |
| 0.3 | Entity completeness (§3.1) | `Resume` stores the raw file reference *and* structured parsed arrays (Skills, Experience, Education). `Repository` stores fetched GitHub metadata (commit frequency, language breakdown, code-quality flags) linked to a candidate. `Score` stores the composite **plus** the granular sub-scores (Parsing Semantic Alignment, GitHub Evidence, Assessment Results) — sub-scores must be persisted, not recomputed on render. |
| 0.4 | Auth (NFR-8, §5) | OAuth 2.0. Two distinct user classes with distinct capabilities: Candidate (upload, connect GitHub, take assessment) and Recruiter (view/filter/audit). A recruiter must not be able to reach candidate-only actions and vice versa. |
| 0.5 | Secrets (NFR-9) | GitHub and LLM API keys held server-side in environment config. No key reachable from the browser bundle or committed to the repo. |
| 0.6 | Transport (NFR-10) | HTTPS for all data transmission. |
| 0.7 | Graceful degradation (NFR-12, §7 Risk table) | Every external call (GitHub API, LLM API) has retry + fallback. An API failure degrades the score with a stated reason; it never crashes the pipeline or silently produces a score that looks complete. |
| 0.8 | Concurrency (NFR-2, NFR-4, NFR-11) | ≥100 concurrent users; assessment module executes in parallel; ≥95% uptime target. Long-running work is queued/async rather than blocking a request thread. |
| 0.9 | Scope discipline (Objectives §Exclusions) | Technical/coding roles only. No soft-skill validation. No degree verification via registrar databases. |

---

## Module 1: Resume Parsing & Semantic Extraction

Spec: FR-1..FR-3, NFR-1, NFR-5, NFR-6, M-1, GF-2, LR.

| # | Item | "Done correctly" means |
|---|---|---|
| 1.1 | Multi-format ingestion (FR-1) | Accepts **PDF and DOCX**. Both paths reach the same structured output; DOCX is not a stub or a rejected type. |
| 1.2 | OCR for scanned resumes (GF-2) | Image-based / scanned PDFs are detected (no extractable text layer) and routed through OCR, then through the same NLP pipeline. "Done" = a scanned resume yields the same structured entity set as a native PDF, not an empty result. OCR is mandatory, not optional. |
| 1.3 | Layout-aware extraction (M-1) | Uses layout-aware tooling (pdfplumber / IBM DocLing class of tools) that preserves sections, columns and tables. Naive full-text dump that loses multi-column ordering is not done. |
| 1.4 | Preprocessing (M-1) | Tokenization and lemmatization applied before entity extraction. |
| 1.5 | NER entity extraction (FR-2, M-1) | A **custom/trained NER model** (per dataset §8: HF "Annotated NER PDF Resumes", 5,029 CVs) extracts skills, projects, experience — not a hardcoded keyword/skill-list match. Regex/dictionary lookup alone fails this item. |
| 1.6 | Semantic embeddings (M-1, LR) | **S-BERT** (or equivalent sentence embeddings) produce semantic vectors for skills and project descriptions, so synonyms and differing vocabulary match. Rigid keyword intersection is explicitly called out as insufficient. |
| 1.7 | Hybrid layering (LR) | 1.3 + 1.5 + 1.6 operate **together as layers**, not as alternatives — layout-aware extraction feeds NER, NER output is embedded semantically. A pipeline using only one technique is not done. |
| 1.8 | Layout robustness (Scope, Processing Layer) | Extraction works across **diverse resume layouts**, not one template. Should be demonstrated against a varied sample set. |
| 1.9 | Project-link extraction (Objective 1) | Project links (GitHub/portfolio URLs) are extracted as structured fields, since they seed Modules 2 and 3. |
| 1.10 | Structured JSON contract (DFD L1) | Output is structured JSON (skills, experience, education, projects) consumed by the Aggregator and the Assessment module. The contract is stable and versioned enough for downstream modules to rely on. |
| 1.11 | Accuracy target (FR-2, NFR-5, LR) | ≥85% extraction accuracy (target band 85–90%), **measured and recorded** against a labelled sample — not asserted. |
| 1.12 | Skill classification quality (NFR-6, LR) | Skill classification F1 ≥0.80, measured. |
| 1.13 | Latency (FR-3, NFR-1, LR) | ≤10s per resume end-to-end for parsing (target band 5–10s), measured. |
| 1.14 | Parsing sub-score emitted (§3.1) | Produces a **Parsing Semantic Alignment** sub-score (semantic proximity of candidate skills to the target role/JD), persisted to the Score entity — parsing is not done if it only writes entities and contributes nothing to the composite. |

---

## Module 2: GitHub Evidence Validation

Spec: FR-4..FR-7, M-2, §5, GF-4, GF-3, LR, §7 Risk table.

| # | Item | "Done correctly" means |
|---|---|---|
| 2.1 | Username acquisition (FR-4) | GitHub username obtained **either** by extraction from the resume **or** by explicit user input. Both paths supported; failure of one falls through to the other. |
| 2.2 | OAuth 2.0 GitHub auth (§5, NFR-8, Use Case) | Candidate can authenticate GitHub via OAuth 2.0, not just supply a bare username string. |
| 2.3 | Repository retrieval (FR-5) | Real-time repo data via GitHub REST/GraphQL API (§8: live evidence, not a static dataset). Rate limits and pagination handled. |
| 2.4 | Core metrics (FR-6, Objective 2) | Computes at minimum: repository count, **commit frequency**, **language breakdown**, **repository ownership** (own work vs. fork/clone), **activity consistency over time**, and code-quality indicators. Ownership and consistency are explicit spec items, not optional extras. |
| 2.5 | Claim cross-referencing (Objective 2, Scope) | Verifies actual code contributions **in the languages the resume claims** and cross-references commit history for authorship/capability. A generic profile-stats fetch that never compares against parsed resume claims does not satisfy this. |
| 2.6 | 8DFS heuristic (FR-7, M-2) | Static analysis over **5–10 core files per repo, targeting up to 8 core logic files**, deliberately bypassing boilerplate/config/vendor files, approximating cyclomatic complexity and code smells. "Done" = the file-selection heuristic actually filters boilerplate and the complexity/smell approximation is computed — not a file count or LOC total. |
| 2.7 | Graded, not binary (LR, GF-4) | Output is a set of **graded evidence metrics feeding a weighted score** — evidence that strengthens or weakens confidence in resume claims. A binary pass/fail gate, or a hard requirement that GitHub exist, is explicitly wrong. |
| 2.8 | GitHub optional (GF-4, §7 Risk "No GitHub data") | A candidate with no GitHub still completes the pipeline and receives a score, via **assessment-only fallback**. Weights redistribute; the dashboard states that GitHub evidence was unavailable rather than scoring it as zero-competence. |
| 2.9 | Fairness for support/maintenance work (GF-3) | Scoring credits maintenance/support signals — bug-fix commits, contributions to existing/third-party repos, issue and PR review activity, sustained small commits — not only greenfield authorship. A candidate who maintains rather than creates must not be structurally penalised. |
| 2.10 | Private-repo limitation handled (§2.3) | Limited private-repo access is acknowledged in the score explanation rather than silently reducing the candidate's evidence. |
| 2.11 | Repository entity persisted (§3.1) | Fetched metadata (commit frequency, language breakdown, quality flags) stored against the candidate, so the dashboard audits evidence without re-hitting the API. |
| 2.12 | GitHub sub-score emitted (§3.1) | Produces a **GitHub Evidence** sub-score with its constituent metrics retained for explainability. Framed per LR as "correlation with human evaluation ≥0.7", not as an accuracy claim. |
| 2.13 | Resilience (NFR-12) | Retry + fallback on GitHub API failure; partial data is labelled partial. |

---

## Module 3: Generative AI Assessment

Spec: FR-8..FR-11, M-3, §5, Sequence diagram, LR, §7 Risk table.

| # | Item | "Done correctly" means |
|---|---|---|
| 3.1 | Candidate-specific generation (FR-8, Objective 3) | Questions generated from **this candidate's** parsed skills and *specific* projects (and, where available, verified GitHub projects). Generic role-level or topic-level questions do not satisfy this. |
| 3.2 | Static banks eliminated (Objective 3) | No static question bank. Every assessment instance is uniquely generated — "un-cheatable" in the sense that the question set is not pre-existing or reusable. |
| 3.3 | PFQS framework (FR-9, M-3, LR) | **Planning First, Question Second**, implemented as two distinct LLM steps: (a) generate a structured **answer plan** controlling topic and difficulty; (b) that plan dictates the generated questions. A single zero-shot "write me questions" prompt is explicitly the wrong approach and does not satisfy FR-9. |
| 3.4 | Difficulty control (FR-9) | Difficulty is a controlled parameter set by the plan and observable in the stored plan, not an emergent property of the prompt. |
| 3.5 | Rubric-based evaluation (FR-10, LR) | Candidate answers evaluated against **explicit, predefined rubrics** — stored, inspectable, and applied consistently. Open-ended "grade this answer" chat grading is not done. |
| 3.6 | Hallucination constraints (§7 Risk "AI hallucination") | Rubric + explicit constraints bound the LLM's scoring output (schema-constrained, range-bounded, justification required) so a hallucinated judgement cannot silently move the score. |
| 3.7 | Sequence conformance (§3 Sequence) | Frontend requests assessment → backend retrieves parsed projects → LLM generates question plan (PFQS) → questions served → answers returned → LLM evaluates via rubric → **results stored in DB**. Every step present, results persisted. |
| 3.8 | Rubric calibration (§8) | Evaluation rubrics calibrated against a reference set (APPS coding problems + unit tests) rather than authored ad hoc. |
| 3.9 | Correlation target (FR-11, NFR-7, LR) | ≥0.75 correlation between LLM grading and human grading, **measured and documented** against a human-graded sample. |
| 3.10 | Parallel execution (NFR-4) | Assessment generation/evaluation runs in parallel across candidates; one slow LLM call does not serialise the system. |
| 3.11 | LLM resilience (§2.3, NFR-12) | LLM response variability handled: schema validation, retry, and a defined fallback when the provider fails — with the failure surfaced in the score explanation. |
| 3.12 | Assessment sub-score emitted (§3.1) | Produces an **Assessment Results** sub-score, persisted with per-question rubric outcomes so the dashboard can show which answers drove it. |
| 3.13 | Standalone sufficiency (§7 Risk) | The assessment path alone can produce a valid credibility score when GitHub evidence is absent (pairs with 2.8). |

---

## Module 4: Unified Credibility Scoring

Spec: FR-12, FR-13, M-4, §3.1, GF-3, GF-5, GF-1, §7 Risk table, LR.

| # | Item | "Done correctly" means |
|---|---|---|
| 4.1 | Three-input composite (FR-12, M-4) | Composite score computed from **all three** inputs: parsing output, GitHub validation metrics, assessment results. A score derived from one or two sources is not the specified score. |
| 4.2 | Normalisation before aggregation (M-4) | Heterogeneous sub-scores normalised onto a common scale before weighting — not raw metrics summed. |
| 4.3 | Weighted aggregation (Objective 4, Scope Output Layer) | An explicit, documented weighting scheme produces a 0–100 "Credibility / Truth Score". Weights are configurable and stated, not buried magic numbers. |
| 4.4 | Sub-scores retained (§3.1, LR) | Parsing Semantic Alignment, GitHub Evidence, and Assessment Results are **stored alongside** the composite. A single number with no retained components fails this outright. |
| 4.5 | Explainability layer (FR-13, GF-5, LR) | A dedicated explainability layer states *why* the score is what it is: which factors contributed, in which direction, with what weight, citing the underlying evidence (matched skills, specific repo metrics, specific rubric outcomes). Anti-black-box is a core deliverable, not a UI nicety. |
| 4.6 | Flagged inconsistencies (Scope Output Layer) | Contradictions between claimed and evidenced skill (claimed language absent from all repos, claimed seniority contradicted by assessment) are computed and surfaced as explicit flags. |
| 4.7 | Missing-evidence weighting (GF-4, 2.8) | When GitHub is absent, weights redistribute across the remaining sources and the score is annotated as evidence-limited — never computed as if GitHub scored zero. |
| 4.8 | Fair maintenance-work scoring (GF-3) | The weighting model does not structurally disadvantage support/maintenance candidates; the profile type is recognised and scored on appropriate evidence. |
| 4.9 | Bias mitigation (Objective 4, §7 Risk "Biased evaluation") | Scoring evaluates technical merit only; the explainability layer is the stated mitigation for biased ranking and must therefore be auditable per candidate. |
| 4.10 | LinkedIn + certificate validation (GF-1) | Additional evidence sources — LinkedIn profile and certificates — validated and folded into the evidence set feeding the composite, with their own explainable contribution. Explicit guide requirement; the design must accommodate it. |
| 4.11 | Determinism / auditability | The same inputs reproduce the same composite, and a stored score can be re-explained after the fact from persisted sub-scores and evidence (pairs with 0.3). |

---

## Module 5: Recruiter Dashboard & Candidate Portal

Spec: FR-14, FR-15, §2.2, Use Case, Scope Input/Output layers, GF-5.

### 5A. Candidate-facing (Input Layer, §2.2)

| # | Item | "Done correctly" means |
|---|---|---|
| 5.1 | Web upload portal | Candidate uploads PDF/DOCX through the web portal with validation, progress, and clear errors on unsupported/corrupt files. |
| 5.2 | GitHub authentication (Use Case) | Candidate can connect GitHub via OAuth — **and can skip it** and still proceed (GF-4). Skipping must be a first-class path, not a dead end. |
| 5.3 | Take assessment (Use Case) | Candidate attempts the generated assessment, submits answers, and the session persists across interruption. |
| 5.4 | Candidate visibility | Candidate can see their submission/parse status; the system does not fail silently. |

### 5B. Recruiter-facing (Output Layer, FR-14/FR-15)

| # | Item | "Done correctly" means |
|---|---|---|
| 5.5 | Candidate rankings (FR-14) | Recruiters view candidates **ranked by the composite credibility score**, comparably across applicants (§2.2: "compare applicants"). |
| 5.6 | Filtering (Use Case) | Recruiters filter candidates (by skill, score band, evidence availability). |
| 5.7 | Score breakdown view (FR-15, GF-5) | Per candidate, the dashboard shows **skills matched, repo metrics, and test/assessment results** as the three visible pillars — the intermediate evidence, not just the final number (LR: exposing intermediates is the differentiator). |
| 5.8 | Audit score breakdown (Use Case) | A recruiter can drill from the composite → sub-score → the specific underlying evidence (which repo, which commit metric, which rubric line). This is the "Audit Score Breakdown" use case and is the project's headline differentiator. |
| 5.9 | Flagged inconsistencies surfaced (Scope) | The flags from 4.6 are visible on the candidate view with their supporting evidence. |
| 5.10 | Evidence-limited candidates displayed fairly (GF-4) | A candidate without GitHub renders with a clear "assessment-only / evidence limited" indication rather than an unexplained low or blank section. |
| 5.11 | Skill breakdown visualisation (Objective 4) | Skill-level breakdown visualised, not only an aggregate — recruiters see per-skill confidence. |
| 5.12 | Bias-free presentation (Objective 4) | Presentation surfaces technical merit only; no non-technical or demographic signals in the ranking view. |

---

## Module 6: Evaluation & Evidence of Correctness

Every numeric target in the spec is a claim that must be **measured**. Untested
targets are not "done". Grouped here so the metrics are not lost inside modules.

| # | Target | Source | Evidence required |
|---|---|---|---|
| 6.1 | Resume extraction accuracy 85–90% | FR-2, NFR-5, LR | Measured on a labelled resume sample; result recorded. |
| 6.2 | Skill classification F1 ≥0.80 | NFR-6, LR | Measured F1 on held-out labelled data. |
| 6.3 | Resume processing ≤10s (target 5–10s) | FR-3, NFR-1, LR | Timed benchmark, end to end, including OCR path. |
| 6.4 | GitHub evaluation ≥0.7 correlation with human judgement | LR | Framed as correlation, not accuracy; measured against human-rated profiles. |
| 6.5 | LLM assessment ≥0.75 correlation with human grading | FR-11, NFR-7, LR | Measured against a human-graded answer set; APPS-calibrated rubrics. |
| 6.6 | ≥100 concurrent users | NFR-2 | Load test. |
| 6.7 | Uptime ≥95% | NFR-11 | Monitored, with graceful-failure behaviour verified (NFR-12). |
| 6.8 | Datasets used as specified | §8 | Kaggle Resume Classification; HF Annotated NER PDF Resumes (NER training); Kaggle IT Job Posts / IT Job Roles & Skills (JD side); GitHub API live (not static); APPS (rubric calibration). |

---

## Guide-Feedback Compliance Map (must all be satisfiable)

| GF | Requirement | Covered by |
|---|---|---|
| GF-1 | LinkedIn + certificate validation | 4.10 |
| GF-2 | OCR is a must | 1.2 |
| GF-3 | Fair scoring for support/maintenance candidates | 2.9, 4.8 |
| GF-4 | GitHub must be optional | 2.7, 2.8, 4.7, 5.2, 5.10, 3.13 |
| GF-5 | Score explainability is crucial | 4.4, 4.5, 5.7, 5.8, 5.9 |

## Integration Requirement (the actual contribution — LR Research Gap)

The system is only "done correctly" when parsing → GitHub validation →
assessment → scoring → dashboard operate as **one connected, explainable
pipeline**: parsed entities seed both GitHub verification and assessment
generation; both feed one normalised weighted composite; the composite is
auditable back down to the individual pieces of evidence on the recruiter
dashboard. Four working modules that do not connect end to end do not satisfy
the project's stated contribution.
