# AI-Automated Skill Validation and Credibility Framework

## 1. Project Overview & Scope
[cite_start]The project aims to replace keyword-based Applicant Tracking Systems (ATS) with a multi-layered evaluation pipeline to combat resume inflation[cite: 39]. [cite_start]It shifts the recruitment paradigm toward verifiable, evidence-based skill evaluation[cite: 39]. 
* [cite_start]**Scope:** Focuses strictly on technical/coding roles[cite: 44].
* [cite_start]**Exclusions:** Explicitly excludes degree verification and non-technical soft skill validation[cite: 44].

## 2. System Architecture
[cite_start]The system is a web-based distributed application utilizing a microservices architecture[cite: 45, 46].
* [cite_start]**Presentation Layer:** React frontend containing candidate and recruiter interfaces[cite: 64, 46].
* [cite_start]**Application Layer:** Node/Express backend handling routing[cite: 64].
* [cite_start]**Microservices Layer:** Python-based services including the NLP Engine, Assessment Engine, and GitHub Aggregator[cite: 64].
* [cite_start]**Data Layer:** MongoDB[cite: 64].
* [cite_start]**External Integrations:** GitHub API (OAuth 2.0, REST/GraphQL) and LLM Provider API (OpenAI/Gemini)[cite: 65, 85, 86, 102].

## 3. Structural Models & Data Flow
The system's operational logic flows through four distinct phases:

* [cite_start]**Actor Interactions (Use Case Logic):** Candidates trigger resume uploads, GitHub authentication, and assessments[cite: 53]. [cite_start]Recruiters trigger dashboard views, candidate filtering, and score breakdown audits[cite: 54].
* [cite_start]**Data Flow Pipeline (DFD Logic):** 1. Raw PDF/DOCX enters the Input Layer[cite: 57].
    2. [cite_start]Data flows to the NLP Parser, which outputs structured JSON entities to the Aggregator[cite: 57].
    3. [cite_start]The Aggregator fetches repository metadata from GitHub and routes it to the Scoring Engine[cite: 58].
    4. [cite_start]Simultaneously, parsed skills trigger the LLM Assessment Module, which evaluates responses and sends results to the Scoring Engine[cite: 59].
    5. [cite_start]The Scoring Engine consolidates a Credibility Score and sends it to the Recruiter Dashboard[cite: 60].
* [cite_start]**Assessment Sequence (Sequence Logic):** The backend retrieves parsed projects and pings the LLM API using the PFQS framework to generate an answer plan[cite: 62]. [cite_start]Dynamic questions are served to the candidate, answers are evaluated by the LLM via a rubric, and results are stored[cite: 63].
* **Database Schema (ER Logic):**
    * [cite_start]`User`: Authentication and contact details[cite: 66].
    * [cite_start]`Resume`: Raw file reference, parsed arrays (Skills, Experience, Education)[cite: 67].
    * [cite_start]`Repository`: GitHub metadata (Commit Frequency, Language Breakdown, Code Quality Flags) linked to a Candidate[cite: 68].
    * [cite_start]`Score`: Composite Credibility Score and granular sub-scores[cite: 69].

## 4. Core Methodologies & Algorithms
* [cite_start]**Intelligent Resume Parsing:** Utilizes tools like pdfplumber/IBM DocLing for extraction, followed by a custom-trained Named Entity Recognition (NER) model to identify entities[cite: 106, 107]. [cite_start]Extracted text is converted into dense semantic vectors using Sentence-BERT (S-BERT) to understand semantic proximity rather than rigid keyword overlap[cite: 108, 110].
* [cite_start]**Evidence-Based Verification (GitHub):** Implements an 8DFS heuristic algorithm targeting up to eight core logic files to approximate code complexity and smells, intentionally bypassing boilerplate[cite: 112, 113].
* [cite_start]**Generative Technical Assessment:** Utilizes the Planning First, Question Second (PFQS) framework[cite: 115]. [cite_start]The LLM generates a structured answer plan based on verified projects before generating the actual questions, tightly controlling topic and difficulty[cite: 116, 117].

## 5. Performance Targets & NFRs
Based on comparative literature analysis, the system targets the following realistic metrics:
* [cite_start]**Processing Speed:** Resume processing time shall be ≤ 10 seconds[cite: 87].
* [cite_start]**Parsing Accuracy:** ≥ 85%[cite: 89].
* [cite_start]**Skill Classification:** F1-score ≥ 0.80[cite: 90].
* [cite_start]**Assessment Reliability:** LLM evaluation correlation with human grading ≥ 0.75[cite: 90].
* [cite_start]**Scalability:** Must support ≥ 100 concurrent users with independently scaling microservices[cite: 88].

## 6. Current Timeline & Immediate Focus
* [cite_start]**Current State:** Mid-May 2026[cite: 6].
* [cite_start]**Current Milestone:** First Term Integration[cite: 395].
* [cite_start]**Immediate Action Items:** Integrating the NLP Parser with the GitHub Data Fetcher and running preliminary testing on sample resumes to calculate initial parsing accuracy[cite: 395, 396].