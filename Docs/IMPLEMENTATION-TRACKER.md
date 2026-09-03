# Patina — Implementation Tracker

## Project Overview
AI-Automated Skill Validation and Credibility Framework
Group C72 | K.J. Somaiya School of Engineering | Guide: Dr. Shruti Javkar

---

## Tech Stack (from Docs)

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 19, Tailwind CSS | Presentation layer |
| Backend | Node.js, Express | API gateway, routing, auth |
| NLP Microservice | Python, FastAPI, spaCy, S-BERT | Resume parsing, embeddings |
| Database (Relational) | Supabase PostgreSQL | users, audit_logs |
| Database (Document) | Firebase Firestore | job_descriptions, parsed_profiles, github_metrics, assessments, credibility_scores |
| Object Storage | Supabase Storage | resumes/ bucket (PDF/DOCX) |
| External APIs | GitHub API, LLM API (OpenAI/Gemini) | Verification + Assessment |

---

## Completed Features

### Frontend
- [x] Landing page
- [x] Role selection
- [x] Login / Signup
- [x] Candidate Dashboard
- [x] Resume upload (PDF/DOCX)
- [x] Recruiter Dashboard (stat cards, charts, alerts)
- [x] Create Job (multi-step form)
- [x] Job Details + candidate list
- [x] Candidate Modal (skills, GitHub stats, assessment, flags)
- [x] Recruiter Layout (nav, mobile FAB)
- [x] Candidate Layout
- [x] Shared components (Logo, Button, Card, Badge, Input, Spinner, EmptyState)
- [x] Full "Quiet Intelligence" design system migration

### Backend
- [x] Node.js/Express setup
- [x] Basic routing and CORS
- [x] Auth context (email/password)
- [x] MongoDB models (User, Job, Application)

### NLP Engine
- [x] FastAPI server setup
- [x] Basic PDF text extraction
- [x] spaCy preprocessing
- [x] Custom NER extraction
- [x] S-BERT embeddings
- [x] Cosine similarity scoring

---

## Missing Features - Prioritized

### CRITICAL (Core Functionality)

#### 1. Database Migration (MongoDB to Supabase + Firestore)
Per doc, must have:
- **Supabase PostgreSQL**: users table, audit_logs table
- **Firebase Firestore**: job_descriptions, parsed_profiles, github_metrics, assessments, credibility_scores
- **Supabase Storage**: resumes/ bucket with row-level security

Schema reference:
```
users table:
- id (PK), name, email, hashed_password, role, github_token, created_at

audit_logs table:
- id (PK), recruiter_id (FK), candidate_id, action, detail, timestamp, ip_address

Firestore collections:
- job_descriptions: jdId, title, recruiterId, requiredSkills[], preferredSkills[],
  jdText, sbert_vector (384 floats), status, applicantCount, tags[]

- parsed_profiles: skills[], experience[], education[], projects[],
  noun_chunks[], similarity_score, match_level

- github_metrics: totalCommits, repoCount, activityScore, languages{},
  repoDiversity, consistencyRating, plagiarismScore, aiCodeScore,
  cyclomaticComplexity, verifiedProfile, oauthConnected

- assessments: questions[], answers[], rubricUsed, assessmentScore,
  compositeScore, weightConfig{}, flaggedInconsistencies[], explanation{}

- credibility_scores: compositeScore (0-100), nlpScore, githubScore,
  assessmentScore, per-skill breakdown
```

#### 2. GitHub API Integration
- [ ] GitHub OAuth flow for candidates
- [ ] githubAggregator.js - fetch repo data, commits, languages
- [ ] 8DFS heuristic algorithm - scan 5-10 core logic files, bypass boilerplate
- [ ] Compute: commit frequency, repo count, language breakdown, repo diversity
- [ ] Code complexity metrics (cyclomatic complexity)
- [ ] Plagiarism score (MOSS integration)
- [ ] AI code detection (CodeBERT)
- [ ] Private repo metadata via OAuth token
- [ ] Store results in Firestore github_metrics collection

#### 3. Generative AI Assessment Engine
- [ ] LLM API integration (OpenAI or Gemini)
- [ ] PFQS Framework implementation:
  1. Generate structured "answer plan" from parsed projects
  2. Generate dynamic interview questions based on plan
  3. Evaluate candidate responses against rubric
  4. Store results with rubric for audit
- [ ] Assessment endpoint in backend
- [ ] Assessment flow in candidate UI

#### 4. Composite Credibility Score Engine
- [ ] Score normalization (NLP + GitHub + Assessment to 0-100)
- [ ] Weight configuration (weightConfig{})
- [ ] Score explainability - per-skill breakdown of what contributed
- [ ] Flagged inconsistencies generation engine
- [ ] Store in Firestore credibility_scores collection

### IMPORTANT (Completes the System)

#### 5. Authentication
- [ ] Google OAuth integration
- [ ] GitHub OAuth integration (for both login + data access)
- [ ] JWT token management

#### 6. Backend Endpoints
- [ ] GitHub data aggregation proxy
- [ ] Assessment generation endpoint
- [ ] Score calculation endpoint
- [ ] Audit log auto-insertion on every recruiter action
- [ ] File proxy to Python NLP (verify exists)

#### 7. Score Explainability UI
- [ ] Per-skill breakdown on recruiter dashboard
- [ ] "Why this score" explanation panel
- [ ] Verified vs unverified skills visualization

#### 8. Candidate Assessment UI
- [ ] Testing environment for candidate
- [ ] Question display
- [ ] Answer submission
- [ ] Score results

#### 9. OCR Support
- [ ] Scanned PDF handling
- [ ] Image-based resume OCR

### NICE-TO-HAVE (Feedback Additions)

#### 10. Extended Validation
- [ ] LinkedIn profile scraping/validation
- [ ] Certificate parsing + validation (credential ID cross-reference)
- [ ] Support/Maintenance project scoring matrix

---

## Data Categories Quick Reference

| Category | Format | Store | Database |
|----------|--------|-------|----------|
| User accounts & roles | SQL rows | Relational | Supabase PostgreSQL |
| Audit logs | SQL rows | Relational | Supabase PostgreSQL |
| Resume files (PDF/DOCX) | Binary blob | Object | Supabase Storage |
| Job descriptions | JSON doc | Document | Firebase Firestore |
| NLP parsed profiles | JSON doc | Document | Firebase Firestore |
| GitHub metrics | JSON doc | Document | Firebase Firestore |
| Assessment data | JSON doc | Document | Firebase Firestore |
| Credibility scores | JSON doc | Document | Firebase Firestore |

---

## Free Tier Feasibility (10 candidates, 4 recruiters, 1 admin)

| Platform | Resource | Free Limit | Est. Use | % Used |
|----------|----------|------------|----------|--------|
| Supabase PostgreSQL | DB storage | 500 MB | ~30 KB | 0.006% |
| Supabase PostgreSQL | Monthly users | 50,000 MAU | 15 users | 0.03% |
| Supabase Storage | File storage | 1 GB | ~5 MB | 0.50% |
| Firebase Firestore | Storage | 1 GB | ~220 KB | 0.02% |
| Firebase Firestore | Reads/day | 50,000 | ~150 | 0.30% |
| Firebase Firestore | Writes/day | 40,000 | ~60 | 0.15% |

**Total monthly cost: $0**

---

## Performance Targets (from Docs)

| Metric | Target | Current |
|--------|--------|---------|
| Resume processing time | <= 10 seconds | Unknown - needs benchmarking |
| NER extraction accuracy | >= 85% | Unknown |
| Skill classification F1 | >= 0.80 | Unknown |
| Assessment reliability (vs human) | >= 0.75 | N/A |
| Concurrent users | >= 100 | Unknown |

---

## API Endpoints

```
POST /parse
  Base: http://localhost:8000 (FastAPI)
  Content-Type: multipart/form-data
  Payload: file (PDF), job_description (string)
  Response: structured JSON with parsed entities + semantic scores

POST /api/jobs (existing)
POST /api/auth/login (existing)
POST /api/auth/register (existing)

# TODO
GET  /github/:username - fetch GitHub metrics
POST /assessment/generate - PFQS question generation
POST /assessment/evaluate - evaluate candidate answers
GET  /score/:candidateId - get credibility score breakdown
POST /audit/log - auto-logged on recruiter actions
```

---

## Core Algorithms Reference

### 8DFS Heuristic Algorithm
- Targets 5-10 core logic files in a GitHub repository
- Bypasses boilerplate (package.json, config files, READMEs)
- Analyzes cyclomatic complexity, code smells
- Returns code quality metrics

### PFQS Framework (Planning First, Question Second)
1. LLM receives parsed project data
2. Generates structured "answer plan" (what topics to test, difficulty)
3. Generates questions based on the plan
4. Evaluates candidate answers against rubric
5. Stores rubric for audit/explainability

### Composite Credibility Score (0-100)
- NLP Match Score (semantic similarity)
- GitHub Verification Score (commit frequency, language match, complexity)
- Assessment Score (LLM evaluation)
- Weighted combination with configurable weights
- Flagged inconsistencies deducted

---

## Implementation Order

1. Database migration (Supabase + Firestore)
2. GitHub API integration + 8DFS
3. LLM integration + PFQS assessment
4. Composite scoring engine
5. Score explainability
6. OAuth (Google + GitHub)
7. Assessment UI
8. Audit logging
9. OCR support
10. Extended validation (LinkedIn, certificates)
