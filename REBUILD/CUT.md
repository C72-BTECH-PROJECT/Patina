# The Nov 18 cut

Status: **APPROVED by Anthony at Checkpoint 2, 2026-11-12.** Stretch order is now S-3 (GitHub OAuth), S-1 (OCR), S-2 (flags), S-4 (certificates), S-5 (PFQS); the ids below are unchanged.

## Plainly

**The promised scope does not fit by Nov 18.** Today 6 of 110 promise rows are verified, and none of those is a product feature `[inventory/scope_vs_reality.md §1]`. The named machine-learning promises (custom NER trained on 5,029 CVs, CodeQL/SonarQube, 8DFS, APPS calibration) and most measured targets will not exist on Nov 18.

What can exist is a pipeline that works end to end by clicking through the app, with every gap shown as a gap. If list A lands, my estimate is that roughly 40 of the 110 rows become verified. That figure is a forecast, not a measurement; `AUDIT.md` will carry the real count after verification.

Ids are CHECKLIST ids, `PS-nnn` promise ids, `GF-n` guide feedback and `GR-n` guide review items.

## List A: complete and verified by Nov 17

The definition of done for list A is the scripted end-to-end check (card R-19) passing through the UI with no direct API calls.

**A1. The spine**

| Step | What works through the UI | Ids it moves |
|---|---|---|
| 1 | Candidate signs up and logs in | 0.4 (roles part) |
| 2 | Candidate uploads a resume; parsing runs; the candidate sees what was read | 1.1, 5.1, 5.4, PS-010 (display) |
| 3 | Candidate applies; scoring runs automatically | 5.14, 1.14, 2.3, 2.12, 2.13, 4.2, 4.3, 4.4, PS-002 |
| 4 | Candidate sees their result | 5.4 |
| 5 | Recruiter sees one application-centric view: score, status, shortlist/reject, drill-down to evidence | 5.5, 5.7, 5.8, 5.10, 5.11, 5.15, 4.5, GF-5 |
| 6 | Candidate takes the LLM assessment with basic anti-cheating; the result joins the score | 3.1, 3.2, 3.7, 3.12, 3.13, 5.3, 4.1, 2.8, 4.7, PS-060, GF-4, GR-1 |

**A2. Honesty and correctness**

- All 48 fabricated or misleading outputs removed or made true.
- No silent fallbacks: grading outage is pending, not 0; missing similarity is unavailable, not 0; notification errors are errors.
- Image-only PDF gives an explicit "can't read this file" error (1.15).
- No stack traces or raw database errors reach the browser.
- An inactive linked GitHub account never scores lower than linking none (2.7, 4.7).
- Skill false positives removed and support/operations vocabulary added (1.17, part of GF-3).
- A written anti-cheating design (`DECISIONS.md` §6.2) and its list-A controls (GR-1).

**A3. Demo robustness and architecture**

- One command starts and stops all six processes.
- Core reachable only through the gateway; the as-built architecture written down with an honest verdict (GR-2).
- Login limit cannot lock out one laptop; the session check cannot 503 the whole app.
- Test harness on the current ports; `CI=true npm run build` passes; docs checker exits 0.

**A4. One real measurement**

- Parsing precision, recall and F1 on 30 labelled resumes, plus parse time, before and after the vocabulary fix (touches 1.11, 1.12, 1.13, 6.1 to 6.3, 6.8). List A promises the measurement, not that the SRS targets are met.

**A5. Presentation material**

- The MongoDB-to-Supabase justification (PS-058), the architecture statement, and this cut as the honest status slide.

**If the plan slips**, cards are dropped from the end of this order: A1 → A2 → A3 → A4. Anything dropped moves to list B with its true state. A1 and the removal of fabricated UI content are not dropped.

## List B: demonstrated honestly as partial

Each line is what we show and what we say about it.

| Promise | What exists on Nov 18 | What we say is missing |
|---|---|---|
| Microservices (0.1, PS-054 to PS-057, PS-061) | Gateway, orchestrating core, three stateless services | Core is a monolith that owns all data; no independent scaling |
| Custom NER, hybrid layers (1.4 to 1.7, PS-016) | Keyword and alias extraction, spaCy, MiniLM similarity, with a measured F1 | Not a trained NER model; layers are not chained |
| Layout-aware extraction (1.3, 1.8) | Single-column PDF and DOCX | Two-column layouts and tables degrade |
| Project and link extraction (PS-010, 1.9) | Skills, experience, education, GitHub and LinkedIn links | Project extraction is unreliable |
| OCR (1.2, GF-2) | Explicit unreadable error | OCR itself, unless stretch S-1 lands |
| LinkedIn and certificates (1.16, GF-1) | LinkedIn URL captured | No certificate extraction (unless S-4) and no validation |
| GitHub OAuth and ownership (2.2, 5.2) | Link taken from the resume, labelled "ownership not verified" | Verified ownership, unless S-3 lands |
| Contribution verification (2.5), metrics (2.4) | Repo, commit, language and consistency metrics; claimed language present in owned repos | Authorship-level checks; code-quality indicators |
| Support-role fairness (GF-3: 1.17, 2.9, 4.8, 4.12) | Vocabulary fix and the inactive-account fix | Maintenance signals, weighting, measurement |
| PFQS and difficulty control (3.3, 3.4) | Single-prompt generation | The two-step plan, unless S-5 lands |
| Rubric grading (3.5, 3.6) | Deterministic MCQ grading; short answers graded against generated key points with schema-bound output | Predefined, calibrated rubrics |
| Inconsistency flags (4.6, 5.9) | An honest "not computed" panel | The flags, unless S-2 lands |
| Weights (4.3) | Documented, stored with every score | Any calibration; labelled provisional |
| Anti-cheating (GR-1) | The list-A controls | Proctoring, identity, AI-answer detection |
| OAuth 2.0 login (0.4), HTTPS (0.6) | Password login with server sessions, on localhost | OAuth login, TLS |
| Repository entity (0.2, 2.11) | Snapshot inside the score record | Its own table |
| Filters and comparison (5.5, 5.6) | Ranked list with working status filter | Side-by-side compare view |
| Datasets (6.8) | Live GitHub API; a 30-resume sample of the named Kaggle set for evaluation | Training on any named dataset |

## List C: after Nov 18

Not built, not shown, named as future work in the roadmap.

- **Research and ML:** custom NER on the 5,029-CV set (1.5); DocLing (1.3); 8DFS (2.6); CodeQL/SonarQube (PS-028); APPS-calibrated rubrics (3.8); originality signals (X-2); practical coding challenges (PS-007).
- **Measured targets:** GitHub and grading correlations with human judgement (6.4, 6.5, 3.9); 100 concurrent users (6.6, 0.8); 95 % uptime (6.7); fairness measurement (4.12); per-module evaluation (PS-071); screening-time and fraud studies (PS-003, PS-004).
- **Features:** LinkedIn and certificate validation in the score (4.10, 5.13); maintenance-work signals (2.9) and support weighting (4.8); recruiter audit log (X-1); queue or async processing (0.8); score reproducibility guarantees (4.11).
- **Platform (roadmap Track B):** HTTPS, MFA, OAuth login, IP hashing, security testing, monitoring, external session store, splitting core, service-to-service authentication, recruiter verification, privacy and retention policy for resume data, hosting.
- **Frontend:** Vite migration and the visual redesign, done together.
