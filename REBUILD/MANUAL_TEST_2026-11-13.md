# Manual test, Nov 13: Anthony's findings

Anthony clicked through the whole candidate and recruiter flow by hand on `rebuild/fable` after batch 4. This file lists what he found, how it's prioritised, and the direction for each item.

**Before you start:**
- Dedupe every item against `ISSUES.md` and `TASKS.md`. Where an item is already tracked, update that entry instead of creating a new one.
- Then re-plan the remaining batches and tell Anthony what drops off as a result.
- Phase 4 (roadmap and handoff) still starts Nov 16.

## 0. Data repair first

Anthony deleted rows from the `profiles` table only, not from Authentication → Users. That means some auth users, possibly including the test accounts that the e2e suite, the verifiers and the sweep use, now have no profile row.

1. Report, as counts only and without deleting anything:
   - auth users with no profile row (name which ones are test accounts from `tests/.env`)
   - whether removing the profiles cascaded into, or orphaned, rows in jobs, applications, scores, resumes, assessments or storage
2. Give Anthony a repair script to run himself that restores the test accounts' profile rows, or recreates those accounts already confirmed. Then re-run the e2e spine check.
3. Supabase's default email sender only delivers to addresses on the Supabase organization's team, and only 2 emails an hour. Add a prerequisite card for Anthony to set up custom SMTP before the demo.

## Priorities

- **MUST**: before Nov 18. These undermine Patina's core claim, or evaluators will see them.
- **SHOULD**: before Nov 18 only if every MUST is verified first.
- **AFTER**: goes into `ROADMAP.md`.

### MUST 1. The resume has too much power (scoring weights)

Patina's claim is that it replaces keyword-matching ATS with evidence. Right now a resume that just lists words like "oauth" or "postman" picks up skills and score from the resume alone. That is keyword matching.

- **Principle:** the resume decides *what to verify*. Independent sources, GitHub and the assessment, decide *how credible* the candidate is.
- Propose new weights in `DECISIONS.md`, with reasons, for Anthony to approve. Resume-only claims should count for little.
- Keep the existing redistribution logic for when a source is unavailable. When GitHub is missing, the assessment carries more of the weight; the resume must not.
- **Acceptance check:** a test with a keyword-stuffed resume, no GitHub and no assessment. It must score in the lowest band and be labelled unverified.
- Also check that a strong GitHub plus a strong assessment beats a long skill list.

### MUST 2. The skill evidence table is ambiguous

The table shows "Evidenced, 1 of 3 sources". Anthony couldn't tell what that means, and the rows suggest the one source may just be the resume.

- First, check whether a skill confirmed only by the resume is being labelled "Evidenced". If it is, that's a bug.
- Replace "N of 3 sources" with a mark for each source: Resume / GitHub / Assessment, each one confirmed, absent, or unavailable.
- Use exactly three statuses:
  - **Claimed only:** the resume lists it and nothing else confirms it.
  - **Evidenced:** at least one independent source confirms it.
  - **Not found:** the job asks for it and no source has it.
- Normalise skill names so they match: the job's "rest api" should match the resume's "rest" plus "api", "node.js" should match "nodejs", and so on. Reuse the R-21 vocabulary.

### MUST 3. MCQs fall to the "longest option is correct" pattern

In Anthony's assessment, the correct answer was noticeably the longest option.

- **Generation:** the prompt must require all four options to be similar in length and form, and plausible.
- **Validation:** after generation, reject and regenerate any question whose correct option is clearly the longest (for example, more than about 25% longer than the average of the distractors).
- Check that the correct option's position is randomised.
- **Acceptance check:** run the validator over a generated batch. Report the share of questions where the correct option is the longest; it should be about 25%. Also report the position spread.

### MUST 4. Parsing errors on a real resume

Anthony uploaded his real `.docx`.

- **Name:** it came out as "ANTHONY JENNIS NADAR +91". Phone and country-code tokens must never be part of the name.
- **Links:** a LinkedIn URL written out in full was missed. Only `github.com/...` was found. Extract all profile URLs, including LinkedIn, portfolio sites and others.
- **Embedded links:** hyperlinks attached to words instead of written out are not read at all. Extract their targets from DOCX relationships and from PDF link annotations.
- **Education:** came out as three separate entries (institution, degree, honours). It should be one entry with institution, degree, graduation year and CGPA, with the honours attached to it.
- **Fixtures:** do **not** commit Anthony's real resume to the repo; it contains his phone number and email. Build a synthetic `.docx` and PDF with the same structure: a phone number next to the name, a full LinkedIn URL, an embedded link, and an education block split over several lines.

### MUST 5. The recruiter signup has an orphaned "verification" section

Signup shows "Verification Details (Optional)" with Company Name and LinkedIn/Company Website fields. There is both a "Create Account" button and a "Skip Verification & Continue" button. The LinkedIn field also uses a mail icon.

- Remove that section and the skip button. Keep a single "Create Account".
- Company verification goes to AFTER, in Track A, as part of certificate and company validation.
- Fix the duplicated copy on the post-signup page: the heading "Account created" is repeated in the body.

### MUST 6. The job form's required skills are a fixed list of about 20 chips

The job's skills drive the evidence table and the score, so this is about correctness, not just appearance. Anthony's test job description named SAS, R and statistics, but none of those could be selected.

- Replace the chips with a searchable skill input backed by the R-21 vocabulary. Recruiters can also add their own skills, which are then normalised.
- Extract skills from the description text and offer them as suggestions ("Found in your description: SAS, R, statistics"). The recruiter confirms them; nothing is added silently.

### SHOULD 1. Job location is a free-text field

Anthony typed "Onsite" into Location, which shows the field mixes up place and work mode. Split it into a work-mode select (On-site / Hybrid / Remote) and a city field.

### SHOULD 2. A job description can only be pasted as text

Add an upload (PDF or DOCX) that extracts the text using the existing nlp-engine extraction and pre-fills the description box for the recruiter to edit. If it doesn't fit, it goes to AFTER.

### SHOULD 3. Visual design

The current black-and-white look is what's left of an earlier re-theme: `tailwind.config.js` sets `accent.purple`, `accent.cyan` and `accent.pink` all to `#0a0a0a`. Anthony's references are in the claude.ai project doc `claude/redesign-references.md`:

- Auxia and Spade for the landing page
- Workable and Homerun for the logged-in app

**Before Nov 18,** only if every MUST is verified, do a **token-level** refresh:
- palette, type scale, spacing, and the accent colours
- the auth screens
- ScoreBreakdown as the centrepiece, which is the one view no reference has

The e2e spine check must pass after every change, and layouts are not restructured. Never use invented figures, such as fake stats on the landing page.

**The full redesign is AFTER,** together with the Vite migration. Mock it up visually first: Anthony will use the "Design in codebase" tool and send screenshots of Workable and Homerun.

### AFTER

- Assessment questions grounded in the candidate's own claims and projects, scenario-based instead of generic trivia. Generic MCQs can be looked up.
- Company and recruiter verification.
- The full redesign, plus the Vite migration.

## What Anthony needs back

1. Results of the data repair, plus the script he runs himself.
2. Where each item landed: MUST cards with ids, which batch, and what drops off the plan to make room.
3. The proposed new weights, with reasons, before they're applied. Like Y1–Y8, this needs his approval.
