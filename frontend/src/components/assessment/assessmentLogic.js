// R-17: pure logic for the candidate assessment page (pages/candidate/Assessment.jsx).
// No React and no network here, so it can be unit-tested (assessmentLogic.test.js).
//
// The page is driven by GET /api/assessment/status?jobId= (R-11, R-12). Its `state`
// names are the backend's (backend/Controllers/assessment.controller.js, top comment).

/** Candidate states the backend can answer, mapped to the screen the page shows. */
export const SCREEN_FOR_STATE = Object.freeze({
  not_applied: 'not_applied',
  preparing: 'preparing',
  unavailable: 'unavailable',
  ready: 'start',
  in_progress: 'questions',
  grading_pending: 'grading_pending',
  completed: 'result',
  attempts_used: 'attempts_used',
});

/** The screen for a backend state; anything unrecognised is shown as such, never guessed. */
export const screenFor = (state) => (
  Object.prototype.hasOwnProperty.call(SCREEN_FOR_STATE, state) ? SCREEN_FOR_STATE[state] : 'unknown'
);

export const isKnownState = (state) => screenFor(state) !== 'unknown';

/** Only `ready` may offer the Start button. */
export const canStart = (state) => state === 'ready';

export const PREPARING_POLL_MS = 3000;
export const GRADING_POLL_MS = 10000;
export const UNAVAILABLE_POLL_DEFAULT_MS = 30000;
const UNAVAILABLE_POLL_MIN_MS = 5000;
const UNAVAILABLE_POLL_MAX_MS = 60000;

/**
 * How long until the page reads status again in this state, or null for no polling.
 * `unavailable`: the server starts a new preparation on a status read once its 60 s
 * gate allows, so the page reads again after `retry_after_seconds` (bounded); that
 * is what makes "we will keep trying" true.
 */
export function pollDelayFor(state, body) {
  if (state === 'preparing') return PREPARING_POLL_MS;
  if (state === 'grading_pending') return GRADING_POLL_MS;
  if (state === 'unavailable') {
    const s = Number(body?.retry_after_seconds);
    if (!Number.isFinite(s) || s <= 0) return UNAVAILABLE_POLL_DEFAULT_MS;
    return Math.min(UNAVAILABLE_POLL_MAX_MS, Math.max(UNAVAILABLE_POLL_MIN_MS, Math.ceil(s) * 1000));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Clock. The remaining time is `expires_at - server_time`, both as the server
// sent them, so the browser's wall clock never matters. Between responses it is
// kept current with a monotonic local timer (performance.now()).
// ---------------------------------------------------------------------------

/**
 * An anchor from one server response: the remaining ms at the moment it was
 * received (`monoNow`, a monotonic ms reading). Null when either time is missing.
 */
export function clockAnchor(expiresAt, serverTime, monoNow) {
  const expires = Date.parse(expiresAt || '');
  const server = Date.parse(serverTime || '');
  if (!Number.isFinite(expires) || !Number.isFinite(server) || !Number.isFinite(monoNow)) return null;
  return { remainingMs: expires - server, at: monoNow };
}

/** Remaining ms now (never below 0), or null with no anchor. */
export function remainingMs(anchor, monoNow) {
  if (!anchor) return null;
  return Math.max(0, anchor.remainingMs - (monoNow - anchor.at));
}

/** True once the clock has reached zero, and only then. */
export const isTimeUp = (anchor, monoNow) => anchor !== null && anchor !== undefined && remainingMs(anchor, monoNow) === 0;

/** Submit automatically: time is up and no submission has started yet. */
export const shouldAutoSubmit = ({ anchor, monoNow, submitStarted }) => !submitStarted && isTimeUp(anchor, monoNow);

/** "mm:ss", rounding up so the clock shows 00:00 only at zero. */
export function formatClock(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '--:--';
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** The limit the server enforces, as status reports it before Start (`time_limit_minutes`), or null. */
export function timeLimitOf(status) {
  const m = Number(status?.time_limit_minutes);
  return status?.time_limit_minutes !== null && status?.time_limit_minutes !== undefined && Number.isFinite(m) && m > 0 ? m : null;
}

/** The attempt's whole time limit in minutes, from the server's own times, or null. */
export function limitMinutes(startedAt, expiresAt) {
  const start = Date.parse(startedAt || '');
  const end = Date.parse(expiresAt || '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60000);
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

/** `saved_answers` from start ([{ question_id, response }]) as { [question_id]: response }. */
export function answersFromSaved(saved) {
  const out = {};
  for (const a of Array.isArray(saved) ? saved : []) {
    if (a && typeof a.question_id === 'string' && typeof a.response === 'string') out[a.question_id] = a.response;
  }
  return out;
}

/**
 * The full answer set for evaluate: one entry per served question, `''` for an
 * unanswered one (the server reads `''` as "clear"), so the graded set is exactly
 * what the page shows.
 */
export function answersPayload(answers, questions) {
  return (Array.isArray(questions) ? questions : [])
    .filter((q) => q && typeof q.question_id === 'string')
    .map((q) => ({ question_id: q.question_id, response: typeof answers?.[q.question_id] === 'string' ? answers[q.question_id] : '' }));
}

/** The question as the page renders it: only these fields, whatever the response carried. */
export function questionView(q) {
  const out = {
    question_id: typeof q?.question_id === 'string' ? q.question_id : null,
    question_type: q?.question_type === 'mcq' ? 'mcq' : q?.question_type === 'short_answer' ? 'short_answer' : null,
    question: typeof q?.question === 'string' ? q.question : '',
    skill: typeof q?.skill === 'string' ? q.skill : null,
  };
  if (out.question_type === 'mcq') {
    out.options = (Array.isArray(q?.options) ? q.options : [])
      .filter((o) => o && typeof o.label === 'string')
      .map((o) => ({ label: o.label, text: typeof o.text === 'string' ? o.text : '' }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Result. Only these named fields are ever rendered. A field carrying a correct
// option, an ideal answer, key points, an explanation or recruiter feedback is
// never copied, even if a response happened to include one.
// ---------------------------------------------------------------------------

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const str = (v) => (typeof v === 'string' ? v : null);

/** What the page shows from an evaluate 200 body (R-11 candidateResult). */
export function candidateResultView(body) {
  const skills = (Array.isArray(body?.skills) ? body.skills : []).map((s) => ({
    skill: str(s?.skill) || 'unspecified',
    questions: num(s?.questions),
    correct: num(s?.correct),
    points_earned: num(s?.points_earned),
    points_possible: num(s?.points_possible),
  }));
  const results = (Array.isArray(body?.results) ? body.results : []).map((r) => ({
    question_id: str(r?.question_id),
    question_type: r?.question_type === 'mcq' || r?.question_type === 'short_answer' ? r.question_type : null,
    question: str(r?.question),
    skill: str(r?.skill),
    correct: r?.correct === true,
    points: num(r?.points),
    max_points: num(r?.max_points),
    candidate_feedback: str(r?.candidate_feedback),
  }));
  const scoring = body?.scoring && typeof body.scoring === 'object'
    ? { status: body.scoring.status === 'scored' ? 'scored' : 'failed', reason: str(body.scoring.reason) }
    : null;
  return {
    score: num(body?.score),
    points_earned: num(body?.points_earned),
    points_possible: num(body?.points_possible),
    skills,
    results,
    scoring,
    late_submission: body?.late_submission === true,
    answers_ignored: body?.answers_ignored === true,
    submitted_at: str(body?.submitted_at),
  };
}

/** "right", "partly right" or "wrong" for one graded question, from its points. */
export function outcomeOf(r) {
  if (r?.correct === true) return 'right';
  if (r?.points !== null && r?.points !== undefined && r.points > 0) return 'partly right';
  return 'wrong';
}

// ---------------------------------------------------------------------------
// Save errors (PUT /api/assessment/:id/answers)
// ---------------------------------------------------------------------------

/**
 * What to do after a failed save:
 *   'submit'  the time is up (409 time_expired): submit now, not an error screen
 *   'closed'  the attempt is no longer open (submitted, voided, not started): re-read status
 *   'retry'   may pass (network, 5xx, gateway, save_conflict): keep the answer and retry
 *   'fail'    the request itself is wrong (400, 404, 413): show it, do not retry
 */
export function saveErrorAction(err) {
  const code = err?.error;
  if (code === 'time_expired') return 'submit';
  if (code === 'already_submitted' || code === 'attempt_voided' || code === 'not_started') return 'closed';
  if (code === 'save_conflict') return 'retry';
  const status = Number(err?.status);
  if (!Number.isFinite(status) || status === 0 || status >= 500 || status === 408 || status === 429) return 'retry';
  return 'fail';
}

/** Backoff between save retries: 2 s, 4 s, 8 s, then 10 s. */
export const saveRetryDelay = (failures) => Math.min(10000, 2000 * 2 ** Math.max(0, failures - 1));
