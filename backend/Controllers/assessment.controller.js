// Assessment endpoints (R-11, R-12; D§6.1, D§6.2, D§0 amendment A1).
//
//   GET  /api/assessment/status?jobId=        candidate: their state for one job; never questions
//   POST /api/assessment/start  {jobId}       candidate: start the prepared attempt (200) or 202 preparing
//   POST /api/assessment/generate             alias of start (the current frontend calls it; R-17 moves it)
//   PUT  /api/assessment/:id/answers          candidate: save answers while the attempt is open (R-12)
//   POST /api/assessment/evaluate {assessmentId, answers?}
//                                             candidate: submit; without `answers` it grades the saved
//                                             ones (this is also the retry after grading_unavailable)
//   POST /api/assessment/:id/reset {reason}   recruiter who owns the job, or admin: void the attempt (R-12)
//   GET  /api/assessment/attempts?jobId=&candidateId=
//                                             recruiter who owns the job, or admin: every attempt of one
//                                             candidate for the job, with void records (R-12)
//
// No candidate request waits on the LLM for questions: the pool is prepared in the
// background (Services/assessmentService.js prepareAssessment). Grading is the one
// call that may wait on the LLM (evaluate), bounded by EVALUATE_TIMEOUT_MS; a read
// never waits on it.
//
// Candidate states (status, and the `state` of start/save/evaluate answers), from the
// rows (phases: Services/assessmentService.js attemptPhase), in this order:
//   not_applied      no application for the job
//   grading_pending  the open row is submitted but not graded: status 'grading' (a grader
//                    holds the claim), or status 'generated' with answers.submitted_at set
//                    (the claim was released after a failure), or started and past
//                    deadline + 30 s (an expired attempt: the read closes it with its saved
//                    answers and starts grading in the background)
//   in_progress      the open row is started, not submitted, within deadline + 30 s
//   completed        no attempt left and a score of record exists
//   attempts_used    no attempt left and no score of record
//   ready            an unstarted row exists and its key row holds the pool
//   preparing        a preparation is in flight in this process, or was just started
//   unavailable      the last preparation in this process failed less than 60 s ago (with
//                    its reason code); after 60 s a read starts a new one. Status and start
//                    apply the same rule (D1).
// A voided row (evaluation.voided) is closed (status 'completed') and is neither the open
// row nor a counted attempt. An unstarted row whose pool is missing is voided by the
// system (reason `pool_missing`) on the next read, row kept (D2).
//
// Every answer about a started attempt carries `started_at`, `expires_at` (started_at +
// ASSESSMENT_TIME_LIMIT_MINUTES; saves are accepted until it, submissions until 30 s
// after it) and `server_time`, all on core's clock (serverNow).
//
// The answer key stays server-side (assessment_keys, T-0029). Candidate answers carry
// only whitelisted fields. A graded attempt inserts a new `scores` row through the
// scoring pipeline; rows are never updated in place.
import supabase from '../Config/supabase.js';
import { sendNotification } from './notification.controller.js';
import {
  GradeError, gradeOnce, gradingRetryAllowed, gradingRunState, runGrading,
} from '../Services/gradingClaim.js';
import {
  ASSESSMENT_ERRORS,
  assessmentFailure,
  attemptPhase,
  BROKEN_POOL_REASON,
  closeBrokenPool,
  deadlineOf,
  evaluateAnswers,
  hasApplication,
  isVoided,
  loadAttempts,
  loadJob,
  loadPoolQuestions,
  maxAttempts,
  preparationDecision,
  preparationState,
  serverNow,
  startedAtOf,
  submittedAtOf,
  summariseAttempts,
  timeLimitMinutes,
  timingOf,
  triggerPreparation,
  voidAttempt,
  voidRecord,
} from '../Services/assessmentService.js';
import { InternalHttpError, resolveRequestId } from '../Services/internalHttp.js';
import { scoreApplication, scoringSummary } from '../Services/scoringPipeline.js';
import { isUuid } from '../Services/validation.js';
import { logError, sendError } from '../Middlewares/errorHandler.js';

// T-0029 (I-0069): a 'grading' claim older than this may be taken over, so a
// crashed grader never leaves an attempt stuck. Far above the 120 s evaluate
// abort (EVALUATE_TIMEOUT_MS in Services/assessmentService.js).
const GRADING_STALE_AFTER = '10 minutes';

// R-12 payload caps (the global express.json limit of 100 kB applies as well).
const MAX_ANSWERS = 50;                // the service's own limit
const MAX_RESPONSE_CHARS = 10000;      // the service's CandidateAnswer.response limit
const MAX_QUESTION_ID_CHARS = 128;
const MAX_REASON_CHARS = 500;
const SAVE_TRIES = 3;

const ROW_COLUMNS = 'id, candidate_id, job_id, status, score, questions, answers, evaluation, grading_started_at, created_at, completed_at';

const requestIdOf = (req) => req.requestId || resolveRequestId(req);
const attemptsOf = (s) => ({ used: s.used, max: s.max });
const iso = (ms) => new Date(ms).toISOString();
const serverTime = () => ({ server_time: iso(serverNow()) });

const databaseError = (req, res, err, context) => sendError(req, res, {
  status: 500,
  error: 'database_error',
  message: 'Could not load your assessment. Please try again.',
  cause: err?.cause || err,
  context,
});

const dbFailure = (context, cause) => Object.assign(new Error(`${context} failed`), { code: 'database_error', cause });

/** The question as a candidate may see it: no key field can pass, whatever the stored bundle holds. */
const candidateQuestion = (q) => {
  const out = {
    question_id: q?.question_id ?? null,
    question_type: q?.question_type ?? null,
    question: q?.question ?? null,
    skill: q?.skill ?? null,
    source: q?.source ?? null,
  };
  if (q?.question_type === 'mcq') {
    out.options = (Array.isArray(q.options) ? q.options : []).map((o) => ({ label: o?.label ?? null, text: o?.text ?? null }));
  }
  return out;
};

const servedQuestions = (row) => (Array.isArray(row?.questions?.questions) ? row.questions.questions : []);

/** The stored responses: [{ question_id, response }] (strings only). */
const savedResponses = (row) => (Array.isArray(row?.answers?.responses) ? row.answers.responses : [])
  .filter((r) => r && typeof r.question_id === 'string' && typeof r.response === 'string')
  .map((r) => ({ question_id: r.question_id, response: r.response }));

/**
 * Validate a body's `answers`. Absent -> { answers: null }. An empty-string
 * response means "unanswered" (it clears a saved answer); whitespace is kept and
 * sent to the grader as written (R-08: core never zeroes it).
 */
const parseAnswers = (raw) => {
  if (raw === undefined || raw === null) return { answers: null };
  if (!Array.isArray(raw)) return { error: 'answers must be an array of { question_id, response }' };
  if (raw.length > MAX_ANSWERS) return { error: `At most ${MAX_ANSWERS} answers are accepted` };
  for (const a of raw) {
    if (!a || typeof a !== 'object' || typeof a.question_id !== 'string' || !a.question_id
      || a.question_id.length > MAX_QUESTION_ID_CHARS || typeof a.response !== 'string') {
      return { error: 'Each answer needs a question_id and a response string' };
    }
    if (a.response.length > MAX_RESPONSE_CHARS) return { error: `Each response is at most ${MAX_RESPONSE_CHARS} characters` };
  }
  return { answers: raw.map((a) => ({ question_id: a.question_id, response: a.response })) };
};

/** Ids in `answers` that are not among the attempt's served questions. */
const unknownIds = (row, answers) => {
  const ids = new Set(servedQuestions(row).map((q) => q?.question_id));
  return [...new Set(answers.filter((a) => !ids.has(a.question_id)).map((a) => a.question_id))];
};

/** Merge by question_id; '' clears an answer. Saved order first, new ids in body order. */
const mergeResponses = (saved, incoming) => {
  const m = new Map(saved.map((r) => [r.question_id, r.response]));
  for (const a of incoming) {
    if (a.response === '') m.delete(a.question_id);
    else m.set(a.question_id, a.response);
  }
  return [...m].map(([question_id, response]) => ({ question_id, response }));
};

async function loadRow(id) {
  const { data, error } = await supabase.from('assessments').select(ROW_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw dbFailure('assessment load', error);
  return data || null;
}

/** The job with its owner, or null. Throws on a lookup error. */
async function loadJobOwner(jobId) {
  const { data, error } = await supabase.from('jobs').select('id, recruiter_id, title').eq('id', jobId).maybeSingle();
  if (error) throw dbFailure('job lookup', error);
  return data || null;
}

/**
 * Fix the submission: `answers.submitted_at` is written once, beside `started_at`
 * (which is never touched), guarded on the row still being open and unsubmitted.
 * Returns true when this call fixed it; false when another request did first.
 */
async function persistSubmission(row, responses, extra = {}) {
  const answers = { ...(row.answers || {}), responses, submitted_at: iso(serverNow()), ...extra };
  const { data, error } = await supabase
    .from('assessments')
    .update({ answers })
    .eq('id', row.id)
    .eq('candidate_id', row.candidate_id)
    .eq('status', 'generated')
    .eq('answers->>started_at', startedAtOf(row))
    .is('answers->>submitted_at', null)
    .select('id');
  if (error) throw dbFailure('persist submission', error);
  return Array.isArray(data) && data.length === 1;
}

// ---------------------------------------------------------------------------
// Grading (one run per attempt: Services/gradingClaim.js runGrading)
// ---------------------------------------------------------------------------

const RESULT_FIELDS = (r) => ({
  question_id: typeof r?.question_id === 'string' ? r.question_id : null,
  question_type: r?.question_type === 'mcq' || r?.question_type === 'short_answer' ? r.question_type : null,
  skill: typeof r?.skill === 'string' ? r.skill : null,
  correct: r?.correct === true,
  points: Number.isFinite(Number(r?.points)) ? Number(r.points) : 0,
  max_points: Number.isFinite(Number(r?.max_points)) ? Number(r.max_points) : 1,
  candidate_feedback: typeof r?.candidate_feedback === 'string' ? r.candidate_feedback : null,
});

/**
 * What is stored in `assessments.evaluation`, a column the candidate can read
 * (RLS): totals and candidate-safe results only. The recruiter feedback (which
 * names the correct option or the ideal answer) goes to assessment_keys.
 */
const storedEvaluation = (evaluation) => ({
  assessment_id: evaluation.assessment_id ?? null,
  score: Number(evaluation.score),
  points_earned: Number(evaluation.points_earned),
  points_possible: Number(evaluation.points_possible),
  short_answer_graded: evaluation.short_answer_graded ?? null,
  grading_model: evaluation.grading_model ?? null,
  grading_prompt_version: evaluation.grading_prompt_version ?? null,
  ...(evaluation.no_answers === true ? { no_answers: true } : {}),
  results: (Array.isArray(evaluation.results) ? evaluation.results : []).map(RESULT_FIELDS),
});

const NOT_ANSWERED = 'Not answered.';

/**
 * Nothing was answered: the service refuses an empty answer list (R-08), and there
 * is nothing to judge, so every question scores 0 here, exactly as the service
 * scores an unanswered question (assessment-service/app/evaluator.py _unanswered).
 * No LLM call is made and none is claimed (`grading_model` null, `no_answers`).
 */
const unansweredEvaluation = (assessmentId, questions) => ({
  assessment_id: assessmentId,
  score: 0,
  points_earned: 0,
  points_possible: questions.length,
  short_answer_graded: null,
  grading_model: null,
  grading_prompt_version: null,
  no_answers: true,
  results: questions.map((q) => ({
    question_id: q?.question_id ?? null,
    question_type: q?.question_type ?? 'short_answer',
    skill: q?.skill ?? '',
    correct: false,
    points: 0,
    max_points: 1,
    candidate_feedback: NOT_ANSWERED,
    recruiter_feedback: NOT_ANSWERED,
  })),
});

// A grader or transport problem that may pass: answered as 503 grading_unavailable
// (D§6.2 outage row), with the fixed upstream code as `reason`.
const GRADER_DOWN = new Set([
  'grading_unavailable', 'llm_unavailable', 'llm_invalid_output',
  'assessment_service_unavailable', 'assessment_service_timeout', 'assessment_service_error',
]);

const graderFailure = (err) => {
  const failure = assessmentFailure(err, 'evaluate');
  const code = failure.body.error;
  if (!GRADER_DOWN.has(code)) return failure; // llm_not_configured 503, invalid_evaluate_input 422
  return { status: 503, body: { error: 'grading_unavailable', reason: code, message: ASSESSMENT_ERRORS.grading_unavailable.message } };
};

/** Question text by id from the row's served questions: the text only, never options or a key field. */
const questionTextById = (row) => new Map(servedQuestions(row)
  .filter((q) => typeof q?.question_id === 'string')
  .map((q) => [q.question_id, typeof q.question === 'string' ? q.question : null]));

/**
 * The candidate's result: total, per-skill summary, right/wrong per question with
 * safe feedback and the question's text (null when the row holds none). Built from
 * a storedEvaluation() shape and the row's served questions only, so the evaluate
 * answer and a later status read (R-17) are the same function over the same fields.
 */
const candidateResult = (row, evaluation) => {
  const texts = questionTextById(row);
  const results = evaluation.results.map((r) => ({ ...r, question: texts.get(r.question_id) ?? null }));
  const bySkill = new Map();
  for (const r of results) {
    const key = r.skill || 'unspecified';
    const agg = bySkill.get(key) || { skill: key, questions: 0, correct: 0, points_earned: 0, points_possible: 0 };
    agg.questions += 1;
    agg.correct += r.correct ? 1 : 0;
    agg.points_earned += r.points;
    agg.points_possible += r.max_points;
    bySkill.set(key, agg);
  }
  return {
    assessmentId: row.id,
    state: 'completed',
    score: evaluation.score,
    points_earned: evaluation.points_earned,
    points_possible: evaluation.points_possible,
    skills: [...bySkill.values()],
    results,
    submitted_at: submittedAtOf(row),
    late_submission: row.answers?.late_submission === true,
    ...timingOf(row),
  };
};

/**
 * Grade the STORED submission of one attempt (answers.responses), once (T-0029
 * claim). On success: the row is completed, the recruiter detail is kept beside
 * the key, and a new `scores` row is inserted through the scoring pipeline (a
 * scoring failure never undoes the grade). On a grading failure the claim is
 * released and the row stays "submitted, grading pending" with its answers.
 * Resolves to { status, body }.
 */
async function gradeSubmitted({ assessmentId, candidateId, jobId, requestId }) {
  let keyRow = null;
  let row = null;
  const outcome = await gradeOnce({
    claim: async () => {
      const { data, error } = await supabase.rpc('claim_assessment_for_grading', {
        p_assessment_id: assessmentId,
        p_candidate_id: candidateId,
        p_stale_after: GRADING_STALE_AFTER,
      });
      if (error) throw Object.assign(new Error('grading claim failed'), { cause: error });
      return Array.isArray(data) && data.length ? data[0] : null;
    },
    grade: async (claimed) => {
      const questions = claimed.questions?.questions ?? [];
      const [loaded, key] = await Promise.all([
        supabase.from('assessments').select(ROW_COLUMNS).eq('id', claimed.id).maybeSingle(),
        supabase.from('assessment_keys').select('answer_key').eq('assessment_id', claimed.id).maybeSingle(),
      ]);
      if (loaded.error || key.error || !loaded.data) {
        logError(null, '[assessment] grading lookup failed', loaded.error || key.error || 'row missing');
        throw new GradeError(500, { error: 'database_error', message: 'Failed to load the assessment' });
      }
      if (!key.data) {
        throw new GradeError(409, {
          error: 'key_unavailable',
          message: 'This assessment cannot be graded right now. Please try again shortly.',
        });
      }
      row = loaded.data;
      keyRow = key.data;
      const answerKey = keyRow.answer_key?.answers ?? [];
      if (!questions.length || !answerKey.length) {
        throw new GradeError(500, { error: 'assessment_incomplete', message: 'Stored assessment is incomplete' });
      }
      // Only answers to served questions, and never an empty string (R-08: the
      // service rejects ""; an unanswered question is omitted).
      const ids = new Set(questions.map((q) => q?.question_id));
      const responses = savedResponses(row).filter((r) => ids.has(r.question_id) && r.response !== '');
      if (!responses.length) return unansweredEvaluation(claimed.id, questions);
      try {
        return await evaluateAnswers(
          { assessment_id: claimed.id, questions, answer_key: answerKey, answers: responses },
          { requestId }
        );
      } catch (err) {
        if (!(err instanceof InternalHttpError)) throw err;
        const failure = graderFailure(err);
        console.error(`[assessment] evaluate failed: request_id=${requestId} kind=${err.kind} status=${err.status ?? '-'} code=${failure.body.reason || failure.body.error}`);
        throw new GradeError(failure.status, failure.body);
      }
    },
    complete: async (claimedAt, evaluation) => {
      const now = iso(serverNow());
      const { data, error } = await supabase
        .from('assessments')
        .update({
          // submitted_at is already there for every R-12 submission; set for older rows.
          answers: { ...(row.answers || {}), submitted_at: submittedAtOf(row) || now },
          score: Number(evaluation.score),
          evaluation: storedEvaluation(evaluation),
          status: 'completed',
          completed_at: now,
        })
        .eq('id', assessmentId)
        .eq('status', 'grading')
        .eq('grading_started_at', claimedAt)
        .select('id');
      if (error) throw Object.assign(new Error('complete failed'), { cause: error });
      return Array.isArray(data) && data.length === 1;
    },
    release: async (claimedAt) => {
      const { error } = await supabase
        .from('assessments')
        .update({ status: 'generated', grading_started_at: null })
        .eq('id', assessmentId)
        .eq('status', 'grading')
        .eq('grading_started_at', claimedAt);
      if (error) throw Object.assign(new Error('release failed'), { cause: error });
    },
  });
  if (outcome.status !== 200) return { status: outcome.status, body: outcome.body };

  const evaluation = storedEvaluation(outcome.evaluation);
  console.log(`[assessment] request_id=${requestId} completed ${assessmentId} score=${evaluation.score}${evaluation.no_answers ? ' (no answers)' : ''}`);

  // The recruiter's per-question detail names the correct option or the ideal
  // answer, so it is kept beside the key (no browser role can read that table),
  // never in `assessments.evaluation`. Best effort: the grade is already stored.
  try {
    const recruiterResults = (Array.isArray(outcome.evaluation.results) ? outcome.evaluation.results : [])
      .map((r) => ({
        question_id: typeof r?.question_id === 'string' ? r.question_id : null,
        recruiter_feedback: typeof r?.recruiter_feedback === 'string' ? r.recruiter_feedback : null,
      }));
    const { error } = await supabase
      .from('assessment_keys')
      .update({ answer_key: { ...(keyRow?.answer_key || {}), recruiter_results: recruiterResults, graded_at: iso(serverNow()) } })
      .eq('assessment_id', assessmentId);
    if (error) logError(null, '[assessment] recruiter detail not saved', error);
  } catch (err) {
    logError(null, '[assessment] recruiter detail not saved', err);
  }

  // A new score row through the one pipeline (D§3, D§6.2 "Assessment and the score").
  let result;
  try {
    result = await scoreApplication({ candidateId, jobId, requestId, assessmentOnlyFallback: true });
  } catch (err) {
    logError(null, '[assessment] scoring threw', err);
    result = { status: 'failed', reason: 'internal_error' };
  }
  const graded = { ...row, answers: { ...(row.answers || {}), submitted_at: submittedAtOf(row) || iso(serverNow()) } };
  return { status: 200, body: { ...candidateResult(graded, evaluation), scoring: scoringSummary(result) } };
}

/** Start the attempt's one grading run in the background (or join it). Never throws. */
const triggerGrading = (row, requestId) => {
  runGrading(
    row.id,
    () => gradeSubmitted({ assessmentId: row.id, candidateId: row.candidate_id, jobId: row.job_id, requestId }),
    serverNow
  ).catch(() => {});
};

/**
 * Finalise on read (candidate or the job's recruiter). Never waits on the LLM and
 * never fails the read:
 *   expired    -> the submission is fixed with the SAVED answers (auto_submitted
 *                 'expired'), grading starts in the background; reads 'submitted'
 *   submitted  -> grading is started in the background if none is in flight here
 *                 and no failure is within the 60 s gate (the retry path)
 * Returns the phase as the caller should present it.
 */
async function settleOnRead(req, row) {
  const phase = attemptPhase(row);
  if (phase === 'expired') {
    try {
      // The time written is also put on `row`, so this same read answers with it
      // (before, the first grading_pending answer showed submitted_at: null).
      const at = iso(serverNow());
      const responses = savedResponses(row);
      if (await persistSubmission(row, responses, { auto_submitted: 'expired', submitted_at: at })) {
        row.answers = { ...(row.answers || {}), responses, submitted_at: at, auto_submitted: 'expired' };
      }
    } catch (err) {
      logError(req, `[assessment] could not close expired attempt ${row.id}; next read retries`, err.cause || err);
      return 'expired';
    }
    triggerGrading(row, requestIdOf(req));
    return 'submitted';
  }
  if (phase === 'submitted' && gradingRetryAllowed(row.id, serverNow())) triggerGrading(row, requestIdOf(req));
  return phase;
}

const PENDING = new Set(['grading', 'submitted', 'expired']);

// ---------------------------------------------------------------------------
// Status and start
// ---------------------------------------------------------------------------

/**
 * The candidate's state for one job, applying the read-side rules: an expired
 * attempt is finalised, a pending one may be re-graded in the background, a broken
 * unstarted row is closed (D2), and preparation is started when allowed (D1).
 *
 * R-13 `observeOnly` (recruiter reads): the same derivation, but it never starts a
 * preparation (no LLM generation is caused by a recruiter read) and never voids a
 * broken pool. Finalising an expired started attempt still happens (R-12). With no
 * pool and nothing in flight it reads `not_prepared`; a pool-less unstarted row reads
 * `unavailable` / `pool_missing`, row untouched. `poolReady(id)` (optional) answers
 * the pool check from data the caller already batched instead of one lookup per row.
 */
export async function candidateView(req, { candidateId, jobId, s }, { observeOnly = false, poolReady = null } = {}) {
  const open = s.open;
  if (open && startedAtOf(open)) {
    const phase = await settleOnRead(req, open);
    if (PENDING.has(phase)) {
      return { state: 'grading_pending', assessmentId: open.id, submitted_at: submittedAtOf(open), ...timingOf(open) };
    }
    return { state: 'in_progress', assessmentId: open.id, ...timingOf(open) };
  }
  if (open?.status === 'grading') return { state: 'grading_pending', assessmentId: open.id, ...timingOf(open) };
  if (s.left === 0) return { state: s.scoreOfRecord ? 'completed' : 'attempts_used', ...serverTime() };
  if (open) {
    const ready = poolReady ? poolReady(open.id) : Boolean(await loadPoolQuestions(open.id));
    if (ready) return { state: 'ready', assessmentId: open.id, ...serverTime() };
    // Pool missing. While this process is still writing it (row first, then key) it reads preparing.
    if (preparationState(candidateId, jobId).inFlight) return { state: 'preparing', ...serverTime() };
    if (observeOnly) return { state: 'unavailable', reason: BROKEN_POOL_REASON, ...serverTime() };
    logError(req, `[assessment] unstarted row ${open.id} has no pool in its key row (${BROKEN_POOL_REASON})`);
    if (!(await closeBrokenPool(open, 'read:'))) return { state: 'unavailable', reason: BROKEN_POOL_REASON, ...serverTime() };
  }
  const d = preparationDecision(candidateId, jobId);
  if (observeOnly && d.start) return { state: 'not_prepared', ...serverTime() };
  if (d.start) triggerPreparation(candidateId, jobId, { requestId: requestIdOf(req) });
  if (d.state === 'unavailable') {
    return { state: 'unavailable', reason: d.reason, retry_after_seconds: Math.ceil(d.retryAfterMs / 1000), ...serverTime() };
  }
  return { state: 'preparing', ...serverTime() };
}

/**
 * R-17: the score of record's candidate result, rebuilt from the stored (candidate-safe)
 * `evaluation` by the same function as the evaluate answer; null when nothing is stored.
 * An older attempt without per-question results yields empty `results` and `skills`.
 * Voided rows are never counted, so they never show here.
 */
const completedResult = async (s) => {
  const row = s.counted[0];
  if (!row || !row.evaluation || typeof row.evaluation !== 'object') return null;
  // The attempt list does not load the served questions; read them for this one row.
  const { data, error } = await supabase.from('assessments').select('questions').eq('id', row.id).maybeSingle();
  if (error) throw dbFailure('assessment questions', error);
  return candidateResult({ ...row, questions: data?.questions ?? null }, storedEvaluation(row.evaluation));
};

/**
 * GET /api/assessment/status?jobId=
 *   200 { jobId, state, assessmentId?, started_at?, expires_at?, submitted_at?, reason?,
 *         retry_after_seconds?, server_time, attempts: { used, max }, scoreOfRecord,
 *         time_limit_minutes (R-17: ASSESSMENT_TIME_LIMIT_MINUTES, the limit the server enforces),
 *         result (state 'completed' only: the evaluate result without `scoring`, or null) }
 *   400 invalid_job_id · 404 job_not_found · 500 database_error
 * Answers at once; never returns the question set (a completed `result` carries each
 * graded question's text only); never waits on the LLM.
 */
export const getAssessmentStatus = async (req, res) => {
  try {
    const candidateId = req.session.userId;
    const jobId = req.query?.jobId;
    if (!isUuid(jobId)) {
      return res.status(400).json({ error: 'invalid_job_id', message: 'jobId must be a UUID.' });
    }
    const job = await loadJob(jobId);
    if (!job) return res.status(404).json({ error: 'job_not_found', message: 'Job not found.' });

    const applied = await hasApplication(candidateId, jobId);
    const s = summariseAttempts(applied ? await loadAttempts(candidateId, jobId) : [], maxAttempts());
    const view = applied ? await candidateView(req, { candidateId, jobId, s }) : { state: 'not_applied', ...serverTime() };
    return res.json({
      jobId,
      ...view,
      attempts: attemptsOf(s),
      scoreOfRecord: s.scoreOfRecord,
      time_limit_minutes: timeLimitMinutes(),
      ...(view.state === 'completed' ? { result: await completedResult(s) } : {}),
    });
  } catch (err) {
    return databaseError(req, res, err, '[assessment] status');
  }
};

/** 200 body for a started attempt: the same attempt, the same clock and the saved answers on every call. */
const serveStartedAttempt = async (req, res, { candidateId, assessmentId, s }) => {
  const { data: row, error } = await supabase
    .from('assessments')
    .select('id, candidate_id, status, questions, answers, evaluation, model_used, prompt_version')
    .eq('id', assessmentId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (error) return databaseError(req, res, error, '[assessment] start: load attempt');
  if (!row || attemptPhase(row) !== 'open') {
    // The row changed under us (submitted, expired, graded, voided). Nothing to hand out.
    return res.status(409).json({ error: 'attempt_changed', message: 'Your assessment changed while starting. Please check its status and try again.', ...serverTime() });
  }
  const questions = servedQuestions(row).map(candidateQuestion);
  return res.status(200).json({
    state: 'in_progress',
    assessmentId: row.id,
    ...timingOf(row),
    questions,
    question_count: questions.length,
    // R-12: a reload restores the saved answers and the remaining time.
    saved_answers: savedResponses(row),
    model_used: row.model_used ?? null,
    prompt_version: row.prompt_version ?? null,
    attempts: attemptsOf(s),
  });
};

/**
 * POST /api/assessment/start  { jobId }   (POST /api/assessment/generate is an alias)
 *   200 { state: 'in_progress', assessmentId, started_at, expires_at, server_time, questions,
 *         question_count, saved_answers, model_used, prompt_version, attempts }
 *   202 { state: 'preparing', jobId, attempts, server_time }
 *   400 invalid_job_id · 403 not_applied · 404 job_not_found
 *   409 grading_in_progress (+ state 'grading_pending') | attempts_used (+ state, attempts,
 *       scoreOfRecord) | attempt_changed | pool_missing (the broken row could not be closed)
 *   503 assessment_unavailable (+ state 'unavailable', reason, retry_after_seconds; Retry-After):
 *       the last preparation failed less than 60 s ago (D1: the same gate as status)
 * Never waits on the LLM. The start mark is written once, atomically
 * (`update ... where answers is null`), so a repeated start or a reload returns
 * the same attempt with the same `started_at`.
 */
export const startAssessment = async (req, res) => {
  try {
    const candidateId = req.session.userId;
    const jobId = req.body?.jobId;
    if (!isUuid(jobId)) {
      return res.status(400).json({ error: 'invalid_job_id', message: 'jobId must be a UUID.' });
    }
    const job = await loadJob(jobId);
    if (!job) return res.status(404).json({ error: 'job_not_found', message: 'Job not found.' });
    if (!(await hasApplication(candidateId, jobId))) {
      return res.status(403).json({ error: 'not_applied', message: 'Apply for this job before taking its assessment.' });
    }

    const s = summariseAttempts(await loadAttempts(candidateId, jobId), maxAttempts());
    const open = s.open;
    if (open && (startedAtOf(open) || open.status === 'grading')) {
      const phase = open.status === 'grading' ? 'grading' : await settleOnRead(req, open);
      if (PENDING.has(phase)) {
        return res.status(409).json({
          error: 'grading_in_progress',
          state: 'grading_pending',
          assessmentId: open.id,
          message: 'Your submission for this assessment is waiting to be graded. Check back in a moment.',
          ...timingOf(open),
        });
      }
      return serveStartedAttempt(req, res, { candidateId, assessmentId: open.id, s });
    }
    if (s.left === 0) {
      return res.status(409).json({
        error: 'attempts_used',
        state: s.scoreOfRecord ? 'completed' : 'attempts_used',
        message: s.max === 1
          ? 'You have already taken this assessment.'
          : `You have used all ${s.max} attempts for this assessment.`,
        attempts: attemptsOf(s),
        scoreOfRecord: s.scoreOfRecord,
      });
    }
    if (open) {
      const pool = await loadPoolQuestions(open.id);
      if (pool) {
        // The prepared pool becomes the attempt in ONE atomic update: the questions
        // are copied from the key row and the clock starts now, once.
        const { error } = await supabase
          .from('assessments')
          .update({ questions: pool, answers: { started_at: iso(serverNow()), responses: [] } })
          .eq('id', open.id)
          .eq('candidate_id', candidateId)
          .eq('status', 'generated')
          .is('answers', null)
          .select('id');
        if (error) return databaseError(req, res, error, '[assessment] start: mark started');
        // Zero rows updated means a concurrent start won; the stored mark is served either way.
        return serveStartedAttempt(req, res, { candidateId, assessmentId: open.id, s });
      }
      if (preparationState(candidateId, jobId).inFlight) {
        return res.status(202).json({ state: 'preparing', jobId, attempts: attemptsOf(s), ...serverTime() });
      }
      logError(req, `[assessment] start: unstarted row ${open.id} has no pool in its key row (${BROKEN_POOL_REASON})`);
      if (!(await closeBrokenPool(open, 'start:'))) {
        return res.status(409).json({
          error: BROKEN_POOL_REASON,
          state: 'unavailable',
          reason: BROKEN_POOL_REASON,
          message: 'Your assessment is not ready yet. Please try again later.',
        });
      }
    }

    // D1: the same decision as status; one click never costs more than one run per 60 s.
    const d = preparationDecision(candidateId, jobId);
    if (d.state === 'unavailable') {
      const retryAfter = Math.ceil(d.retryAfterMs / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(503).json({
        error: 'assessment_unavailable',
        state: 'unavailable',
        reason: d.reason,
        retry_after_seconds: retryAfter,
        message: 'Your assessment could not be prepared. Please try again in a minute.',
        attempts: attemptsOf(s),
        ...serverTime(),
      });
    }
    if (d.start) triggerPreparation(candidateId, jobId, { requestId: requestIdOf(req) });
    return res.status(202).json({ state: 'preparing', jobId, attempts: attemptsOf(s), ...serverTime() });
  } catch (err) {
    return databaseError(req, res, err, '[assessment] start');
  }
};

/** Kept for the frontend's current call (Assessment.jsx); same handler, same answers. */
export const generateAssessment = startAssessment;

// ---------------------------------------------------------------------------
// Save (R-12)
// ---------------------------------------------------------------------------

/**
 * PUT /api/assessment/:id/answers  { answers: [{ question_id, response }] }
 * Merges into `answers.responses` by question_id ('' clears one); `started_at` is
 * never touched. Accepted only for the owner's open attempt, before its deadline.
 *   200 { assessmentId, state: 'in_progress', saved, saved_at, started_at, expires_at, server_time }
 *   400 invalid_assessment_id | invalid_answers | unknown_question (+ question_ids)
 *   404 not_found (not the caller's attempt)
 *   409 not_started | already_submitted (+ state) | attempt_voided | save_conflict
 *       | time_expired (+ state; after deadline + 30 s the read also finalises the attempt)
 *   413 payload_too_large (over 100 kB)
 */
export const saveAnswers = async (req, res) => {
  try {
    const candidateId = req.session.userId;
    const assessmentId = req.params.id;
    if (!isUuid(assessmentId)) {
      return res.status(400).json({ error: 'invalid_assessment_id', message: 'The assessment id must be a UUID.' });
    }
    const parsed = parseAnswers(req.body?.answers);
    if (parsed.error || !parsed.answers) {
      return res.status(400).json({ error: 'invalid_answers', message: parsed.error || 'answers must be an array of { question_id, response }' });
    }

    for (let attempt = 1; attempt <= SAVE_TRIES; attempt += 1) {
      const row = await loadRow(assessmentId);
      if (!row || row.candidate_id !== candidateId) {
        return res.status(404).json({ error: 'not_found', message: 'Assessment not found' });
      }
      const now = serverNow();
      const phase = attemptPhase(row, now);
      if (phase === 'voided') return res.status(409).json({ error: 'attempt_voided', message: 'This attempt was reset.', ...timingOf(row, now) });
      if (phase === 'unstarted') return res.status(409).json({ error: 'not_started', message: 'Start the assessment before saving answers.', ...serverTime() });
      if (phase === 'completed') return res.status(409).json({ error: 'already_submitted', state: 'completed', message: 'This assessment is already submitted.', ...timingOf(row, now) });
      if (phase === 'grading' || phase === 'submitted') {
        return res.status(409).json({ error: 'already_submitted', state: 'grading_pending', message: 'This assessment is already submitted.', ...timingOf(row, now) });
      }
      if (now >= deadlineOf(row)) {
        // Past the deadline nothing more is saved. Past deadline + grace the attempt is closed now.
        const shown = phase === 'expired' ? await settleOnRead(req, row) : phase;
        return res.status(409).json({
          error: 'time_expired',
          state: PENDING.has(shown) ? 'grading_pending' : 'in_progress',
          message: 'The time for this assessment is up; this answer was not saved.',
          ...timingOf(row, now),
        });
      }
      const unknown = unknownIds(row, parsed.answers);
      if (unknown.length) {
        return res.status(400).json({ error: 'unknown_question', message: 'Some answers are not for a question of this assessment.', question_ids: unknown.slice(0, 10) });
      }

      const previousSave = typeof row.answers?.saved_at === 'string' ? row.answers.saved_at : null;
      const responses = mergeResponses(savedResponses(row), parsed.answers);
      const savedAt = iso(now);
      let q = supabase
        .from('assessments')
        .update({ answers: { ...row.answers, responses, saved_at: savedAt } })
        .eq('id', row.id)
        .eq('candidate_id', candidateId)
        .eq('status', 'generated')
        .eq('answers->>started_at', startedAtOf(row))
        .is('answers->>submitted_at', null);
      // Optimistic concurrency: a save that raced another reloads and merges again.
      q = previousSave ? q.eq('answers->>saved_at', previousSave) : q.is('answers->>saved_at', null);
      const { data, error } = await q.select('id');
      if (error) return databaseError(req, res, error, '[assessment] save answers');
      if (Array.isArray(data) && data.length === 1) {
        return res.json({ assessmentId: row.id, state: 'in_progress', saved: responses.length, saved_at: savedAt, ...timingOf(row, now) });
      }
    }
    return res.status(409).json({ error: 'save_conflict', message: 'Your answers changed while saving. Please save again.', ...serverTime() });
  } catch (err) {
    return databaseError(req, res, err, '[assessment] save answers');
  }
};

// ---------------------------------------------------------------------------
// Evaluate (submit, and retry)
// ---------------------------------------------------------------------------

/**
 * POST /api/assessment/evaluate  { assessmentId, answers?: [{ question_id, response }] }
 *
 * Fixes the submission in `answers` (submitted_at beside started_at), then grades
 * the STORED submission once (T-0029 claim) and inserts a new `scores` row.
 *   in time (until deadline + 30 s): the body's answers are merged over the saved ones
 *   late (after deadline + 30 s):    the body is ignored; the saved answers are graded
 *   already submitted, not graded:   the body is ignored; this is the retry
 *   200 candidate result (see candidateResult) + scoring: { status, reason }
 *       + answers_ignored: true when a body was given and not used
 *   400 invalid_assessment_id | invalid_answers | unknown_question · 404 not_found
 *   409 not_started | already_submitted | attempt_voided | grading_in_progress | key_unavailable | superseded
 *   503 grading_unavailable (+ reason, state 'grading_pending') | llm_not_configured
 *   422 invalid_evaluate_input · 500 database_error | assessment_incomplete
 * Every non-200 for a started attempt carries `state` (from the row after the
 * attempt) and the timing fields. A failed grade leaves no `scores` row and the
 * status not 'completed'; the answers stay saved.
 */
export const evaluateAssessment = async (req, res) => {
  try {
    const candidateId = req.session.userId;
    const requestId = requestIdOf(req);
    const { assessmentId } = req.body || {};

    if (!isUuid(assessmentId)) {
      return res.status(400).json({ error: 'invalid_assessment_id', message: 'assessmentId must be a UUID.' });
    }
    const parsed = parseAnswers(req.body?.answers);
    if (parsed.error) return res.status(400).json({ error: 'invalid_answers', message: parsed.error });

    const row = await loadRow(assessmentId);
    if (!row || row.candidate_id !== candidateId) {
      return res.status(404).json({ error: 'not_found', message: 'Assessment not found' });
    }
    const phase = attemptPhase(row);
    if (phase === 'voided') {
      return res.status(409).json({ error: 'attempt_voided', message: 'This attempt was reset and cannot be submitted.', ...timingOf(row) });
    }
    if (phase === 'completed') {
      return res.status(409).json({ error: 'already_submitted', state: 'completed', message: 'This assessment is already submitted.', score: Number(row.score), ...timingOf(row) });
    }
    // An unstarted pool is not an attempt (A1): it cannot be graded.
    if (phase === 'unstarted') {
      return res.status(409).json({ error: 'not_started', message: 'Start the assessment before submitting answers.', ...serverTime() });
    }

    let answersIgnored = false;
    if (phase === 'open') {
      if (parsed.answers) {
        const unknown = unknownIds(row, parsed.answers);
        if (unknown.length) {
          return res.status(400).json({ error: 'unknown_question', message: 'Some answers are not for a question of this assessment.', question_ids: unknown.slice(0, 10) });
        }
      }
      const responses = parsed.answers ? mergeResponses(savedResponses(row), parsed.answers) : savedResponses(row);
      await persistSubmission(row, responses);
    } else if (phase === 'expired') {
      // After deadline + grace: the late body is ignored; what was saved is graded.
      answersIgnored = Boolean(parsed.answers);
      await persistSubmission(row, savedResponses(row), { late_submission: true });
    } else {
      // 'submitted' or 'grading': the submission is already fixed; this is a retry.
      answersIgnored = Boolean(parsed.answers);
    }
    // persistSubmission returning false means a concurrent submit fixed it first;
    // the stored submission is graded either way, by exactly one run.

    if (gradingRunState(row.id, serverNow()).inFlight) {
      return res.status(409).json({
        error: 'grading_in_progress',
        state: 'grading_pending',
        assessmentId: row.id,
        message: 'Your answers are being graded. Check back in a moment.',
        ...timingOf(row),
      });
    }
    const outcome = await runGrading(
      row.id,
      () => gradeSubmitted({ assessmentId: row.id, candidateId, jobId: row.job_id, requestId }),
      serverNow
    );
    if (outcome.status === 200) {
      return res.json({ ...outcome.body, ...(answersIgnored ? { answers_ignored: true } : {}) });
    }
    let after = null;
    try { after = await loadRow(row.id); } catch { /* the state is then left out */ }
    const p = after ? attemptPhase(after) : null;
    const state = p === 'completed' ? 'completed' : p === 'voided' ? 'voided' : PENDING.has(p) ? 'grading_pending' : undefined;
    return res.status(outcome.status).json({
      ...outcome.body,
      assessmentId: row.id,
      ...(state ? { state } : {}),
      ...(answersIgnored ? { answers_ignored: true } : {}),
      ...timingOf(after || row),
    });
  } catch (err) {
    return sendError(req, res, { status: 500, error: 'internal_error', message: 'Assessment evaluation failed', cause: err?.cause || err, context: '[assessment] evaluate unhandled failure' });
  }
};

// ---------------------------------------------------------------------------
// Reset (R-12, D§6.2 "Resetting an attempt") and the recruiter read
// ---------------------------------------------------------------------------

const actorRole = (req) => (req.session?.role === 'ADMIN' ? 'admin' : 'recruiter');

/** RECRUITER must own the job; ADMIN may act on any job. */
const mayActOnJob = (req, job) => req.session?.role === 'ADMIN' || job?.recruiter_id === req.session?.userId;

/**
 * POST /api/assessment/:id/reset  { reason }   (RECRUITER owning the job, or ADMIN)
 * Voids the attempt (open, submitted or completed; also an unstarted pool) by
 * closing the row with `evaluation.voided` = { by, role, at, reason, prior_state }.
 * Then: a new pool is prepared in the background, the candidate is notified, and a
 * new `scores` row is inserted through the scoring pipeline without the voided
 * result (a scoring failure does not undo the reset; the application can be
 * re-scored with POST /api/applications/:id/score).
 *   200 { assessmentId, candidateId, jobId, state: 'voided', voided, scoring: { status, reason },
 *         notified, preparation: 'started', server_time }
 *   400 invalid_assessment_id | invalid_reason · 403 (candidate: role guard; another
 *   recruiter: forbidden) · 404 not_found · 409 already_voided | attempt_changed
 */
export const resetAssessment = async (req, res) => {
  try {
    const actorId = req.session.userId;
    const requestId = requestIdOf(req);
    const assessmentId = req.params.id;
    if (!isUuid(assessmentId)) {
      return res.status(400).json({ error: 'invalid_assessment_id', message: 'The assessment id must be a UUID.' });
    }
    const rawReason = req.body?.reason;
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (!reason || reason.length > MAX_REASON_CHARS) {
      return res.status(400).json({ error: 'invalid_reason', message: `A reason of 1 to ${MAX_REASON_CHARS} characters is required.` });
    }

    const row = await loadRow(assessmentId);
    if (!row) return res.status(404).json({ error: 'not_found', message: 'Assessment not found' });
    const job = await loadJobOwner(row.job_id);
    if (!job) return res.status(404).json({ error: 'not_found', message: 'Assessment not found' });
    if (!mayActOnJob(req, job)) {
      return res.status(403).json({ error: 'forbidden', message: 'Only the recruiter who owns this job or an admin can reset its assessments.' });
    }
    if (isVoided(row)) {
      return res.status(409).json({ error: 'already_voided', message: 'This attempt was already reset.', voided: row.evaluation.voided });
    }

    const record = voidRecord({ by: actorId, role: actorRole(req), reason, row });
    if (!(await voidAttempt(row, record))) {
      return res.status(409).json({ error: 'attempt_changed', message: 'The attempt changed while resetting. Please reload and try again.' });
    }
    console.log(`[assessment] request_id=${requestId} attempt ${row.id} voided by ${record.role} (prior_state=${record.prior_state})`);

    // A new pool, off the request path (always, whatever ASSESSMENT_PREPARE_ON_APPLY says).
    triggerPreparation(row.candidate_id, row.job_id, { requestId });

    let notified = false;
    try {
      notified = await sendNotification(
        row.candidate_id,
        'assessment_reset',
        `Your assessment for "${job.title || 'a job you applied to'}" was reset. You can take a new assessment for this job.`,
        { jobId: row.job_id, assessmentId: row.id }
      );
    } catch (err) {
      logError(req, '[assessment] reset notification failed', err);
    }

    let result;
    try {
      result = await scoreApplication({ candidateId: row.candidate_id, jobId: row.job_id, requestId, assessmentOnlyFallback: true });
    } catch (err) {
      logError(req, '[assessment] reset: scoring threw', err);
      result = { status: 'failed', reason: 'internal_error' };
    }

    return res.json({
      assessmentId: row.id,
      candidateId: row.candidate_id,
      jobId: row.job_id,
      state: 'voided',
      voided: record,
      scoring: scoringSummary(result),
      notified: notified === true,
      preparation: 'started',
      ...serverTime(),
    });
  } catch (err) {
    return databaseError(req, res, err, '[assessment] reset');
  }
};

const RECRUITER_STATE = {
  voided: 'voided', completed: 'completed', grading: 'grading_pending', submitted: 'grading_pending',
  expired: 'grading_pending', open: 'in_progress', unstarted: 'ready',
};

/** One attempt as the job's recruiter sees it here: state, clock, score, void record. No answers, no key. */
export const recruiterAttempt = (row, phase, scoreOfRecordId) => ({
  assessmentId: row.id,
  state: RECRUITER_STATE[phase] || 'unknown',
  status: row.status,
  created_at: row.created_at ?? null,
  ...timingOf(row),
  submitted_at: submittedAtOf(row),
  completed_at: row.completed_at ?? null,
  late_submission: row.answers?.late_submission === true,
  auto_submitted: row.answers?.auto_submitted ?? null,
  score: row.score == null ? null : Number(row.score),
  score_of_record: row.id === scoreOfRecordId,
  results: Array.isArray(row.evaluation?.results) ? row.evaluation.results.map(RESULT_FIELDS) : [],
  voided: isVoided(row) ? row.evaluation.voided : null,
});

/**
 * GET /api/assessment/attempts?jobId=&candidateId=   (RECRUITER owning the job, or ADMIN)
 * Every attempt row of one candidate for the job, oldest first, including voided
 * ones with their void record. An expired open attempt is finalised by this read.
 *   200 { jobId, candidateId, attempts: { used, max }, scoreOfRecord, items: [...], server_time }
 *   400 invalid_job_id | invalid_candidate_id · 403 forbidden · 404 job_not_found · 500 database_error
 */
export const getAttemptsForRecruiter = async (req, res) => {
  try {
    const { jobId, candidateId } = req.query || {};
    if (!isUuid(jobId)) return res.status(400).json({ error: 'invalid_job_id', message: 'jobId must be a UUID.' });
    if (!isUuid(candidateId)) return res.status(400).json({ error: 'invalid_candidate_id', message: 'candidateId must be a UUID.' });
    const job = await loadJobOwner(jobId);
    if (!job) return res.status(404).json({ error: 'job_not_found', message: 'Job not found.' });
    if (!mayActOnJob(req, job)) {
      return res.status(403).json({ error: 'forbidden', message: 'Only the recruiter who owns this job or an admin can read its assessments.' });
    }
    const rows = await loadAttempts(candidateId, jobId);
    const s = summariseAttempts(rows, maxAttempts());
    const items = [];
    const sorted = [...rows].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    for (const row of sorted) {
      const phase = row === s.open && startedAtOf(row) ? await settleOnRead(req, row) : attemptPhase(row);
      items.push(recruiterAttempt(row, phase, s.scoreOfRecord?.assessmentId ?? null));
    }
    return res.json({ jobId, candidateId, attempts: attemptsOf(s), scoreOfRecord: s.scoreOfRecord, items, ...serverTime() });
  } catch (err) {
    return databaseError(req, res, err, '[assessment] recruiter attempts');
  }
};
