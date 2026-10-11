# AI-Automated Skill Validation and Credibility Framework — Project Memory

Read this file at the start of every session. It contains only stable facts
about the project — not feature status. For "what should exist," read
IDEAL_CHECKLIST.md. For "what actually exists and its real condition," read
AUDIT.md. Neither of those files exists yet on a first run; if they don't
exist, say so and stop rather than guessing.

Do NOT treat project_checklist.md as accurate. It reflects what the team
*thinks* is done, not a verified state — checked boxes there are not
evidence of correct or complete implementation. Use it only as a rough
pointer to which files/areas relate to which features, never as a
correctness signal.

## What this project is
Replaces keyword-based ATS with a multi-layer pipeline: resume parsing (NLP)
→ GitHub evidence validation → LLM-generated technical assessment → unified
"Credibility Score" with explainability, shown on a recruiter dashboard.
Full spec: PROJECT_SOURCE_DOCS.md.

## Architecture (as designed)
- Frontend: React (Landing, Login, Candidate Dashboard, Upload, Recruiter
  views)
- Backend: Node.js/Express (routing, CORS, middleware, forwards files to
  FastAPI)
- NLP microservice: Python/FastAPI
- DB: Supabase (SRS originally specified MongoDB — Supabase is the actual
  implementation choice; treat Supabase as authoritative)
- External APIs: GitHub API, an LLM provider (OpenAI/Gemini)

## Known guide feedback (must eventually be reflected somewhere in the plan)
1. LinkedIn + certificate validation
2. OCR is a must
3. Fair scoring for support/maintenance-only candidates, not just development
4. GitHub must be optional
5. Score explainability is crucial

## Working agreements for this repo
- Never mark something as done, correct, or complete without actually
  reading the relevant code first. "It's checked in project_checklist.md"
  is not sufficient evidence.
- When auditing or building, use a subagent for file-reading/grepping across
  many files so the main session context only receives a summary, not raw
  file contents.
- Update AUDIT.md / CHECKLIST.md yourself as status changes — don't
  ask the user to do it manually.
- Work on one module at a time. Don't touch files outside the scoped module
  unless the task explicitly requires it.
- Prefer deleting/consolidating duplicate or AI-generated cruft over adding
  a third version of something that already exists twice.
- Small, frequent commits with clear messages. No sprawling multi-module
  diffs in one commit.
- NEVER run git commit, git push, git checkout -b, or create pull requests.
  Do not stage files. Write code only and leave the working tree dirty —
  the user handles all version control themselves. If you think a commit
  boundary makes sense, say so in your summary and stop.