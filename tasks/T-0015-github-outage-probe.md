# T-0015 — github-outage-probe

> Status: **spec only, awaiting owner approval** (written in T-0010, 2026-10-14).
> ROADMAP item P1-5. Depends on T-0014. No code until the criteria are approved.

## Context
`tests/arch/nlp-outage-probe.mjs` (T-0009) measured how the system behaves when NLP
is down (P-1), hung (P-2) or busy (P-3). It only describes what it sees: it exits 0
whatever happens.

After T-0014, core has a second internal dependency, github-evidence, which has its
own upstream: GitHub. GF-4 and NFR-12 say an outage of either must degrade the score
with a reason, never fail it. The owner asked for the probe to cover the new service.

## Goal
The probe gains three phases that **assert**. Each runs a real analyze through a
running core and checks that the score is still produced, with the expected reason:
- P-4: github-evidence down;
- P-5: github-evidence hung;
- P-6: GitHub rate-limiting the service.

P-1..P-3 keep their current descriptive behaviour until P2-1 (M1).

## Spec ref
- GF-4, NFR-12; CHECKLIST 0.7, 2.8, 2.13; GR-2 (failure isolation, ARCHITECTURE §2).
- ROADMAP §1.2 (timeouts) and §1.6.

## Scope
**In:**
- `tests/arch/nlp-outage-probe.mjs`:
  - phases 4-6, selectable with `--phase`; the default is now 1-6;
  - a reusable hang-stub helper, generalised from P-2's;
  - an `expected` check per new row, printed as PASS or FAIL;
  - exit 1 if any expected row fails.
- `tests/README.md` (probe row).
- `ROADMAP.md` §1.2: timeout values confirmed or adjusted from the measurements.
- AUDIT.md 0.7, 2.8 and 2.13: evidence cites to the probe.
- ISSUES and WORKLOG.

**Out:**
- Changing P-1..P-3 (P2-1 makes them assert).
- Any production code. If a phase fails, the fix is a new task, logged in ISSUES.
- Running the probe in the default suites: it stays a manual, live run, like T-0009.

## Acceptance criteria
1. **P-4, service down.** Nothing listens on :8001, and the probe refuses to run P-4
   if something answers there. Checked by the probe output:
   - analyze f1 as `t0001_cand` → 200, within the measured NLP time plus 2 s;
   - `subScores.github_evidence.available: false` with
     `components.reason_code: "service_unavailable"`;
   - the parsing weight is 1.0;
   - `GET /api/jobs` → 200 afterwards.
2. **P-5, service hung.** A TCP stub on :8001 (127.0.0.1 and ::1) accepts the
   connection and never answers. Checked by the probe output:
   - analyze f1 → 200 within `GITHUB_EVIDENCE_TIMEOUT_MS` + NLP time + 2 s;
   - reason code `timeout`;
   - `GET /api/jobs`, sent 1 s after analyze started, → 200 before analyze returns;
   - the stub saw exactly one connection.
3. **P-6, GitHub rate-limited.** The real github-evidence service runs on :8001 with a
   dummy `GITHUB_TOKEN` and `GITHUB_API_URL` pointed at a local stub on a random port.
   That stub answers every request with 403, `x-ratelimit-remaining: 0` and a reset
   600 s ahead. Checked by the probe output:
   - analyze f1 → 200 with reason code `github_rate_limited`; the GitHub stub received
     exactly 1 request;
   - a second analyze → the same reason, and the stub received **0** more (the
     low-water mark);
   - no request left the machine: the stub's request log is the only GitHub traffic.
4. **Assertions and exit code.** Every P-4..P-6 row prints `expected`, `observed`
   and PASS/FAIL. `node tests/arch/nlp-outage-probe.mjs --phase 4 --phase 5 --phase 6`
   exits 0 when all pass and 1 when any fails. A full run (phases 1-6) keeps P-1..P-3
   descriptive.
5. **Clean teardown.** Analyze now succeeds and writes rows, so the sweep must clean
   them. Checked by:
   - `node tests/backend/sweep.mjs --check` → 0 after the run;
   - ports 5000, 8000 and 8001 are free;
   - no github-evidence or stub process is left.
6. **Measurements recorded.** The P-4..P-6 timings are written to
   `tests/.out/t0015-probe.md` and pasted into Result. ROADMAP §1.2's starting
   timeouts (4 s per call, 6 s deadline, 8 s core → service) are confirmed or changed
   there, with the reason.
7. **Trackers.** AUDIT 0.7, 2.8 and 2.13 cite the probe phases (file:line). The docs
   suite → 0.

## Test plan
- **Write first:** the three phases and their expectations.
- **Red run (a mutation, since T-0014's behaviour is already in place):** start the
  probe's backend with `GITHUB_EVIDENCE_TIMEOUT_MS=60000`. P-5 then exceeds its bound
  (analyze waits for the probe's hang limit) → that row FAILs and the probe exits 1.
  Logged to `tests/.out/t0015-red.log`. Restored → green.
- **P-6 has no separate red run.** Breaking the low-water logic would mean editing
  production code, which is out of scope. The stub's request count is asserted
  directly instead (criterion 3).
- **Green:** `tests/.out/t0015-green.log`.
- **Cannot be automated:** none beyond the manual, live nature of the probe (Supabase
  and NLP must be available).

## Regression
- `node tests/arch/nlp-outage-probe.mjs --phase 1 --phase 2 --phase 3` gives the same
  rows as ARCHITECTURE.md Appendix A, within timing noise.
- `tests/run-suite.ps1 -Target current -Suites docs` → 0.

## Risks and rollback
- **Risk:** the probe now writes data (resumes, scores, storage), where T-0009's never
  did. Mitigation: the existing `[T-0001 TEST]` sweep covers these tables and the
  bucket paths; criterion 5 checks it.
- **Risk:** port 8001 is busy on a developer machine. Mitigation: the probe refuses
  to start, as it does for 5000 and 8000.
- **Rollback:** revert the probe and README hunks.

---

## Result
<Filled at the end. One line per acceptance criterion.>
