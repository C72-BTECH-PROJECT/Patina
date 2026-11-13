// T-0029 (I-0069): grade one assessment attempt exactly once.
//
// The steps are injected (tests/backend/grading-claim.test.mjs drives them with
// fakes); assessment.controller.js wires them to Supabase and the assessment
// service:
//   claim()                      -> claimed row { id, job_id, questions, grading_started_at } or null
//   grade(claimed)               -> evaluation; throws GradeError (or anything) on failure
//   complete(claimedAt, evaluation) -> true if this claim completed the row, false if superseded
//   release(claimedAt)           -> put the attempt back to 'generated' (only this claim's)
//
// Returns { status, body } for errors, or { status: 200, evaluation, claimed }.
//
// R-12 adds the in-process grading-run registry below (runGrading): one run per
// attempt, a 60 s gate for read-triggered retries, and eviction of finished entries.

export class GradeError extends Error {
  constructor(status, body) {
    super(body?.message || `grading failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function safeRelease(release, claimedAt) {
  try {
    await release(claimedAt);
  } catch (err) {
    // The stale-claim reclaim (10 minutes) is the backstop; never mask the original error.
    console.error('[assessment] releasing the grading claim failed:', err?.message || err);
  }
}

export async function gradeOnce({ claim, grade, complete, release }) {
  const claimed = await claim();
  if (!claimed) {
    return {
      status: 409,
      body: { error: 'already_submitted', message: 'This assessment is already submitted or is being graded.' },
    };
  }
  const claimedAt = claimed.grading_started_at;

  let evaluation;
  try {
    evaluation = await grade(claimed);
  } catch (err) {
    await safeRelease(release, claimedAt);
    if (err instanceof GradeError) return { status: err.status, body: err.body };
    return {
      status: 502,
      body: { message: 'Assessment evaluation failed, so your answers were not graded. Please try again.' },
    };
  }

  let completed;
  try {
    completed = await complete(claimedAt, evaluation);
  } catch {
    await safeRelease(release, claimedAt);
    return { status: 500, body: { message: 'Graded but could not save the result. Please retry.' } };
  }
  if (!completed) {
    // A newer claim took this attempt over (this grader was past the stale
    // limit). Its result is not saved, returned or folded into the score.
    return {
      status: 409,
      body: { error: 'superseded', message: 'This assessment was graded by a newer submission.' },
    };
  }
  return { status: 200, evaluation, claimed };
}

// ---------------------------------------------------------------------------
// R-12: one grading run per attempt in this process (D§6.2 time and outage rows)
// ---------------------------------------------------------------------------
//
// A submitted attempt is graded by the candidate's submit (evaluate), by a retry
// (evaluate without a body), or in the background after a read finalised an
// expired attempt or found one "submitted, grading pending". All of them go
// through runGrading, so at most one run per attempt is in flight here and a
// second caller joins it (the database claim still guards across processes).
// A failed run is remembered as { reason, at } so reads re-trigger it at most
// once per GRADING_RETRY_GATE_MS. Nothing about a failure is stored in the
// database. Entries are evicted as soon as they are no longer needed (no
// failure, or a failure older than the gate). Pure: the clock is passed in.

export const GRADING_RETRY_GATE_MS = 60_000;

// assessmentId -> { inFlight: Promise | null, lastFailure: { reason, at } | null }
const runs = new Map();

function sweepRuns(nowMs) {
  for (const [id, e] of runs) {
    if (!e.inFlight && (!e.lastFailure || nowMs - e.lastFailure.at > GRADING_RETRY_GATE_MS)) runs.delete(id);
  }
}

/** { inFlight, lastFailure } for one attempt. */
export function gradingRunState(assessmentId, nowMs) {
  sweepRuns(nowMs);
  const e = runs.get(assessmentId);
  return { inFlight: Boolean(e?.inFlight), lastFailure: e?.lastFailure ? { ...e.lastFailure } : null };
}

/** May a read start a background run now? (none in flight, no failure within the gate) */
export function gradingRetryAllowed(assessmentId, nowMs) {
  const s = gradingRunState(assessmentId, nowMs);
  return !s.inFlight && !s.lastFailure;
}

/**
 * Run `fn` (resolving to { status, body, ... }) as the one grading run of this
 * attempt, or join the run already in flight. A non-200 outcome or a throw is
 * remembered as the last failure. `now` is a () => ms clock. Never rejects:
 * a throw resolves to a 500 outcome.
 */
export function runGrading(assessmentId, fn, now) {
  sweepRuns(now());
  let entry = runs.get(assessmentId);
  if (!entry) {
    entry = { inFlight: null, lastFailure: null };
    runs.set(assessmentId, entry);
  }
  if (entry.inFlight) return entry.inFlight;
  const run = (async () => {
    let out;
    try {
      out = await fn();
    } catch (err) {
      console.error('[assessment] grading run failed unexpectedly:', err?.message || err);
      out = { status: 500, body: { error: 'internal_error', message: 'Assessment evaluation failed. Please try again.' } };
    }
    entry.inFlight = null;
    entry.lastFailure = out?.status === 200 ? null : { reason: out?.body?.reason || out?.body?.error || 'internal_error', at: now() };
    if (!entry.lastFailure && runs.get(assessmentId) === entry) runs.delete(assessmentId);
    return out;
  })();
  entry.inFlight = run;
  return run;
}

/** Tests: forget every grading run. */
export function resetGradingRuns() {
  runs.clear();
}

/** Tests (D3): how many attempts the registry holds after sweeping. */
export function gradingRunsSize(nowMs) {
  sweepRuns(nowMs);
  return runs.size;
}
