# Design references for the Patina refresh

Anthony collected these on 2026-11-03. Screenshots go in this folder (`Docs/design-refs/`).

| Reference | Link | What it is | Use it for |
|---|---|---|---|
| Auxia | https://www.auxia.io/ | B2B marketing site (AI marketing agents) | Landing page |
| Spade | https://spade.com/ | B2B marketing site (data and AI for finance) | Landing page |
| Workable | Mobbin: Workable web | ATS web app | Recruiter app: navigation, job and candidate views |
| Homerun | Mobbin: Homerun web | ATS web app | Recruiter app and the candidate-facing flow |

The Mobbin pages need a login. Anthony puts screenshots of their login, signup, navigation, job list, candidate pipeline and candidate detail screens in this folder. Auxia and Spade are public sites, so they can be screenshotted directly.

## What the two marketing sites share

- A white or neutral base with one main call to action, repeated in the hero, the middle of the page and the footer.
- A header with the logo, 4–5 text links and one filled button on the right.
- A large display headline, short confident copy, and small labels above section headings.
- The product shown through UI panels (Auxia) or quantified results (Spade).

## Rules for Patina

- Auxia and Spade fit the public landing page. Workable and Homerun fit the logged-in app, which is where the login, signup and navigation problems are.
- Do not copy Spade's use of numbers with invented figures. Show the real product, an actual credibility breakdown, instead.
- None of the references has Patina's core feature, the explainable per-source credibility score. The score breakdown view is the centrepiece of the refresh.
- Frontend debt to clear first:
  - `tailwind.config.js` sets `accent.purple`, `accent.cyan` and `accent.pink` all to `#0a0a0a`, left over from a re-theme.
  - The unused `@tailwindcss/vite` v4 sits in the dependencies of a CRA app that builds with Tailwind v3.

## Anthony's notes on what he likes

- From Workable I love the containerization and separation of tasks in a single page. How everything just fits and is glanceable without eye fatigue.
- From Homerun I love the vibrancy and colors. I like the idea of pop-ups to do certain user tasks.
- Both Workable and Homerun have this great color palette that looks artistic.
- From Spade I love the clean simple animations. Color palette is lovely although its similar to workable and homerun.
- Auxia has these great fade-in transitions on almost everything and this roadmap/line connecting animation on their landing page