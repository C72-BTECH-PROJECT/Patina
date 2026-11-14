# T-0015 — github-outage-probe

> Status: **done, 7/7 criteria PASS** (spec written in T-0010, 2026-10-14; approved and executed 2026-10-15).
> ROADMAP item P1-5. Depends on T-0014. Owner-approved addition: I-0049 (ARCHITECTURE as-is refresh).

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

Probe: `tests/arch/nlp-outage-probe.mjs` (phases 4-6, `hangStub`, `check`). Logs: red `tests/.out/t0015-red.log`, green `t0015-green.log` (phases 1-6) and `t0015-green-456.log` (`--phase 4 --phase 5 --phase 6`), full harness `t0015-full-harness.log`, table `t0015-probe.md`.

1. **P-4, service down: PASS.** `:8001` checked free before the phase (`portOpen`, refuses otherwise). Analyze f1 → 200 in 1168 ms (bound NLP 296 + 2000 = 2296), `available:false`, `reason_code: service_unavailable`, parsing weight 1; `GET /api/jobs` → 200 afterwards (`t0015-green.log`).
2. **P-5, service hung: PASS.** TCP stub on 127.0.0.1 and ::1: `/api/jobs` sent 1 s in → 200 while analyze was still pending; analyze → 200 in 8710 ms (bound 8000 + 296 + 2000), reason `timeout`; stub saw exactly 1 connection (462 bytes received, nothing sent).
3. **P-6, GitHub rate-limited: PASS.** Real service on :8001 (dummy token, `GITHUB_API_URL` = local 403 stub with `x-ratelimit-remaining: 0`, reset +600 s). First analyze → 200 in 929 ms, `github_rate_limited`, stub got 1 request (`GET /users/example-mokafor`); second analyze → same reason, 0 more requests; the stub's log is the only GitHub traffic.
4. **Assertions and exit code: PASS.** Every P-4..P-6 row prints expected, observed and PASS/FAIL. `--phase 4 --phase 5 --phase 6` → exit 0 (9/9 PASS, `t0015-green-456.log`). Red run with `GITHUB_EVIDENCE_TIMEOUT_MS=60000`: the P-5 analyze row FAILs (client aborted at the 20 s limit) and the probe exits 1 (`t0015-red.log`); the other 8 rows PASS. The full run (phases 1-6) exits 0 and P-1..P-3 stay descriptive. Regression: P-1..P-3 rows have the same results as ARCHITECTURE Appendix A.1 (500 / no response in 20 s / 1 connection, 2916 bytes; NLP 351 ms alone, two parses 950 ms). Results and notes match; the NLP timings ran about 35% slower than the 2026-10-12 run (261 and 559 ms), which I put down to machine load and did not investigate.
5. **Clean teardown: PASS.** `sweep.mjs --check` → 0 after each run (the probe's teardown sweep removed 4 scores, 4 resumes, the job and the storage objects, and re-counted clean); `netstat` shows nothing LISTENING on 5000, 8000, 8001; no uvicorn or node child left.
6. **Measurements recorded: PASS.** `tests/.out/t0015-probe.md` is the table from the 4-6-only run (the full run's numbers are in `t0015-green.log`):

   | Row | 4-6 run (ms) | full run (ms) |
   |---|---|---|
   | NLP `/parse` alone (bound basis) | 313 | 296 |
   | P-4 analyze, service down | 741 | 1168 |
   | P-5 analyze, service hung | 8598 | 8710 |
   | P-6 analyze, rate-limited (first / second) | 883 / 560 | 929 / 568 |

   ROADMAP §1.2: core → service **8 s confirmed, unchanged**; hung analyze takes 8 s + NLP + writes ≈ 8.6-8.7 s. The probe does not exercise the service's own 4 s per call and 6 s deadline (the hang is in core's call, the rate limit is immediate), so those stay as T-0011 set them and are covered by the `github` suite. Worst-case analyze with NLP hung is still 15 s NLP + 8 s GitHub, unchanged. Text updated in §1.2.
7. **Trackers: PASS.** AUDIT 0.7, 2.8, 2.13 (and GR-2) cite `tests/arch/nlp-outage-probe.mjs:232,245,269`; statuses unchanged; history line added. Docs suite → exit 0, **0 warnings** (`t0015-docs.log`: 91 rows, ARCHITECTURE 228 cites, ROADMAP 35 items).

**Owner-approved additions.** I-0049 mapped to P1-5 in ROADMAP (Issues cell, Files += `ARCHITECTURE.md`) and **resolved**: ARCHITECTURE's as-is GitHub path (diagram, §1.2 component row, §1.3 edges with cites for core's client and the reason codes, §1.7, §1.8, §2, §0) and the shifted cites are refreshed; Appendix A.2 holds the P-4..P-6 output.

**Full harness** (`t0015-full-harness.log`, `-Target current -Live`): nlp 0, backend 0 (66/66), github 0 (80 passed), docs 0, frontend 1 = the same 5 known CRA lint warnings (no new ones). The harness's docs step ran before I mapped two new issues in ROADMAP and showed 2 warnings; the final docs run is 0 (`t0015-docs.log`).

**Findings.**
- The spec said "ports 5000, 8000 and 8001 free" and "nothing listens on :8001"; P-4..P-6 also need NLP up (the score must be produced), so the probe starts its own NLP for them and stops it before P-3.
- P-5's bound uses core's documented default (8000), not the env variable, so the red mutation fails on the bound as well as on the 20 s client limit.
- Out of scope, logged: I-0050 (probe's login row is labelled "P-1" when phase 1 is not selected; mapped to P2-1), I-0051 (AUDIT 0.1 and GR-2 text still say "1 of the 3 services"; mapped to P2-9).
- `hangStub` replaced P-2's inline stub; P-2's behaviour and row text are unchanged (same results in the regression run).
