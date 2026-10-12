# Test harness (T-0001)

Black-box tests that run unchanged against two trees:

| Target | Tree | NLP | Backend | Frontend (manual) |
|---|---|---|---|---|
| `baseline` | `../patina-baseline` (git worktree, detached at `32905c1`) | 8100 | 5100 | 3100 |
| `current` | this repo | 8000 | 5000 | 3000 |

Current must use 8000/5000: HEAD hardcodes both (ISSUES I-0009, I-0012).
The baseline ports come from the worktree's **copied** `backend/.env`
(`PORT`, `NLP_PARSE_URL`, `FRONTEND_URL` appended), because
`backend/Config/supabase.js` loads `.env` with `override:true` — shell env
vars cannot override it.

## One-time setup

```powershell
# baseline worktree (from the repo root)
git worktree add ../patina-baseline 32905c1
# then copy backend/.env and frontend/.env into it, append to the copy:
#   PORT=5100 / NLP_PARSE_URL=http://localhost:8100/parse / FRONTEND_URL=http://localhost:3100
# and set REACT_APP_API_BASE_URL=http://localhost:5100 in its frontend/.env.
# node_modules: junction both from this repo (lockfile deltas are additive only)
New-Item -ItemType Junction -Path ..\patina-baseline\backend\node_modules  -Target backend\node_modules
New-Item -ItemType Junction -Path ..\patina-baseline\frontend\node_modules -Target frontend\node_modules

# test deps into the NLP venv
nlp-engine\venv\Scripts\python -m pip install -r tests\requirements.txt

# (re)generate fixtures — byte-stable, so no diff unless content changed
nlp-engine\venv\Scripts\python tests\fixtures\make_fixtures.py
```

## Running

```powershell
powershell -File tests\run-suite.ps1 -Target baseline                 # nlp + backend tier 1 + frontend build
powershell -File tests\run-suite.ps1 -Target baseline -Suites nlp
powershell -File tests\run-suite.ps1 -Target baseline -Suites backend -Live   # + tier 2 (writes to Supabase)
```

The script starts NLP (`PYTHONHASHSEED=0`, HF offline) and the backend from
the chosen tree, waits for health, runs the suites, kills the processes, and
logs to `tests/.out/` (git-ignored).

## Suites and data safety

| Suite | Files | Supabase |
|---|---|---|
| NLP | `nlp/test_parse.py` | None — the NLP service has no Supabase client. |
| Backend tier 1 | `backend/smoke.test.mjs` | No writes; one `profiles` read (unknown-username login). |
| Backend tier 2 | `backend/live-analyze.test.mjs` | **Live.** Dedicated `t0001_cand` / `t0001_recr` accounts (`tests/.env`), a job tagged `[T-0001 TEST]`, sweep before and after. |
| Frontend | `CI=true npm run build` | None. |
| Manual | `MANUAL_SMOKE.md` | Live, via the UI — finish with `node tests/backend/sweep.mjs`. |

The sweep (`backend/lib/testdb.mjs`) deletes only: `scores`, `resumes`,
`applications` where `candidate_id = <t0001_cand id>`; storage objects under
`resumes/<C>/` and `resumes/candidates/<C>/`; `jobs` where
`recruiter_id = <t0001_recr id> AND title LIKE '[T-0001 TEST]%'`. It aborts
if a username lacks the `t0001_` prefix, a role is wrong, or any single delete
would exceed 50 rows/objects. `node tests/backend/sweep.mjs --check` is
read-only.

Cross-user tests (T-0004..T-0007) add `t0001_recr2` (and later `t0001_cand2`),
set in `tests/.env` (see `.env.example`). When configured, the sweep and its
guards cover them too: candidate ids for `scores/resumes/applications`/storage,
recruiter ids for `[T-0001 TEST]` jobs, and all test ids for `notifications`.
Every run snapshots the t0001_ `profiles` rows to
`tests/.out/t0001-profile-snapshots.json`. `sweep.mjs --check` exits 1 with
`profile-missing:<username>: 1` if a t0001_ profile row is gone, and
`sweep.mjs --restore-profiles` upserts the rows back from the snapshot
(idempotent).

Known schema gaps this depends on (not fixed here): `resumes` bucket (I-0001),
`scores` table (I-0007), `resumes` table (I-0013) exist only in the live
project, not in migrations.

## Snapshots

`nlp/snapshots/<label>/<fixture>.json` is the full `/parse` response
(sorted keys). They are a **reference to diff revisions against, not an
oracle** — see `BASELINE_RESULTS.md` for which baseline outputs are known
wrong. Real resumes in `tests/private/` are tested too; their snapshots go to
`tests/private/snapshots/` (git-ignored, contain personal data).
