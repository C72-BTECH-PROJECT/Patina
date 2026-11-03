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
