// Core's side of the assessment (T-0031, I-0062; R-11, D§6.1, D§6.2, D§0 A1).
//
// 1. The HTTP client for assessment-service (generate, evaluate) and the mapping
//    of its errors onto core's error contract (fixed codes, never upstream text).
// 2. The attempt policy: ASSESSMENT_MAX_ATTEMPTS, voided attempts, the score of record.
// 3. Background preparation of the question pool (D§0 amendment A1). No candidate
//    request ever waits on the LLM: apply (and a status or start read) calls
//    prepareAssessment fire-and-forget; the pool is stored as an `assessments` row
//    with status `generated` and `answers` null ("ready, not started"), its key in
//    `assessment_keys`. In-flight and last-failure state lives in this process
//    only; nothing about a failure is written to the database.
//
// Environment, read on every call:
//   ASSESSMENT_SERVICE_URL       default http://localhost:8002
//   ASSESSMENT_MAX_ATTEMPTS      default 1 (integer >= 1)
//   ASSESSMENT_PREPARE_RETRIES   default 2 (integer 0..10): automatic retries on
//                                provider errors, with backoff, then it stops
//   ASSESSMENT_TIME_LIMIT_MINUTES default 15 (integer 1..240): R-12 server time limit
//
// `assessments.answers` shape (R-11 writes it at Start, once, atomically):
//   { "started_at": ISO-8601, "responses": [ { "question_id", "response" } ],
//     "saved_at"?: ISO-8601,            R-12: last save (PUT /:id/answers)
//     "submitted_at"?: ISO-8601,        R-12: the submission is fixed (graded or pending)
//     "late_submission"?: true,         R-12: submitted after deadline + grace; body ignored
//     "auto_submitted"?: "expired" }    R-12: closed on read after deadline + grace
// A row whose `answers` is null is an unstarted pool: not an attempt. Its
// `questions` column is `[]`; the questions sit in
// `assessment_keys.answer_key.pool_questions` until Start copies them over.
//
// R-12 phases of one row (attemptPhase), from the existing columns only:
//   voided     evaluation.voided is an object (the row is closed: status 'completed')
//   completed  status 'completed', not voided
//   grading    status 'grading' (a grader holds the claim)
//   submitted  status 'generated', answers.submitted_at set: "submitted, grading pending"
//              (the claim was released after a grading failure, or grading has not run yet)
//   expired    status 'generated', started, not submitted, server time > deadline + 30 s
//   open       status 'generated', started, not submitted, within deadline + 30 s
//   unstarted  status 'generated', answers null (a prepared pool; no deadline)
// The deadline is answers.started_at + ASSESSMENT_TIME_LIMIT_MINUTES, on core's
// clock (serverNow(); the same clock wrote started_at). Tests inject it with
// configurePreparation({ now }).
import { randomUUID } from 'node:crypto';

import supabase from '../Config/supabase.js';
import { logError } from '../Middlewares/errorHandler.js';
import { fetchGithubEvidence } from './githubEvidence.js';
import { InternalHttpError, postJson } from './internalHttp.js';
import { ResumePipelineError, runResumePipeline } from './resumePipeline.js';

const DEFAULT_URL = 'http://localhost:8002';

// Generation runs in the background only (A1), so this budget never holds a
// request open. It sits above the service's own total budget (under 240 s, R-07).
export const GENERATE_TIMEOUT_MS = 300000;
export const EVALUATE_TIMEOUT_MS = 120000;

const serviceUrl = (path) => `${(process.env.ASSESSMENT_SERVICE_URL || DEFAULT_URL).replace(/\/+$/, '')}${path}`;

export const generateAssessment = (payload, { requestId, timeoutMs = GENERATE_TIMEOUT_MS } = {}) =>
  postJson(serviceUrl('/generate-assessment'), payload, { requestId, timeoutMs });

export const evaluateAnswers = (payload, { requestId, timeoutMs = EVALUATE_TIMEOUT_MS } = {}) =>
  postJson(serviceUrl('/evaluate-assessment'), payload, { requestId, timeoutMs });

// ---------------------------------------------------------------------------
// Errors: assessment-service codes surfaced as fixed codes (ISSUES R-07/R-08).
// ---------------------------------------------------------------------------

/** Every code core may answer with for an assessment-service failure. */
export const ASSESSMENT_ERRORS = Object.freeze({
  llm_unavailable: {
    status: 502,
    message: 'The question generator (LLM provider) is not available right now. Please try again later.',
  },
  llm_invalid_output: {
    status: 502,
    message: 'The question generator returned output that could not be used. Please try again later.',
  },
  llm_not_configured: {
    status: 503,
    message: 'The assessment service has no LLM provider configured.',
  },
  grading_unavailable: {
    // R-12 (D§6.2 outage row): 503; the attempt stays "submitted, grading pending".
    status: 503,
    message: 'Your answers are saved but could not be graded right now. Nothing was scored yet; grading can be retried.',
  },
  invalid_evaluate_input: {
    status: 422,
    message: 'The submitted answers do not match the questions of this assessment.',
  },
  assessment_service_unavailable: {
    status: 503,
    message: 'The assessment service is not reachable right now. Please try again later.',
  },
  assessment_service_timeout: {
    status: 504,
    message: 'The assessment service did not answer in time. Please try again later.',
  },
  assessment_service_error: {
    status: 502,
    message: 'The assessment service failed. Please try again later.',
  },
});

const SERVICE_CODES = new Set(['llm_unavailable', 'llm_invalid_output', 'llm_not_configured', 'grading_unavailable', 'invalid_evaluate_input']);

/**
 * The stable code for an InternalHttpError from assessment-service. The service's
 * own `error` token is passed through when it is one we know; nothing else of the
 * upstream body is ever used. `operation` is 'generate' or 'evaluate'.
 */
export const assessmentErrorCode = (err, operation = 'generate') => {
  if (!(err instanceof InternalHttpError)) return 'assessment_service_error';
  if (err.kind === 'timeout') return 'assessment_service_timeout';
  if (err.kind === 'unreachable') return 'assessment_service_unavailable';
  if (err.kind === 'bad_status') {
    if (SERVICE_CODES.has(err.errorCode)) return err.errorCode;
    // FastAPI's own 422 (request schema) names no code; its body echoes the input.
    if (err.status === 422 && operation === 'evaluate') return 'invalid_evaluate_input';
  }
  return 'assessment_service_error';
};

/** The client answer for an assessment-service failure: { status, body: { error, message } }. */
export const assessmentFailure = (err, operation = 'generate') => {
  const code = assessmentErrorCode(err, operation);
  const { status, message } = ASSESSMENT_ERRORS[code];
  return { status, body: { error: code, message } };
};

// A provider or transport problem that may pass. A missing key does not.
const RETRYABLE = new Set([
  'llm_unavailable', 'llm_invalid_output', 'assessment_service_unavailable',
  'assessment_service_timeout', 'assessment_service_error',
]);

// ---------------------------------------------------------------------------
// Attempt policy (D§6.2)
// ---------------------------------------------------------------------------

const intFromEnv = (name, fallback, min, max) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export const maxAttempts = () => intFromEnv('ASSESSMENT_MAX_ATTEMPTS', 1, 1, 100);
export const prepareRetries = () => intFromEnv('ASSESSMENT_PREPARE_RETRIES', 2, 0, 10);

/**
 * ASSESSMENT_PREPARE_ON_APPLY (default true). When false, apply does not start a
 * preparation; status and start still prepare lazily. The test harness sets it
 * to false so live suites spend no LLM generations.
 */
export const prepareOnApply = () => {
  const raw = String(process.env.ASSESSMENT_PREPARE_ON_APPLY ?? '').trim().toLowerCase();
  return !['false', '0', 'no', 'off'].includes(raw);
};

/**
 * True when the attempt was voided (R-12 writes `evaluation.voided`, an object
 * with who, when and why). A voided attempt counts toward neither the attempt
 * limit nor the score.
 */
export const isVoided = (row) => {
  const v = row?.evaluation?.voided;
  return v !== null && typeof v === 'object' && !Array.isArray(v);
};

/** The Start time of an attempt, or null for an unstarted pool. */
export const startedAtOf = (row) => {
  const s = row?.answers?.started_at;
  return typeof s === 'string' && s ? s : null;
};

// ---------------------------------------------------------------------------
// R-12: server time limit (D§6.2 time, reload and outage rows)
// ---------------------------------------------------------------------------

export const timeLimitMinutes = () => intFromEnv('ASSESSMENT_TIME_LIMIT_MINUTES', 15, 1, 240);

/** Submissions are accepted until deadline + this; saves only until the deadline. */
export const SUBMIT_GRACE_MS = 30_000;

/** Core's clock in ms (injectable: configurePreparation({ now })). Every R-12 time check uses it. */
export const serverNow = () => deps.now();

/** When the attempt was submitted (the submission is fixed), or null. */
export const submittedAtOf = (row) => {
  const s = row?.answers?.submitted_at;
  return typeof s === 'string' && s ? s : null;
};

/** The deadline in ms (started_at + limit), or null for an unstarted pool (no deadline). */
export const deadlineOf = (row) => {
  const started = Date.parse(startedAtOf(row) || '');
  return Number.isFinite(started) ? started + timeLimitMinutes() * 60_000 : null;
};

/** The phase of one row (see the list at the top of this file). */
export const attemptPhase = (row, now = serverNow()) => {
  if (isVoided(row)) return 'voided';
  if (row?.status === 'completed') return 'completed';
  if (row?.status === 'grading') return 'grading';
  if (!startedAtOf(row)) return 'unstarted';
  if (submittedAtOf(row)) return 'submitted';
  return now > deadlineOf(row) + SUBMIT_GRACE_MS ? 'expired' : 'open';
};

/** `{ started_at, expires_at, server_time }` for a response; expires_at null when unstarted. */
export const timingOf = (row, now = serverNow()) => {
  const deadline = row ? deadlineOf(row) : null;
  return {
    started_at: row ? startedAtOf(row) : null,
    expires_at: deadline === null ? null : new Date(deadline).toISOString(),
    server_time: new Date(now).toISOString(),
  };
};

const plainObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

/** The state an attempt was in when it was voided (kept in the void record). */
const PRIOR_STATE = {
  unstarted: 'unstarted', open: 'in_progress', expired: 'expired',
  submitted: 'grading_pending', grading: 'grading_pending', completed: 'completed',
};

/**
 * The void record kept in `evaluation.voided` (D§6.2 "Resetting an attempt"):
 *   { by, role, at, reason, prior_state }
 *   by          the user id of the recruiter or admin, or 'system'
 *   role        'recruiter' | 'admin' | 'system'
 *   at          ISO-8601, core's clock
 *   reason      the given reason (system: the reason code, e.g. 'pool_missing')
 *   prior_state 'unstarted' | 'in_progress' | 'expired' | 'grading_pending' | 'completed'
 */
export const voidRecord = ({ by, role, reason, row, now = serverNow() }) => ({
  by: String(by),
  role,
  at: new Date(now).toISOString(),
  reason,
  prior_state: PRIOR_STATE[attemptPhase(row, now)] || 'unknown',
});

/**
 * Void one row and close it, with no schema change and no new status: status
 * 'completed', `evaluation.voided` = the record, `completed_at` kept (or set now).
 * Its answers, score and any evaluation stay as they were; the row is never
 * deleted. Guarded on the status it was read with and on not being voided yet, so
 * a concurrent grade or void makes this a no-op. A grader in flight loses its
 * claim (its complete is guarded on status 'grading'). Returns true when this
 * call closed the row; throws on a database error.
 */
export async function voidAttempt(row, record) {
  const evaluation = { ...(plainObject(row.evaluation) || {}), voided: record };
  let q = supabase
    .from('assessments')
    .update({ status: 'completed', evaluation, completed_at: row.completed_at || record.at, grading_started_at: null })
    .eq('id', row.id)
    .eq('status', row.status)
    .is('evaluation->voided', null);
  if (row.status === 'grading' && row.grading_started_at) q = q.eq('grading_started_at', row.grading_started_at);
  const { data, error } = await q.select('id');
  if (error) throw dbFailure('void attempt', error);
  return Array.isArray(data) && data.length === 1;
}

/**
 * D2 (R-11 verifier): an unstarted row whose pool cannot be served (no key row,
 * or no pool in it) is closed as voided by the system with reason `pool_missing`,
 * so it no longer holds the one open slot and a new pool can be prepared. The
 * row is kept. Returns true when closed; never throws (a failure is logged and
 * the next read tries again).
 */
export async function closeBrokenPool(row, context = '') {
  try {
    const closed = await voidAttempt(row, voidRecord({ by: 'system', role: 'system', reason: BROKEN_POOL_REASON, row }));
    if (closed) console.warn(`[assessment] ${context} closed unstarted row ${row.id}: ${BROKEN_POOL_REASON} (voided by system, row kept)`);
    return closed;
  } catch (err) {
    logError(null, `[assessment] ${context} could not close broken pool ${row.id}`, err.cause || err);
    return false;
  }
}

const OPEN_STATUSES = new Set(['generated', 'grading']);
const stamp = (v) => Date.parse(v || '') || 0;

/**
 * Sum up a candidate's rows for one job.
 *   open           the open row (status generated or grading, not voided) or null
 *   counted        completed, non-voided attempts, oldest first
 *   used / max / left
 *   scoreOfRecord  { assessmentId, score, completedAt } of the FIRST counted attempt, or null
 */
export const summariseAttempts = (rows, max = maxAttempts()) => {
  const list = Array.isArray(rows) ? rows : [];
  const open = list.find((r) => OPEN_STATUSES.has(r?.status) && !isVoided(r)) || null;
  const counted = list
    .filter((r) => r?.status === 'completed' && !isVoided(r))
    .sort((a, b) => stamp(a.completed_at) - stamp(b.completed_at));
  const first = counted[0] || null;
  return {
    open,
    counted,
    used: counted.length,
    max,
    left: Math.max(0, max - counted.length),
    scoreOfRecord: first
      ? { assessmentId: first.id, score: first.score == null ? null : Number(first.score), completedAt: first.completed_at ?? null }
      : null,
  };
};

const dbFailure = (context, cause) => Object.assign(new Error(`${context} failed`), { code: 'database_error', cause });

/** The candidate's assessment rows for one job (no questions, no key). Throws on a lookup error. */
export async function loadAttempts(candidateId, jobId) {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, candidate_id, job_id, status, answers, score, evaluation, created_at, completed_at, grading_started_at')
    .eq('candidate_id', candidateId)
    .eq('job_id', jobId);
  if (error) throw dbFailure('assessment lookup', error);
  return data || [];
}

/** Whether the candidate applied for the job. Throws on a lookup error (never "not applied"). */
export async function hasApplication(candidateId, jobId) {
  const { data, error } = await supabase
    .from('applications')
    .select('id')
    .eq('candidate_id', candidateId)
    .eq('job_id', jobId)
    .limit(1);
  if (error) throw dbFailure('application lookup', error);
  return Array.isArray(data) && data.length > 0;
}

const JOB_COLUMNS = 'id, title, description, required_skills, preferred_skills, experience_level';

/**
 * The questions of an unstarted pool. Until Start they live only inside
 * `assessment_keys.answer_key.pool_questions` (no browser role can read that
 * table), and `assessments.questions` is `[]`, so nobody can read them before the
 * clock starts. Returns the questions bundle ({ assessment_id, model_used,
 * prompt_version, questions: [...] }), or null when the key row or its pool is
 * missing or empty (a broken pool). Throws on a lookup error.
 */
export async function loadPoolQuestions(assessmentId) {
  const { data, error } = await supabase
    .from('assessment_keys')
    .select('answer_key')
    .eq('assessment_id', assessmentId)
    .maybeSingle();
  if (error) throw dbFailure('pool lookup', error);
  return poolOf(data?.answer_key);
}

/** The servable pool inside one `answer_key`, or null (R-13: shared with the batched recruiter check). */
export const poolOf = (answerKey) => {
  const pool = answerKey?.pool_questions;
  return pool && typeof pool === 'object' && Array.isArray(pool.questions) && pool.questions.length > 0 ? pool : null;
};

/** The fixed reason code for an unstarted row whose pool cannot be served. */
export const BROKEN_POOL_REASON = 'pool_missing';

/** The job, or null. Throws on a lookup error. */
export async function loadJob(jobId) {
  const { data, error } = await supabase.from('jobs').select(JOB_COLUMNS).eq('id', jobId).maybeSingle();
  if (error) throw dbFailure('job lookup', error);
  return data || null;
}

// ---------------------------------------------------------------------------
// Background preparation (D§0 A1)
// ---------------------------------------------------------------------------

/** A failed preparation older than this is retried on the next status read. */
export const UNAVAILABLE_RETRIGGER_MS = 60_000;

const defaultSleep = (ms) => new Promise((resolve) => {
  const t = setTimeout(resolve, ms);
  t.unref?.(); // a pending backoff never keeps the process (or a test runner) alive
});

const DEFAULT_DEPS = Object.freeze({
  generate: (payload, opts) => generateAssessment(payload, opts),
  sleep: defaultSleep,
  now: () => Date.now(),
  backoffMs: (retry) => 2000 * 2 ** (retry - 1), // 2 s, 4 s, ...
});

let deps = { ...DEFAULT_DEPS };

/** Tests: replace the generator call, the sleep, the clock or the backoff. */
export function configurePreparation(overrides = {}) {
  deps = { ...deps, ...overrides };
}

/** Tests: restore the defaults and forget all in-memory state. */
export function resetPreparation() {
  deps = { ...DEFAULT_DEPS };
  registry.clear();
}

// key `${candidateId}:${jobId}` -> { inFlight: Promise | null, lastFailure: { reason, at } | null }
// D3 (R-11 verifier): an entry lives only while it is needed. A run that ends
// without a failure removes its entry at once; a failure record is kept only
// while the 60 s gate needs it and is swept on the next registry access after.
const registry = new Map();
const keyOf = (candidateId, jobId) => `${candidateId}:${jobId}`;

/** True when the last preparation failed long enough ago to try again. */
export function failureIsStale(lastFailure) {
  return Boolean(lastFailure) && deps.now() - lastFailure.at > UNAVAILABLE_RETRIGGER_MS;
}

function sweepRegistry() {
  for (const [key, e] of registry) {
    if (!e.inFlight && (!e.lastFailure || failureIsStale(e.lastFailure))) registry.delete(key);
  }
}

/** Tests (D3): how many candidate+job entries the in-memory registry holds. */
export function preparationRegistrySize() {
  sweepRegistry();
  return registry.size;
}

/** In-memory preparation state: { inFlight, lastFailure: { reason, at } | null }. */
export function preparationState(candidateId, jobId) {
  sweepRegistry();
  const e = registry.get(keyOf(candidateId, jobId));
  return { inFlight: Boolean(e?.inFlight), lastFailure: e?.lastFailure ? { ...e.lastFailure } : null };
}

/**
 * What a candidate read does when no pool exists (D1: status and start share it).
 *   { state: 'preparing' }                         a run is in flight
 *   { state: 'unavailable', reason, retryAfterMs }  the last run failed less than 60 s ago
 *   { state: 'preparing', start: true }             nothing in flight, no fresh failure:
 *                                                   the caller triggers a run
 */
export function preparationDecision(candidateId, jobId) {
  const prep = preparationState(candidateId, jobId);
  if (prep.inFlight) return { state: 'preparing' };
  if (prep.lastFailure && !failureIsStale(prep.lastFailure)) {
    const retryAfterMs = Math.max(0, UNAVAILABLE_RETRIGGER_MS - (deps.now() - prep.lastFailure.at));
    return { state: 'unavailable', reason: prep.lastFailure.reason, retryAfterMs };
  }
  return { state: 'preparing', start: true };
}

const asStrings = (v, max) => (Array.isArray(v) ? v : [])
  .filter((s) => typeof s === 'string' && s.trim())
  .map((s) => s.slice(0, 200))
  .slice(0, max);

const buildPayload = ({ candidateId, job, parsed, github }) => {
  const title = String(job.title || '').trim().slice(0, 200) || 'Untitled role';
  const description = String(job.description || '').trim().slice(0, 12000) || title;
  return {
    candidate_id: String(candidateId),
    job_id: String(job.id),
    job_title: title,
    job_description: description,
    required_skills: asStrings(job.required_skills, 50),
    preferred_skills: asStrings(job.preferred_skills, 50),
    // The full parsed text (R-09 caps it at 20,000 characters); never persisted.
    resume_text: parsed.rawText.slice(0, 20000),
    resume_skills: asStrings(parsed.resume?.skills, 100),
    resume_projects: (Array.isArray(parsed.resume?.projects) ? parsed.resume.projects : [])
      .filter((p) => p && typeof p === 'object' && !Array.isArray(p))
      .slice(0, 30),
    experience_level: String(job.experience_level || 'unspecified').slice(0, 100),
    include_github: github?.ok === true,
    github_data: github?.ok === true ? github.evidence : null,
  };
};

/** The service's 200 body is usable only if questions and key match one to one. */
const usableBundle = (data) => {
  const q = data?.questions;
  const k = data?.answer_key;
  if (!q || typeof q.assessment_id !== 'string' || !Array.isArray(q.questions) || q.questions.length === 0) return false;
  if (!k || !Array.isArray(k.answers) || k.answers.length !== q.questions.length) return false;
  const ids = new Set(q.questions.map((x) => x?.question_id));
  return ids.size === q.questions.length && k.answers.every((a) => ids.has(a?.question_id));
};

const outcome = (status, reason = null, extra = {}) => ({ status, reason, ...extra });

async function runPreparation(candidateId, jobId, requestId) {
  // 1. Eligibility: an application, an attempt left, no open row (pool or attempt).
  let job;
  try {
    job = await loadJob(jobId);
    if (!job) return outcome('skipped', 'job_not_found');
    if (!(await hasApplication(candidateId, jobId))) return outcome('skipped', 'not_applied');
    const s = summariseAttempts(await loadAttempts(candidateId, jobId));
    if (s.open) return outcome('skipped', 'attempt_open');
    if (s.left === 0) return outcome('skipped', 'attempts_used');
  } catch (err) {
    logError(null, `[assessment-prep] eligibility lookup failed`, err.cause || err);
    return outcome('failed', 'database_error');
  }

  // 2. The resume pipeline: full text and contact (R-09). Persists a `resumes` row.
  let parsed;
  try {
    parsed = await runResumePipeline({ candidateId, job, requestId });
  } catch (err) {
    if (err instanceof ResumePipelineError) {
      logError(null, `[assessment-prep] resume pipeline failed: ${err.code}`, err.cause);
      return outcome('failed', err.code);
    }
    throw err;
  }
  if (typeof parsed.rawText !== 'string' || !parsed.rawText.trim()) return outcome('failed', 'unreadable_document');

  // 3. GitHub evidence, when the resume links an account. Never throws.
  const github = await fetchGithubEvidence({
    githubLink: parsed.contact?.github,
    claimedSkills: Array.isArray(parsed.resume?.skills) ? parsed.resume.skills : [],
    requestId,
  });

  // 4. Generate, with bounded retries on provider errors.
  const payload = buildPayload({ candidateId, job, parsed, github });
  const attempts = 1 + prepareRetries();
  let data = null;
  let lastCode = null;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const body = await deps.generate(payload, { requestId });
      if (usableBundle(body)) { data = body; break; }
      lastCode = 'assessment_service_error';
      console.error(`[assessment-prep] request_id=${requestId} malformed service payload (try ${i}/${attempts})`);
    } catch (err) {
      lastCode = assessmentErrorCode(err, 'generate');
      console.error(`[assessment-prep] request_id=${requestId} generate failed (try ${i}/${attempts}): ${lastCode}`);
      if (!RETRYABLE.has(lastCode)) break;
    }
    if (i < attempts) await deps.sleep(deps.backoffMs(i));
  }
  if (!data) return outcome('failed', lastCode || 'assessment_service_error');

  // 5. Store the pool, then its key. No pool may exist without its key. Until
  // Start the questions live only in the key row (`pool_questions`); the
  // candidate-readable `assessments.questions` stays `[]` (jsonb NOT NULL).
  const bundle = data.questions;
  const { data: inserted, error: insertError } = await supabase
    .from('assessments')
    .insert({
      id: bundle.assessment_id,
      candidate_id: candidateId,
      job_id: job.id,
      questions: [],
      model_used: bundle.model_used ?? null,
      prompt_version: bundle.prompt_version ?? null,
      status: 'generated',
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    // 23505: another pool or open attempt for this candidate and job won the race.
    if (insertError?.code === '23505') return outcome('skipped', 'attempt_open');
    logError(null, `[assessment-prep] pool insert failed`, insertError);
    return outcome('failed', 'database_error');
  }
  const { error: keyError } = await supabase
    .from('assessment_keys')
    .insert({ assessment_id: inserted.id, answer_key: { ...data.answer_key, pool_questions: bundle } });
  if (keyError) {
    // D2: the keyless row is never deleted; it is closed as voided (pool_missing,
    // by system) so it does not hold the open slot. If even that fails, the next
    // status or start read closes it.
    logError(null, `[assessment-prep] key insert failed`, keyError);
    await closeBrokenPool({ id: inserted.id, status: 'generated', answers: null, evaluation: null }, 'prep:');
    return outcome('failed', 'database_error');
  }
  console.log(`[assessment-prep] request_id=${requestId} pool ${inserted.id} ready model=${bundle.model_used ?? 'unknown'} questions=${bundle.questions.length}`);
  return outcome('ready', null, { assessmentId: inserted.id });
}

/**
 * Prepare the question pool for one candidate and job, off the request path.
 * At most one preparation runs per candidate and job: a second call while one
 * is in flight returns the same promise. The promise never rejects; it resolves
 * to { status: 'ready' | 'skipped' | 'failed', reason, assessmentId? }. A
 * failure is remembered in memory ({ reason, at }) and is never stored.
 */
export function prepareAssessment(candidateId, jobId, { requestId } = {}) {
  if (!candidateId || !jobId) return Promise.resolve(outcome('skipped', 'invalid_input'));
  const key = keyOf(candidateId, jobId);
  sweepRegistry();
  let entry = registry.get(key);
  if (!entry) {
    entry = { inFlight: null, lastFailure: null };
    registry.set(key, entry);
  }
  if (entry.inFlight) return entry.inFlight;

  const id = requestId || randomUUID();
  const run = (async () => {
    let result;
    try {
      result = await runPreparation(candidateId, jobId, id);
    } catch (err) {
      try { logError(null, `[assessment-prep] unexpected failure`, err); } catch { /* never reject */ }
      result = outcome('failed', 'internal_error');
    }
    entry.lastFailure = result.status === 'failed' ? { reason: result.reason, at: deps.now() } : null;
    entry.inFlight = null;
    // D3: nothing left to remember -> evict now; a failure stays until the gate passes.
    if (!entry.lastFailure && registry.get(key) === entry) registry.delete(key);
    return result;
  })();
  entry.inFlight = run;
  return run;
}

/**
 * Fire-and-forget form for request handlers: starts (or joins) a preparation and
 * returns at once. Never throws and never leaves a rejected promise behind.
 */
export function triggerPreparation(candidateId, jobId, opts = {}) {
  try {
    prepareAssessment(candidateId, jobId, opts).catch(() => {});
  } catch (err) {
    try { logError(null, '[assessment-prep] trigger failed', err); } catch { /* ignore */ }
  }
}
