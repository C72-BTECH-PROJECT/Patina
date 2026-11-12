# Promised scope inventory (Phase 1)

Auditor: promised-scope auditor, 2026-11-12, branch `rebuild/fable`.
Purpose: every promise in the submitted scope documents, with stable ids
`PS-nnn`, so the lead can define "complete" for the Nov 18, 2026 evaluation.
This file judges nothing about implementation, and no source code was read.

## 0. Method and evidence labels

- VERIFIED (ran it): all four `.docx` files were opened as zip archives with
  Python's standard library (`zipfile` + `xml.etree`, run with `python -I`).
  Body paragraphs, heading styles, tables, header XML and `docProps` were
  extracted to the session scratchpad (`...\scratchpad\scope\*.txt`). Nothing
  was written into the repo except this file.
- VERIFIED: media inventory.
  - `Objectives.docx` (2.58 MB) has **no images**. Its size comes from four
    embedded fonts (`word/fonts/font1-4.odttf`, about 5 MB uncompressed).
  - `C72_Activity-3` has 7 images. Four are diagrams I viewed (image4 Use Case,
    image3 Level-1 DFD, image7 Sequence, image5 System Architecture). Two are
    university and trust logos (image1, image6). image2.jpg is a photo of a
    printed "Remark of Guide" page. Its remark lines are blank, and it carries
    a guide signature and a co-guide signature.
  - `C72_Activity-2` has 3 images. Two are the same logos (identical md5) and
    one is a 70-byte placeholder.
  - `Literature Review and Comparative Analysis.docx` has no images.
- READ: every statement below about what a document says comes from reading the
  extracted text or viewing the diagram images. Sections are cited by the
  document's own heading numbers. The `.docx` files have no reliable page
  numbers, so I cite sections, not pages.
- Nothing was unreadable. Two things are UNKNOWN: the submission date of the
  Literature Review document (it has no date and no `docProps/core.xml`), and
  whether it was ever formally submitted.

Source abbreviations used below:

| Abbrev | File |
|---|---|
| OBJ | `Docs/scope/Objectives.docx` |
| A2 | `Docs/scope/C72_Activity-2_LY_Project_2025-27.docx` |
| A3 | `Docs/scope/C72_Activity-3_LY-Project_2025-27.docx` (contains the SRS) |
| LR | `Docs/scope/Literature Review and Comparative Analysis.docx` |
| PSD | `PROJECT_SOURCE_DOCS.md` (repo root, cited `PSD:line`) |
| CMD | `CLAUDE.md` "Known guide feedback" section |

## 1. Source documents

**OBJ: Objectives.docx.** A 3-page project brief, about 742 words, headed
"AI-Automated Skill Validation and Credibility Framework, Group: C72". Its
sections are:
- §1 Introduction & Problem Statement
- §2 Objectives (four named objectives)
- §3 Scope (Input, Processing and Output layers, plus Exclusions)
- §4 "Feedback / Suggestions after Sem-End Review" (five items, the written
  source of GF-1..GF-5)
- §5 References (four papers)

There is no date in the text. `docProps` shows it was created and last
modified on 2026-08-02. No addressee is stated. The §4 feedback section shows
it was revised after the semester-end review, so it is the latest of the four
documents.

**A2: C72_Activity-2.** A K. J. Somaiya School of Engineering (Somaiya
Vidyavihar University), Department of Computer Engineering, B.Tech activity
form, dated "06nd Mar 2026", for Project No. C72 (four students). The activity
is a "Literature Survey of at least 10 papers and comparative Study". It
summarises 12 papers, each with problem, methodology, advantages, limitations,
dataset and results. Several summaries end with a sentence tying the paper to
a module of "our project". These sentences are the document's only promises,
and they mostly support promises made elsewhere. The form ends with an empty
"Remark of Guide" block and guide and co-guide signature lines. No signed copy
is embedded. `docProps` author: "ASHISH", created 2026-02-27 (a template).

**A3: C72_Activity-3.** The same institutional form, dated 24th Apr 2026. The
activity asks for "Objectives, Requirement analysis, Dataset, Methodology /
Algorithm". The content is a full SRS:
- §1 Purpose and Scope
- §2 Product perspective, user classes, assumptions
- §3 four diagrams (Use Case, Level-1 DFD, Sequence, System Architecture) and
  §3.1 data model
- §4 FR-1..FR-15
- §5 external interfaces
- §6 NFR-1..NFR-12
- §7 risk table
- §8 datasets
- §9 methodology (four algorithms)

It ends with a photographed, signed "Remark of Guide" page from the
institution. The remarks are blank and both the guide and co-guide signed it.
This is the most detailed and the only formally signed scope document, and
it was submitted to the project guide and co-guide.

**LR: Literature Review and Comparative Analysis.docx.** An undated narrative
literature review with no `docProps`. It covers:
- an overview, four research domains, the comparative analysis and the
  research gap
- "Relevance to the Proposed System" and "Implications for the Proposed System"
- "What This Means for Evaluation"
- a closing section, "Extracting Realistic Metrics (From Your Papers)"

Parts of it read as pasted AI-assistant advice addressed to the team, not
as a submitted document. Examples: "the studies you reviewed", "your
assessment module should not be an open-ended chatbot", "Anything higher =
you're lying or naive", and arrow emoji before targets. All the
literature-derived metric targets (85-90%, F1 >= 0.80, >= 0.7, >= 0.75,
5-10 s) live in that informal section. Whether this file was submitted to
the guide is UNKNOWN.

**PSD: PROJECT_SOURCE_DOCS.md.** The repo's consolidation of OBJ, the SRS (A3)
and LR into Markdown (`PSD:3-6`). It is **not** an independent source:
- It omits A2 entirely.
- It adds editorial interpretation that is not in the originals. See §3,
  C-12, for the fidelity differences.

I used it only as a cross-check. Promises are sourced to the original `.docx`
wherever one exists.

**CMD: CLAUDE.md "Known guide feedback".**
- GF-1..GF-5 are the same five items as OBJ §4, which makes OBJ §4 their
  written source.
- GR-1 (anti-cheat design before the assessment module is built, Sep 2026)
  and GR-2 (identify the API gateway and verify the microservices claim,
  Oct 2026) are owner-reported. They have no written source in any scope
  document.

## 2. Numbered list of promises

Column "CHECKLIST" gives the matching `CHECKLIST.md` id(s), or "none".
A3 section numbers refer to the SRS inside A3.

### 2A. Objectives and scope framing

| ID | Promise (concrete) | Category | Sources | Verbatim quote (<= 25 words) | CHECKLIST |
|---|---|---|---|---|---|
| PS-001 | The system replaces keyword-based ATS screening with evidence-based skill validation of each claimed skill. | objective | OBJ §1; A3 §1.1, §9 intro; LR §8, §9; PSD:13-19 | "Our project aims to solve this by shifting the paradigm from keyword matching to skill validation." (OBJ §1) | none (framing for all modules) |
| PS-002 | Parsing, external-evidence validation, dynamic assessment and explainable output are integrated into **one connected pipeline**. LR states this integration is the project's research contribution. | objective | LR §7, §8, "Research Gap Identified", closing paragraph; PSD:216-223 | "your contribution is the integration of these modules into a single credibility score with explainable evidence." (LR, Research Gap Identified) | none (CHECKLIST "Integration Requirement" section, no id) |
| PS-003 | The system automates the technical screening round and so reduces manual screening time and engineering effort. | objective | OBJ §1, §2 Obj 4 | "our AI-driven engine automates the technical screening round" (OBJ §1); "thereby reducing manual screening time" (OBJ §2) | none |
| PS-004 | The system reduces hiring fraud and resume inflation, so that only genuinely skilled candidates move forward. | objective | OBJ §1; A3 §9 intro | "reduces hiring fraud, and ensures that only genuinely skilled candidates move forward" (OBJ §1) | none |
| PS-005 | The initial screening is bias-free: it evaluates technical merit only, and human bias is removed or minimised. | objective | OBJ §2 (intro and Obj 4); A3 §9.4 | "This aims to remove human bias from the initial screening phase by evaluating technical merit solely" (OBJ §2 Obj 4) | 4.9, 5.12 |
| PS-006 | Scope is limited to technical/coding (software engineering) roles. Validating non-technical soft skills and verifying university degrees through registrar databases are both excluded. | objective (scope boundary) | OBJ §3 Exclusions; A3 §1.2 | "does not validate non-technical soft skills or verify university degrees via registrar databases." (OBJ §3) | 0.9 |
| PS-007 | The objectives call for "dynamic, practical challenges" that "test skills in real-time". This goes beyond question generation and suggests practical or real-time tasks. | objective | OBJ §1 | "It generates dynamic, practical challenges to test skills in real-time and cross-references claims with verifiable data." | none (3.1/3.2 cover questions only) |

### 2B. Input layer and resume parsing (Module 1)

| ID | Promise (concrete) | Category | Sources | Verbatim quote (<= 25 words) | CHECKLIST |
|---|---|---|---|---|---|
| PS-008 | A web portal lets candidates upload their resumes. This is the "Upload Resume" use case. | functional requirement (UI screen) | OBJ §3 Input Layer; A3 §2.2, §3 Use Case diagram | "A web portal allowing candidates to upload resumes (PDF/DOCX)." (OBJ §3) | 5.1 |
| PS-009 | The system accepts resumes in both PDF and DOCX format. | functional requirement | A3 FR-1, §1.2, DFD flow 1 ("Raw PDF/DOCX"); OBJ §3; PSD:122 | "FR-1: The system shall accept resumes in PDF and DOCX format." (A3 §4.1) | 1.1 |
| PS-010 | An NLP parsing engine extracts structured data from unstructured resumes. The fields are skills, experience, projects/project descriptions, project links (OBJ, A3 §9) and education (A3 §3.1). | functional requirement | OBJ §2 Obj 1, §3 NLP Module; A3 FR-2, §3.1 Resume Entity, §9.1; A2 papers 1, 3, 6 relevance notes | "extract structured data (skills, experience, project links) from unstructured PDF resumes." (OBJ §2 Obj 1) | 1.5, 1.9 |
| PS-011 | Extraction works across diverse and complex resume layouts. | functional requirement | OBJ §3 NLP Module; A3 §8.1 | "extract technical skills (e.g., "React," "Docker") and project descriptions from diverse resume layouts." (OBJ §3) | 1.8 |
| PS-012 | Text is extracted with layout-aware tools. The tools named are **pdfplumber** and **IBM DocLing**. | functional requirement (named tools) | A3 §9.1; A2 paper 3 relevance note | "The system utilizes robust layout-aware extraction tools (e.g., pdfplumber, IBM DocLing) to convert unstructured PDF/DOCX resumes into raw text." (A3 §9.1) | 1.3 |
| PS-013 | Text is preprocessed with tokenization and lemmatization before entity extraction. | functional requirement | A3 §9.1 | "This text is preprocessed (tokenized and lemmatized) and fed into a custom-trained Named Entity Recognition (NER) model" (A3 §9.1) | 1.4 |
| PS-014 | A **custom-trained NER model** identifies skills, experience and project links. It is trained on the Hugging Face "Annotated NER PDF Resumes" dataset (5,029 CVs). | functional requirement (named model) | A3 §9.1, §8.1; A2 paper 6 relevance note | "5,029 CV samples, each annotated with IT skills using Named Entity Recognition to train our custom NER model" (A3 §8.1) | 1.5 |
| PS-015 | Extracted entities are converted to dense semantic vectors with **Sentence-BERT (S-BERT)**, so that synonyms and differing terminology still match. | functional requirement (named model) | A3 §9.1; LR §2, Implications 1; A2 paper 4 relevance note | "Extracted entities are then converted into dense semantic vectors using Sentence-BERT (S-BERT)." (A3 §9.1) | 1.6 |
| PS-016 | Parsing uses a hybrid strategy in which layout-aware extraction, NER and semantic embeddings work together as complementary layers. | functional requirement | LR "Implications for the Proposed System" (first point); PSD:226-228 | "the intelligent parsing module should use a hybrid extraction strategy rather than a single technique." (LR Implications) | 1.7 |
| PS-017 | The parser outputs structured entities as **JSON** to the Aggregator. The DFD shows the flow as Input Layer 1.0, then NLP Parser 2.0, then Aggregator 3.0. | architecture claim | A3 §3 DFD (text and image, flow 3) | "The data flows to the NLP Parser, which outputs structured entities (JSON) to the Aggregator." (A3 §3 DFD) | 1.10 |
| PS-018 | Resumes are semantically matched or aligned to target job descriptions, which yields a "Parsing Semantic Alignment" sub-score. This is the "automated screening stage before deeper validation". | functional requirement | A3 §3.1 Score Entity, §8.2; A2 paper 2 relevance note; LR "What This Means for Evaluation" ("matching quality") | "To evaluate the semantic matching capabilities of the system, a dataset of standard technical job descriptions is needed." (A3 §8.2) | 1.14 |
| PS-019 | Resume entity-extraction accuracy is >= 85%. LR gives a target band of 85-90%. | non-functional requirement (metric) | A3 FR-2, NFR-5; LR "Extracting Realistic Metrics" §1 | "NFR-5: Resume parsing accuracy shall be ≥ 85%." (A3 §6.2) | 1.11, 6.1 |
| PS-020 | Skill classification F1-score is >= 0.80. | non-functional requirement (metric) | A3 NFR-6; LR "Extracting Realistic Metrics" §2 | "NFR-6: Skill classification F1-score shall be ≥ 0.80." (A3 §6.2) | 1.12, 6.2 |
| PS-021 | Each resume is processed in <= 10 seconds. LR says "<= 5-10 seconds". | non-functional requirement (metric) | A3 FR-3, NFR-1; LR "Extracting Realistic Metrics" §5 | "FR-3: The system shall process each resume within 10 seconds." (A3 §4.1) | 1.13, 6.3 |

### 2C. GitHub evidence validation (Module 2)

| ID | Promise (concrete) | Category | Sources | Verbatim quote (<= 25 words) | CHECKLIST |
|---|---|---|---|---|---|
| PS-022 | The GitHub username is obtained either by extracting it from the resume or from user input. | functional requirement | A3 FR-4, §9.2 | "FR-4: The system shall extract GitHub usernames from resumes or user input." (A3 §4.2) | 2.1 |
| PS-023 | Candidates authenticate GitHub through **OAuth 2.0**. This is the "Authenticate GitHub" use case, and the GitHub API is a secondary actor. | functional requirement / external integration | A3 §2.2, §3 Use Case (text and image), §5.1 | "The system requires OAuth 2.0 authentication." (A3 §5.1 GitHub API) | 2.2, 5.2 |
| PS-024 | Repository data is retrieved in real time through the **GitHub REST/GraphQL API**: repositories, commits, metadata, language statistics and raw code files from public profiles. | functional requirement / external integration | A3 FR-5, §5.1, §8.3, §9.2; OBJ §2 Obj 2 ("real-time data from the GitHub API") | "The GitHub REST/GraphQL API will fetch dynamic metadata, including commit frequency, language usage statistics, and raw code files directly from public profiles" (A3 §8.3) | 2.3 |
| PS-025 | GitHub metrics are computed and combined into a composite. The sources name these metrics:<br>- repository count, commit frequency and code-quality indicators (FR-6)<br>- code complexity, repository ownership and activity consistency (OBJ)<br>- language breakdown and code-quality flags (Repository Entity) | functional requirement | A3 FR-6, §3.1 Repository Entity; OBJ §2 Obj 2 | "calculating a composite score based on code complexity, commit frequency, repository ownership, and activity consistency." (OBJ §2 Obj 2) | 2.4 |
| PS-026 | Claims are cross-referenced against evidence: the system checks for actual code contributions in the **claimed languages** and confirms authorship from commit history. | functional requirement | OBJ §2 Obj 2, §3 Validation & Aggregator Module; A3 §1.2 | "verify if the candidate has actual code contributions in the claimed languages. It cross-references commit history to confirm authorship" (OBJ §3) | 2.5 |
| PS-027 | Code quality is assessed with the **8DFS heuristic**:<br>- it targets up to 8 core logic files per repository, skipping config and boilerplate<br>- it approximates cyclomatic complexity and code smells<br>FR-7 says "at least 5-10 core files". | functional requirement (named algorithm) | A3 FR-7, §9.2; A2 paper 7 relevance note | "the system implements an 8DFS heuristic algorithm. This algorithm targets up to eight core logic code files to approximate cyclomatic complexity and code smells" (A3 §9.2) | 2.6 |
| PS-028 | Static analysis runs on raw code files with tools such as **CodeQL and SonarQube**. | functional requirement (named tools) | A3 §8.3 | "raw code files directly from public profiles to run static analysis (e.g., CodeQL, SonarQube)." (A3 §8.3) | none (2.6 covers static analysis but names no tools) |
| PS-029 | GitHub evidence augments the other evidence and is not treated as absolute truth. It strengthens or weakens confidence in resume claims and is never a pass/fail gate. | functional requirement | LR "Implications" (second point); PSD:229-232 | "the GitHub validation module should be treated as evidence augmentation, not absolute truth." (LR Implications) | 2.7 |
| PS-030 | GitHub-based evaluation reaches a correlation with human evaluation of >= 0.7. | non-functional requirement (metric) | LR "Extracting Realistic Metrics" §3 only (not in SRS) | "Correlation with human evaluation ≥ 0.7" (LR, Extracting Realistic Metrics §3) | 2.12, 6.4 |

### 2D. Generative AI assessment (Module 3)

| ID | Promise (concrete) | Category | Sources | Verbatim quote (<= 25 words) | CHECKLIST |
|---|---|---|---|---|---|
| PS-031 | An LLM-driven assessment engine replaces static question banks. | functional requirement | OBJ §2 Obj 3; A3 §9.3 | "Create a dynamic Assessment Module that replaces static "Question Banks" with an LLM-driven engine." (OBJ §2 Obj 3) | 3.2 |
| PS-032 | Questions are generated from **this candidate's** skills and projects. The sources say "stated projects" (OBJ), "skills and projects" (FR-8), "verified GitHub projects" (A3 §9.3) and "parsed projects" (Sequence diagram). | functional requirement | OBJ §2 Obj 3, §3 Generative Assessment Module; A3 FR-8, §9.3, §3 Sequence; LR Implications (third point) | "FR-8: The system shall generate technical questions based on candidate skills and projects." (A3 §4.3) | 3.1 |
| PS-033 | Each generated question set is unique and "un-cheatable". | functional requirement | OBJ §2 Obj 3; A3 §1.2, §9.3; A2 paper 9 relevance note | "generate unique, un-cheatable technical interview questions tailored specifically to the candidate's stated projects." (OBJ §2 Obj 3) | 3.2 (GR-1 related) |
| PS-034 | Question generation uses the **PFQS (Planning First, Question Second)** framework. An instruction-tuned LLM first produces a structured answer plan that controls topic and difficulty, and that plan then drives question generation. | functional requirement (named algorithm) | A3 FR-9, §9.3, §3 Sequence step 3 `generateQuestionPlan(parsedProjects, PFQSFramework)`; LR §5, Implications; A2 paper 9 | "FR-9: The system shall control question difficulty using a structured generation approach. This process will utilize the PFQS (Planning First, Question Second) framework." (A3 §4.3) | 3.3, 3.4 |
| PS-035 | The LLM evaluates candidate answers against **predefined rubrics**. The engine is a controlled evaluator, not an open-ended chatbot. | functional requirement | A3 FR-10, §3 Sequence step 8 `evaluateAnswers(answers, assessmentRubric)`, §5.2; LR Key Findings (fourth point); A2 paper 8 relevance note | "FR-10: The system shall evaluate candidate responses using predefined rubrics." (A3 §4.3) | 3.5 |
| PS-036 | AI hallucination in scoring is mitigated by the rubric plus constraints. | non-functional requirement (risk mitigation) | A3 §7 Risk table | "AI hallucination \| Incorrect scoring \| Use rubric + constraints" (A3 §7) | 3.6 |
| PS-037 | The assessment flow runs end to end in this order (this is the "Take Assessment" use case):<br>1. The frontend requests an assessment.<br>2. The backend gets the parsed projects from the database.<br>3. The LLM generates a question plan with PFQS.<br>4. The questions are shown to the candidate.<br>5. The candidate's answers are submitted.<br>6. The LLM evaluates the answers with the rubric.<br>7. The answers and results are **stored in the database**. | functional requirement (UI screen + flow) | A3 §3 Sequence diagram (text and image, steps 1-10), §3 Use Case, §2.2 | "evaluated by the LLM via a rubric, and finally stored in the database." (A3 §3 Sequence) | 3.7, 5.3 |
| PS-038 | The assessment module supports parallel execution. | non-functional requirement | A3 NFR-4 | "NFR-4: The assessment module must support parallel execution." (A3 §6.1) | 3.10, 0.8 |
| PS-039 | LLM grading reaches a correlation of >= 0.75 with human grading. | non-functional requirement (metric) | A3 FR-11, NFR-7; LR "Extracting Realistic Metrics" §4 | "NFR-7: LLM evaluation correlation with human grading shall be ≥ 0.75." (A3 §6.2) | 3.9, 6.5 |
| PS-040 | The LLM's evaluation rubrics are calibrated with the **APPS** dataset (coding problems plus unit tests), using technical QA datasets with graded answers. The SRS says "fine-tune". | functional requirement (named dataset) | A3 §8.4 | "APPS (Automated Programming Progress Standard)" dataset ... "to fine-tune the LLM's technical evaluation rubrics" (A3 §8.4) | 3.8, 6.8 |

### 2E. Unified credibility scoring (Module 4)

| ID | Promise (concrete) | Category | Sources | Verbatim quote (<= 25 words) | CHECKLIST |
|---|---|---|---|---|---|
| PS-041 | One composite score is computed from **all three** inputs: the parsing output, the GitHub validation metrics and the assessment results. | functional requirement | A3 FR-12, §9.4, §3 DFD (Scoring Engine 4.0); LR §8 | "FR-12: The system shall compute a composite score using resume parsing output, GitHub validation metrics, and assessment results." (A3 §4.4) | 4.1 |
| PS-042 | The three outputs are normalised and aggregated with weights into a "Credibility Score", shown as a weighted "Truth Score" from 0 to 100%. | functional requirement | A3 §9.4; OBJ §3 Output Layer | "The outputs from the NLP parser, the GitHub evidence metrics, and the LLM assessment are normalized and aggregated into a weighted composite "Credibility Score"." (A3 §9.4) | 4.2, 4.3 |
| PS-043 | A dedicated **explainability layer** shows the breakdown of factors behind each score, so recruiters can audit the reasoning. The SRS presents this as its bias mitigation, and guide feedback GF-5 calls it "crucial". | functional requirement + guide feedback (GF-5) | A3 FR-13, §1.2, §9.4, §7 Risk ("Biased evaluation" → "Add explainability layer"); OBJ §4 item 5; LR §8, Implications (fourth point); CMD GF-5 | "FR-13: The system shall display a breakdown of contributing factors." (A3 §4.4); "Score explainability crucial." (OBJ §4.5) | 4.5, GF-5 |
| PS-044 | A Score entity persists the composite score **and** the granular sub-scores: Parsing Semantic Alignment, GitHub Evidence and Assessment Results. | functional requirement (data) | A3 §3.1 Score Entity | "Stores the composite Credibility Score and the granular sub-scores (Parsing Semantic Alignment, GitHub Evidence, Assessment Results) to feed the explainability dashboard." (A3 §3.1) | 0.3, 4.4 |
| PS-045 | Inconsistencies between claims and evidence are flagged and shown to recruiters. | functional requirement | OBJ §3 Output Layer | "displaying a weighted "Truth Score" (0-100%), detailed skill breakdowns, and flagged inconsistencies for decision-making." (OBJ §3) | 4.6, 5.9 |
| PS-046 | Scoring Engine and record-keeping:<br>- A distinct **Scoring Engine** process (DFD 4.0) receives the candidate metadata and skills plus the fetched GitHub metadata from the Aggregator, and the evaluation results from the LLM Assessment Module.<br>- It writes scoring logs to a "**Scoring Records**" data store (D1).<br>- The Aggregator, not the parser, sends the skills on to the LLM Assessment Module. | architecture claim | A3 §3 DFD (text and image: flows 4, 5, 6, 7, 8 and store D1) | "Candidate skills flow to the LLM Assessment Module, which sends evaluation results to the Scoring Engine." (A3 §3 DFD text, paraphrasing image) | none (closest 4.11 auditability) |

### 2F. Recruiter dashboard and candidate portal (Module 5)

| ID | Promise (concrete) | Category | Sources | Verbatim quote (<= 25 words) | CHECKLIST |
|---|---|---|---|---|---|
| PS-047 | A recruiter "Credibility Score" dashboard visualises the validation results and **skill breakdowns**. | functional requirement (UI screen) | OBJ §2 Obj 4, §3 Output Layer; A3 §3 Use Case "View Dashboard"; LR §8 | "Provide recruiters with a "Credibility Score" dashboard that visualizes validation results and skill breakdowns." (OBJ §2 Obj 4) | 5.7, 5.11 |
| PS-048 | Recruiters see candidate rankings and can compare applicants. | functional requirement (UI screen) | A3 FR-14, §2.2 | "FR-14: The system shall allow recruiters to view candidate rankings." (A3 §4.5); "compare applicants" (A3 §2.2) | 5.5 |
| PS-049 | The dashboard explains each candidate with intermediate evidence: skills matched, repository metrics, test results and the reasoning behind the final score. It shows these, not just a final number. | functional requirement (UI screen) | A3 FR-15; LR Implications (fourth point) | "FR-15: The system shall provide explainable insights (skills matched, repo metrics, test results)." (A3 §4.5) | 5.7 |
| PS-050 | Recruiters can filter candidates. | functional requirement (UI screen) | A3 §3 Use Case ("Filter Candidates", text and image) | "Recruiters trigger the "View Dashboard," "Filter Candidates," and "Audit Score Breakdown" use cases." (A3 §3) | 5.6 |
| PS-051 | Recruiters can audit the score breakdown, analysing the explanations and the automated reasoning behind each score. | functional requirement (UI screen) | A3 §3 Use Case ("Audit Score Breakdown"), §2.2, §9.4 | "ensures recruiters can audit the automated reasoning, actively minimizing human bias" (A3 §9.4) | 5.8 |
| PS-052 | There are two user classes with separate interfaces:<br>- **Candidates** upload resumes, authenticate GitHub and take assessments.<br>- **Recruiters** view scores, analyse explanations and compare applicants. | functional requirement | A3 §2.1, §2.2 | "The system consists of a frontend (candidate + recruiter interfaces) and backend microservices (NLP, validation, assessment)." (A3 §2.1) | 0.4 |

### 2G. Architecture claims and external integrations

| ID | Promise (concrete) | Category | Sources | Verbatim quote (<= 25 words) | CHECKLIST |
|---|---|---|---|---|---|
| PS-053 | The system is a web-based distributed application. | architecture claim | A3 §2.1 | "The system is a web-based distributed application." (A3 §2.1) | 0.1 |
| PS-054 | The system follows a **microservices architecture**, with separate backend microservices for NLP, validation and assessment. | architecture claim | A3 §2.1, §3 System Architecture (title "MERN Stack Microservices Application Architecture") | "It utilizes a microservices architecture." (A3 §2.1) | 0.1, GR-2 |
| PS-055 | The presentation layer is a **React** frontend. | architecture claim | A3 §3 System Architecture (text and image) | "It visually separates the Presentation Layer (React frontend), the Application Layer (Node/Express backend routing)" (A3 §3) | 0.1 |
| PS-056 | The application layer is a **Node/Express backend that does routing and is labelled "API Gateway"** in the diagram. The frontend calls it over REST/HTTP, and it calls the NLP Engine ("Analyze Text"), the Assessment Engine ("Calculate Score") and the GitHub Aggregator ("Fetch Data"). | architecture claim | A3 §3 System Architecture image (box "Node/Express Backend & Routing (API Gateway)", edge "REST API / HTTP") | Image label: "Node/Express Backend & Routing (API Gateway)" (A3 §3 System Architecture diagram) | 0.1, GR-2 |
| PS-057 | The microservices layer has three Python services: the **NLP Engine** ("Text Analysis"), the **Assessment Engine** ("Logic & Scoring") and the **GitHub Aggregator** ("Data Retrieval"). Each one reads from and writes to the database directly. | architecture claim | A3 §3 System Architecture (text and image) | "the Microservices Layer (Python NLP Engine, Assessment Engine, GitHub Aggregator), and the Data Layer (MongoDB)." (A3 §3) | 0.1 |
| PS-058 | The data layer is **MongoDB** (NoSQL), as part of a "MERN stack". This conflicts with the actual Supabase choice; see C-1. | architecture claim | A3 §3 System Architecture (text and image "MongoDB (NoSQL Database)") | "A structural view of the MERN stack application." ... "the Data Layer (MongoDB)." (A3 §3) | 0.2 (rewritten as Supabase) |
| PS-059 | The data model has four entities:<br>- **User**: authentication and contact details for candidates and recruiters<br>- **Resume**: raw file reference plus parsed Skills, Experience and Education arrays<br>- **Repository**: commit frequency, language breakdown and code-quality flags, linked to the candidate<br>- **Score**: see PS-044 | architecture claim (data) | A3 §3.1 | "Resume Entity: Stores the raw file reference and structured parsed arrays (Skills, Experience, Education)." (A3 §3.1) | 0.2, 0.3, 2.11 |
| PS-060 | An external LLM provider API (**OpenAI or Gemini**, also written "Gemini/GPT") generates questions and evaluates answers. | architecture claim / external integration | A3 §5.2, §2.1, §3 Architecture; OBJ §3 Generative Assessment Module | "The system requires an LLM Provider API (e.g., OpenAI/Gemini) for question generation and answer evaluation." (A3 §5.2) | none (implied by 3.x) |

### 2H. Non-functional requirements (performance, security, reliability)

| ID | Promise (concrete) | Category | Sources | Verbatim quote (<= 25 words) | CHECKLIST |
|---|---|---|---|---|---|
| PS-061 | Each microservice scales independently. | non-functional requirement | A3 NFR-3 | "NFR-3: Microservices must scale independently." (A3 §6.1) | 0.1 |
| PS-062 | The system supports >= 100 concurrent users. | non-functional requirement (metric) | A3 NFR-2 | "NFR-2: The system must support ≥ 100 concurrent users." (A3 §6.1) | 0.8, 6.6 |
| PS-063 | System uptime is >= 95%. | non-functional requirement (metric) | A3 NFR-11 | "NFR-11: System uptime shall be ≥ 95%." (A3 §6.3) | 0.8, 6.7 |
| PS-064 | Authentication uses OAuth 2.0. NFR-8 does not restrict this to GitHub. | non-functional requirement (security) | A3 NFR-8, §5.1 | "NFR-8: The system shall use OAuth 2.0 for authentication." (A3 §6.3) | 0.4 |
| PS-065 | All API keys are stored securely. | non-functional requirement (security) | A3 NFR-9 | "NFR-9: All API keys must be stored securely." (A3 §6.3) | 0.5 |
| PS-066 | All data is transmitted over HTTPS. | non-functional requirement (security) | A3 NFR-10 | "NFR-10: Data transmission shall occur via HTTPS." (A3 §6.3) | 0.6 |
| PS-067 | The system fails gracefully on API errors, and API failures are handled with retry plus fallback. | non-functional requirement (reliability) | A3 NFR-12, §7 Risk ("API failure") | "NFR-12: The system must implement graceful failure on API errors." (A3 §6.3); "API failure \| System downtime \| Retry + fallback" (A3 §7) | 0.7, 2.13, 3.11 |
| PS-068 | Three stated constraints are accepted and handled: limited access to private repositories, dependence on third-party APIs, and variability in LLM responses. | non-functional requirement (constraint) | A3 §2.3; LR §4, Key Findings (third point) | "Constraints: There is limited access to private repositories, and the system depends on third-party APIs. LLM responses may also introduce variability." (A3 §2.3) | 2.10, 3.11 |

### 2I. Datasets and evaluation

| ID | Promise (concrete) | Category | Sources | Verbatim quote (<= 25 words) | CHECKLIST |
|---|---|---|---|---|---|
| PS-069 | Two named resume datasets are used to test and train parsing: Kaggle "Resume Classification Dataset for NLP" and Hugging Face "Mehyaar/Annotated_NER_PDF_Resumes". | deliverable (dataset use) | A3 §8.1 | "The "Resume Classification Dataset for NLP" available on Kaggle" (A3 §8.1) | 6.8 (and 1.5) |
| PS-070 | Two named job-description datasets are used to evaluate semantic matching: Kaggle "IT Job Posts Descriptions" and Kaggle "it-job-roles-skills-dataset". | deliverable (dataset use) | A3 §8.2 | "The "IT Job Posts Descriptions" dataset on Kaggle" (A3 §8.2) | 6.8 |
| PS-071 | Each module is evaluated on its own and the full pipeline is evaluated as well. The measures are parsing quality, matching quality, GitHub evidence coverage, assessment agreement with human judgement, and overall processing time. Each uses the metric that fits the module. | non-functional requirement (testing/evaluation claim) | LR "What This Means for Evaluation" | "you should evaluate each module separately and then evaluate the full pipeline." (LR) | 6.1-6.5 (partial; "matching quality" and "GitHub evidence coverage" have none) |

### 2J. Guide feedback and guide-review items

| ID | Promise (concrete) | Category | Sources | Verbatim quote (<= 25 words) | CHECKLIST |
|---|---|---|---|---|---|
| PS-072 | LinkedIn profiles and certificates are validated. | guide feedback | OBJ §4 item 1; CMD GF-1; PSD:52 | "1. linkedin and certificates validation" (OBJ §4) | GF-1, 1.16, 4.10, 5.13 |
| PS-073 | OCR is mandatory. PSD adds "for scanned/image resumes"; the source does not say this. | guide feedback | OBJ §4 item 2; CMD GF-2; PSD:53 | "2. OCR is a must." (OBJ §4) | GF-2, 1.2, 1.15 |
| PS-074 | Candidates who work on support projects, not only development, get a scoring solution of their own. "Maintenance" is a PSD and CMD gloss; the source says only "support project". | guide feedback | OBJ §4 item 3; CMD GF-3; PSD:54-55 | "3. A solution to score candidates who work on support project and not only development." (OBJ §4) | GF-3, 1.17, 2.9, 4.8, 4.12 |
| PS-075 | GitHub is optional. A candidate with no GitHub data still gets evaluated through an **assessment-only fallback**. | guide feedback + functional requirement | OBJ §4 item 4; A3 §7 Risk ("No GitHub data"); LR Implications (second point); CMD GF-4 | "4. Github should be optional." (OBJ §4); "No GitHub data \| Incomplete evaluation \| Allow assessment-only fallback" (A3 §7) | GF-4, 2.8, 3.13, 4.7, 5.2, 5.10 |
| (GF-5) | Merged into **PS-043** (explainability). | guide feedback | OBJ §4 item 5; CMD GF-5 | "5. Score explainability crucial." (OBJ §4) | GF-5 |
| PS-076 | Before the LLM/PFQS assessment module is built, a mechanism that stops candidates cheating on it is designed. The source is owner-reported only; no scope document contains it. | guide feedback | CMD GR-1 (guide review, Sep 2026) | "before the LLM/PFQS assessment module is built, design a mechanism that prevents candidates from cheating on it." (CMD) | GR-1 |
| PS-077 | The API gateway is identified, the system is verified to really follow the microservices architecture the SRS claims, and any gap is fixed. The source is owner-reported only. | guide feedback | CMD GR-2 (guide feedback, Oct 2026) | "identify the API gateway and verify the system actually follows the microservices architecture claimed in the SRS; fix it if it doesn't." (CMD) | GR-2 |

### 2K. Academic deliverables

| ID | Promise (concrete) | Category | Sources | Verbatim quote (<= 25 words) | CHECKLIST |
|---|---|---|---|---|---|
| PS-078 | Literature survey of at least 10 papers with a comparative study. A2 covers 12 papers; LR adds the narrative comparison and the research gap. | deliverable | A2 title block; LR | "Literature Survey of at least 10 papers and comparative Study" (A2) | none |
| PS-079 | The Activity-3 documents: objectives with details, a requirement analysis (the SRS), dataset details with sources, and the methodology/algorithm with justification. They include the use case, Level-1 DFD, sequence and system architecture diagrams. | deliverable | A3 activity header, §3 | "Objectives: List of objectives with details / Requirement analysis: requirement analysis document / Dataset ... / Methodology / Algorithm" (A3 header) | none |

### Counts by category

Rows with mixed labels are counted under their first label. PS-043 is counted
as a functional requirement and also stands in for GF-5. PS-075 is counted as
guide feedback.

| Category | Count | IDs |
|---|---|---|
| Objective | 7 | PS-001..PS-007 |
| Functional requirement | 36 | PS-008..PS-016, PS-018, PS-022..PS-029, PS-031..PS-035, PS-037, PS-040..PS-045, PS-047..PS-052 |
| Non-functional requirement | 16 | PS-019..PS-021, PS-030, PS-036, PS-038, PS-039, PS-061..PS-068, PS-071 |
| Architecture claim | 10 | PS-017, PS-046, PS-053..PS-060 |
| Deliverable | 4 | PS-069, PS-070, PS-078, PS-079 |
| Guide feedback | 6 | PS-072..PS-077 (GF-5 is folded into PS-043) |
| **Total** | **79** (+ 1 merged GF-5 reference) | |

## 3. Contradictions between sources

**C-1. Database: MongoDB vs Supabase.**
- A3 §3 System Architecture says: "A structural view of the MERN stack
  application ... the Data Layer (MongoDB)." The diagram is titled "MERN Stack
  Microservices Application Architecture" and shows "MongoDB (NoSQL Database)".
- CMD says: "DB: Supabase (SRS originally specified MongoDB — Supabase is the
  actual implementation choice; treat Supabase as authoritative)".
- PSD:106-107 says: "Data (MongoDB, though implementation has moved to
  Supabase — treat Supabase as the actual data layer)".
- No scope document submitted to the guide mentions Supabase. The signed SRS
  promises MongoDB and "MERN". "MERN" also implies Node is the only backend,
  while the same diagram shows Python microservices.

**C-2. Three diagrams disagree on where scoring and LLM calls live.**
- DFD (A3 §3): a separate "Process 4.0 SCORING ENGINE" writes "D1 Scoring
  Records". The Aggregator feeds "Candidate Skills" to "5.0 LLM ASSESSMENT
  MODULE".
- System Architecture (A3 §3 image): there is no scoring service. The
  "Assessment Engine (Logic & Scoring)" is reached by a "Calculate Score" edge.
  The arrow from "OpenAI / Gemini APIs" goes into the **Python NLP Engine**,
  not the Assessment Engine.
- Sequence (A3 §3): "The Backend ... pings the LLM API (using the PFQS
  framework)". The backend, not an Assessment Engine microservice, calls the
  LLM.
- The result: the scope documents describe three different homes for LLM
  calls (NLP Engine, Assessment Engine, Backend) and two for scoring (a
  separate Scoring Engine, or the Assessment Engine).

**C-3. Module lists differ.**
- OBJ §3 has four parts: NLP Module, Validation & Aggregator Module, Generative
  Assessment Module, Recruiter Dashboard. There is no separate scoring module.
- A3 §4 has five functional modules: Resume Parsing, GitHub Validation,
  Generative Assessment, Credibility Scoring, Dashboard.
- A3 §2.1 names three backend microservices: "NLP, validation, assessment".
- A3 Architecture names three: "Python NLP Engine, Assessment Engine, GitHub
  Aggregator".
- A3 DFD names five processes: Input Layer, NLP Parser, Aggregator, Scoring
  Engine, LLM Assessment Module.
- LR §8 names four: "Intelligent Parsing Module", "GitHub Validation Module",
  "Generative Assessment Module", "Credibility Dashboard".

**C-4. The score has three names, and only one has a range.**
- OBJ §1: "providing recruiters with a "Confidence Score" based on actual
  evidence".
- OBJ §2 and A3: "Credibility Score".
- OBJ §3: "a weighted "Truth Score" (0-100%)". Only the "Truth Score" has a
  stated range.

**C-5. Input formats: PDF only vs PDF and DOCX.**
- OBJ §2 Obj 1: "from unstructured PDF resumes."
- OBJ §3, A3 FR-1 and A3 §1.2: "upload resumes (PDF/DOCX)" and "accept
  resumes in PDF and DOCX format".

**C-6. How many files 8DFS analyses.**
- A3 FR-7: "analyze at least 5-10 core files per repository for code quality."
- A3 §9.2: "This algorithm targets up to eight core logic code files".
- "At least 5-10" (a minimum that may be 10) is incompatible with "up to
  eight" (a maximum of 8).
- PSD:132-134 merges the two into one FR-7 gloss, which hides the conflict.

**C-7. GitHub metrics are named differently in three places.**
- OBJ §2 Obj 2: "code complexity, commit frequency, repository ownership, and
  activity consistency".
- A3 FR-6: "repository count, commit frequency, and code quality indicators".
- A3 §3.1 Repository Entity: "Commit Frequency, Language Breakdown, Code
  Quality Flags".
- Only commit frequency appears in all three.

**C-8. Is GitHub mandatory or optional?**
- A3 §2.3 says: "Assumptions: Candidates provide valid GitHub profiles". The
  Use Case gives every candidate "Authenticate GitHub".
- A3 §9.3 says: "an instruction-tuned language model reads the candidate's
  verified GitHub projects", so assessment generation depends on GitHub.
- The other side:
  - OBJ §4 item 4: "Github should be optional."
  - A3 §7: "Allow assessment-only fallback".
  - OBJ §2 Obj 3: "tailored specifically to the candidate's stated projects".
  - The Sequence diagram: `getParsedProjects()` from the database, which uses
    resume projects, not GitHub.
- The signed SRS promises both that GitHub is assumed and that the system
  falls back when it is absent. The question source is either GitHub or the
  resume.

**C-9. Guide feedback vs the scope exclusions.**
- OBJ §3 Exclusions: "The system currently focuses on technical/coding roles
  and does not validate non-technical soft skills or verify university degrees
  via registrar databases."
- OBJ §4: "1. linkedin and certificates validation" and "3. A solution to
  score candidates who work on support project and not only development."
- Validating certificates is close to the excluded credential verification.
  Support-project candidates may fall outside "technical/coding roles". Both
  appear in the same document; the feedback section was added later.

**C-10. Is OAuth 2.0 for user login or only for GitHub?**
- A3 NFR-8: "The system shall use OAuth 2.0 for authentication." This is
  unqualified, so it covers all users.
- A3 §5.1 (under "GitHub API"): "The system requires OAuth 2.0
  authentication."
- A3 §3.1 User Entity: "Stores basic authentication and contact details for
  Candidates and Recruiters". This suggests the app has its own credentials.

**C-11. The documents frame the metric targets differently.**
- A3 FR-2 and NFR-5: "≥85%".
- LR: "What YOU should claim: 85–90% extraction accuracy".
- A3 FR-3 and NFR-1: "within 10 seconds".
- LR: "Process 1 resume in ≤ 5–10 seconds".
- LR: "Correlation with human evaluation ≥ 0.7" for GitHub has **no SRS
  counterpart**.
- LR also says "your own evaluation should not copy one number blindly", yet
  the SRS gives single fixed numbers.

**C-12. PSD differs from the original documents.** PSD is used as "the full
spec" by CLAUDE.md, so these differences matter.
- (a) PSD:53 adds "(for scanned/image resumes)" to GF-2. The original says
  only "OCR is a must."
- (b) PSD:54-55 and CMD say "support/maintenance". The original says "support
  project".
- (c) PSD:51 heads the feedback "must be reflected in the ideal design". The
  original heading is "Feedback / Suggestions after Sem-End Review".
- (d) PSD:132-134 adds 8DFS to FR-7. See C-6.
- (e) PSD:188-189 says APPS is used "to calibrate LLM evaluation rubrics". The
  original A3 §8.4 says "to fine-tune the LLM's technical evaluation rubrics".
- (f) PSD:181 adds "(for training/eval, not runtime dependency)", which is not
  in the original.
- (g) PSD omits several things:
  - the "API Gateway" label in the architecture diagram
  - the DFD "Scoring Records" store
  - the LLM-to-NLP-Engine arrow
  - "MERN stack"
  - CodeQL/SonarQube (A3 §8.3)
  - OBJ §5 references
  - all of A2
- (h) PSD:254-266, "What 'done right' looks like", is PSD editorial and does
  not appear in LR.

**C-13. What the APPS dataset can calibrate.**
- A3 §8.4 proposes APPS ("thousands of coding problems and unit tests") to
  calibrate rubrics.
- The promised assessment is project-specific interview questions with rubric
  grading (A3 FR-8, FR-10, §9.3).
- APPS has no interview answers or graded open-ended responses, so it does not
  match the assessment format it is meant to calibrate.

## 4. Ambiguous or unmeasurable promises

| PS id | Promise | Why it is hard to verify |
|---|---|---|
| PS-033 (and PS-076) | "un-cheatable" questions | There is no threat model and no definition. Uniqueness of questions is testable; resistance to candidate-side cheating (LLM help, a second person) is not, unless GR-1 produces a written design with stated test cases. |
| PS-005 | "bias-free" / "remove human bias" | There is no fairness metric, no protected attribute and no baseline. The only stated mitigation is the explainability layer (A3 §7), which is a design feature, not a measured outcome. |
| PS-003, PS-004 | "reducing manual screening time", "reduces hiring fraud", "only genuinely skilled candidates move forward" | There is no baseline, user study or fraud dataset. These can't be verified in a demo; at best they can be argued qualitatively. |
| PS-007 | "dynamic, practical challenges to test skills in real-time" | Not defined. It could mean a coding sandbox or a timed session. No FR backs it; the FRs only cover generated questions plus rubric grading. |
| PS-018 | "Parsing Semantic Alignment" sub-score / semantic matching to JDs | No FR defines what the resume is aligned *to*. JDs appear only in the dataset section (A3 §8.2). There is no metric for "matching quality" (LR). |
| PS-019 | >= 85% extraction accuracy | The unit is undefined (per entity, per field, per resume) and so is the matching rule (exact or fuzzy). No labelled test set is designated, although A3 §8.1 names datasets. |
| PS-020 | Skill classification F1 >= 0.80 | No FR defines a "skill classification" task. The target comes from A2 paper 11 (hard/soft/not-skill tagging), which was not adopted as a feature. |
| PS-030 | GitHub correlation >= 0.7 | The source itself says "No ground truth exists". It requires human-rated profiles that do not exist in any named dataset. |
| PS-039 | LLM vs human grading correlation >= 0.75 | It needs a human-graded answer set for project-specific questions. None is named, and APPS does not fit (C-13). |
| PS-021 | <= 10 s per resume | It is unclear whether this is cold or warm, includes OCR (PS-073) and NER/S-BERT model load, or covers parsing alone or the full pipeline. |
| PS-062, PS-063 | >= 100 concurrent users; >= 95% uptime | No measurement window, environment or definition of "concurrent" (sessions or in-flight requests). Uptime can't be shown in a one-day demo. |
| PS-061 | "Microservices must scale independently" | This is a deployment property. It can only be shown with separate deployables and a scaling mechanism; a single-machine demo does not show it. |
| PS-027 | FR-7 "at least 5-10 core files" vs "up to eight" | The range contradicts itself (C-6), and "core logic file" has no operational definition. |
| PS-025 | "code quality indicators", "activity consistency", "repository ownership" | None is defined as a formula. |
| PS-042 | weighted 0-100% score | No weights are stated anywhere, so any weighting satisfies the text. |
| PS-043, PS-049, PS-051 | explainability / "audit the automated reasoning" | There is no acceptance criterion for what counts as an adequate explanation. |
| PS-065 | "API keys must be stored securely" | "Securely" is undefined (server-side environment, a vault, rotation). |
| PS-067 | "graceful failure", "Retry + fallback" | The fallback behaviour is not specified for any individual API. |
| PS-072 | "linkedin and certificates validation" | It does not say what they are validated against. LinkedIn's public API access is restricted, and certificate issuers vary. Validation might mean URL format, identity match or issuer verification. |
| PS-074 | "A solution to score candidates who work on support project" | There is no criterion for when support candidates count as fairly scored. |
| PS-071 | evaluate each module and the full pipeline | Advisory wording ("should"). No test plan, dataset split or pass bar is given for "matching quality" or "GitHub evidence coverage". |
| PS-016 | "hybrid extraction strategy" | Advisory wording ("should"), in the informal part of LR. It is unclear when "hybrid" is satisfied. |
| PS-014 | custom-trained NER model | "Custom-trained" could mean fine-tuned on the named dataset or any trained model. No model family is named. |

The documents also say nothing on several topics a lead might expect to see
promised. These are observations, not promises:
- **No testing claims.** No document promises unit, integration or end-to-end
  testing. LR's evaluation advice (PS-071) is the only testing-like statement.
- **No privacy or retention promise.** There is nothing on data retention,
  consent or PII handling. A2 paper 10 lists "privacy concerns when using
  external APIs" only as a limitation of that paper.
- **No login or landing screens.** The only UI screens promised are resume
  upload, GitHub authentication, taking the assessment, and the recruiter
  dashboard (view, filter, audit, rankings). The landing, login and candidate
  dashboard screens appear only in CLAUDE.md "Architecture (as designed)",
  which was outside my assigned sources.
- **Literature-only techniques.** A2 mentions MOSS, CodeBERT, plagiarism or
  AI-code detection, fuzzy lexicon matching, TF-IDF and controlled vocabularies
  only as literature. They are not promised for this system.

## 5. CHECKLIST.md cross-reference

Each PS row above gives its CHECKLIST id. Promises with **no** CHECKLIST id:
- PS-001, PS-002 (the CHECKLIST "Integration Requirement" section has no id)
- PS-003, PS-004, PS-007
- PS-028 (CodeQL/SonarQube)
- PS-046 (Scoring Engine and Scoring Records store)
- PS-060 (LLM provider)
- PS-078, PS-079 (academic deliverables)
- part of PS-071 (matching quality, GitHub evidence coverage)

CHECKLIST ids that match **no promise in the scope documents**:

| CHECKLIST id | Why it has no scope-document source |
|---|---|
| 4.11 | Determinism and re-explainability. No document mentions reproducibility. The DFD "Scoring Records" store is the closest. |
| 5.4 | Candidate can see their submission or parse status. No source. |
| 5.14 | Score-on-apply. The source is INTEGRATION_REVIEW R9 (an internal decision). The documents have no job or application concept beyond the JD datasets. |
| 5.15 | Merged application-centric recruiter dashboard with shortlist/reject. The source is INTEGRATION_REVIEW R38. Shortlist/reject actions are not promised anywhere. |
| X-1 | Recruiter audit log. The source is the archived team tracker. |
| X-2 | Code-originality signals (MOSS, CodeBERT, repository diversity). These appear in A2 paper 12 and A2/LR literature only, never as a promise for this system. |

Some CHECKLIST ids do map to a promise but add detail that no scope document
contains:
- 1.15: the unreadable-input status, derived from GF-2 and NFR-12.
- 1.17: the specific support-tool vocabulary.
- 2.3: rate-limit and pagination handling.
- 2.9: crediting bug-fix commits and PR reviews.
- 4.12: the paired-fixture fairness measurement.
- 5.1: upload progress and error UI.
- 5.3: the assessment session persisting across interruption.
- 0.8: queued/async work.
- 0.2: Supabase in place of MongoDB, which reverses the signed SRS (C-1).

GR-1 and GR-2 are sourced only from CLAUDE.md. Of the sources I was given,
none in `Docs/scope/` contains them.
