// Pure helpers for the recruiter applications view (card R-18). No React, no fetch:
// every function turns a value the backend sent into words or a count, and nothing
// is invented or re-derived from a threshold (DECISIONS.md §7, §8.2).
//
// Sources (backend):
//   list item / detail     GET /api/recruiter/applications[?jobId=] and /:id
//                          (backend/Controllers/analysis.controller.js, R-13 header)
//   application status     the `application_status` enum (supabase migration
//                          20260830000000); apply writes `submitted`, the status route
//                          (POST /api/jobs/applications/shortlist) writes `shortlisted`
//                          or `rejected`. `under_review` and `withdrawn` exist in the
//                          enum but no code path writes them; they are labelled if seen.
//   assessment state       candidateView in observe-only mode (assessment.controller.js)
//   attempt state          recruiterAttempt (assessment.controller.js RECRUITER_STATE)
//   void record            { by, role, at, reason, prior_state } (assessmentService.js voidRecord)
//   scoring reason codes   Services/scoringPipeline.js, sent as `scoring: { status, reason }`

import { Star } from 'lucide-react';

/** The three sub-score keys (backend/Services/explainability.js SUBSCORE_KEYS), in display order. */
export const SUBSCORES = [
  { key: 'parsing_semantic_alignment', testId: 'subscore-parsing', label: 'Resume to job alignment' },
  { key: 'github_evidence', testId: 'subscore-github', label: 'GitHub evidence' },
  { key: 'assessment_results', testId: 'subscore-assessment', label: 'Assessment results' },
];

export const subscoreTestId = (key) => SUBSCORES.find((s) => s.key === key)?.testId || null;
export const subscoreLabel = (key) => SUBSCORES.find((s) => s.key === key)?.label || String(key);

// ---------------------------------------------------------------------------
// Application status
// ---------------------------------------------------------------------------

const APPLICATION_STATUS = {
  submitted: { label: 'Submitted', filterLabel: 'Submitted (no decision yet)', variant: 'outline' },
  under_review: { label: 'Under review', filterLabel: 'Under review', variant: 'primary' },
  shortlisted: { label: 'Shortlisted', filterLabel: 'Shortlisted', variant: 'solid', icon: Star },
  rejected: { label: 'Rejected', filterLabel: 'Rejected', variant: 'destructive' },
  withdrawn: { label: 'Withdrawn', filterLabel: 'Withdrawn', variant: 'default' },
};

/** The statuses the API writes today, always offered in the filter. */
export const WRITTEN_STATUSES = ['submitted', 'shortlisted', 'rejected'];

/** { label, variant } for a status; an unknown value is shown as sent. */
export const statusText = (status) => APPLICATION_STATUS[status]
  || { label: String(status || 'Unknown'), filterLabel: String(status || 'Unknown'), variant: 'outline' };

/**
 * Filter options: the written statuses plus any other status present in the data,
 * each with how many of `items` have it. First option is "all".
 */
export const statusFilterOptions = (items) => {
  const list = Array.isArray(items) ? items : [];
  const values = [...WRITTEN_STATUSES];
  for (const item of list) if (item?.status && !values.includes(item.status)) values.push(item.status);
  return [
    { value: 'all', label: 'All statuses', count: list.length },
    ...values.map((value) => ({
      value,
      label: statusText(value).filterLabel,
      count: list.filter((i) => i?.status === value).length,
    })),
  ];
};

export const filterByStatus = (items, status) => {
  const list = Array.isArray(items) ? items : [];
  return !status || status === 'all' ? list : list.filter((i) => i?.status === status);
};

/** The list with one row's status replaced by the server's answer (nothing else changes). */
export const withStatus = (items, applicationId, status) => (Array.isArray(items) ? items : [])
  .map((i) => (i.id === applicationId ? { ...i, status } : i));

// ---------------------------------------------------------------------------
// Assessment state, in plain words
// ---------------------------------------------------------------------------

const ASSESSMENT_STATE = {
  not_prepared: {
    label: 'Not prepared yet',
    hint: 'No question set has been prepared for this candidate yet.',
  },
  preparing: { label: 'Being prepared', hint: 'The question set is being generated now.' },
  unavailable: { label: 'Not ready', hint: 'The question set could not be prepared yet.' },
  ready: { label: 'Ready, not started', hint: 'Questions are prepared; the candidate has not started.' },
  in_progress: { label: 'In progress', hint: 'The candidate has started and the clock is running.' },
  grading_pending: {
    label: 'Submitted, grading pending',
    hint: 'Answers are saved and waiting to be graded.',
  },
  completed: { label: 'Completed', hint: 'The attempt was graded; its result is the score of record.' },
  attempts_used: {
    label: 'Attempts used, no result',
    hint: 'The candidate has no attempts left and no graded result.',
  },
  voided: { label: 'Reset (voided)', hint: 'This attempt was reset and does not count.' },
};

const UNAVAILABLE_REASONS = {
  pool_missing: 'the prepared question set is missing',
};

/**
 * { label, hint } for an assessment block from the list or the detail. A completed
 * state names the score of record exactly as the API sent it; an unavailable state
 * names the reason code as sent (no invented cause).
 */
export const assessmentStateText = (assessment) => {
  const state = assessment?.state;
  const known = ASSESSMENT_STATE[state];
  const base = known ? { ...known } : { label: String(state || 'Unknown'), hint: null };
  if (state === 'unavailable' && assessment?.reason) {
    base.hint = `Not ready: ${UNAVAILABLE_REASONS[assessment.reason] || `reason code ${assessment.reason}`}.`;
  }
  if (state === 'completed' && assessment?.score_of_record && assessment.score_of_record.score !== null
    && assessment.score_of_record.score !== undefined) {
    base.label = `Completed: ${assessment.score_of_record.score}`;
    base.hint = 'Assessment score of record (0 to 100).';
  }
  return base;
};

/** Words for one attempt's `state` (recruiterAttempt). */
export const attemptStateText = (state) => ASSESSMENT_STATE[state] || { label: String(state || 'Unknown'), hint: null };

const PRIOR_STATE = {
  unstarted: 'not started',
  in_progress: 'in progress',
  expired: 'time expired',
  grading_pending: 'submitted, grading pending',
  completed: 'completed',
};

/**
 * Who, when and why for one void record. `by` is an account id; the API sends no
 * name for it, so the current recruiter is "you" and anyone else is named by role
 * and id.
 */
export const describeVoid = (voided, currentUserId = null) => {
  if (!voided) return null;
  let who;
  if (voided.role === 'system') who = 'the system (automatic)';
  else if (currentUserId && voided.by === currentUserId) who = 'you';
  else who = `${voided.role || 'unknown role'} (account ${voided.by || 'unknown'})`;
  const reason = voided.role === 'system' && UNAVAILABLE_REASONS[voided.reason]
    ? `${voided.reason}: ${UNAVAILABLE_REASONS[voided.reason]}`
    : voided.reason || 'no reason recorded';
  return {
    who,
    at: voided.at || null,
    reason,
    prior: voided.prior_state ? (PRIOR_STATE[voided.prior_state] || voided.prior_state) : null,
  };
};

/** States in which an attempt was actually taken, so a reset makes sense (D§6.2). */
const RESETTABLE = new Set(['in_progress', 'grading_pending', 'completed']);

/**
 * The attempt a reset applies to: the newest attempt that is not voided and was
 * started. Null when there is none (no attempt taken, or every one already reset).
 * `items` is the detail's `assessment.items`, oldest first.
 */
export const resettableAttempt = (items) => {
  const list = Array.isArray(items) ? items : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const it = list[i];
    if (it && !it.voided && RESETTABLE.has(it.state)) return it;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const SCORING_REASONS = {
  no_resume: 'the candidate has no resume on file',
  storage_error: 'the stored resume could not be read',
  unreadable_document: 'no text could be read from the resume file',
  unsupported_file_type: 'the resume parser cannot read this file type',
  parser_unavailable: 'the resume parser is not available',
  parser_failed: 'the resume parser returned an error',
  database_error: 'a database error stopped the score from being saved',
  job_not_found: 'the job could not be found',
  job_lookup_failed: 'the job details could not be loaded',
  assessment_lookup_failed: 'the assessment results could not be loaded',
  no_evidence: 'no evidence source produced a result',
  score_insert_failed: 'the score was worked out but could not be saved',
  internal_error: 'an unexpected server error stopped scoring',
};

/** A sentence for a failed scoring attempt; an unknown code is shown as sent. */
export const scoringFailureText = (reason) => {
  if (!reason) return 'Scoring did not complete.';
  return `Scoring did not complete: ${SCORING_REASONS[reason] || `reason code ${reason}`}.`;
};

// ---------------------------------------------------------------------------
// Dashboard counts (all from the same list the table shows)
// ---------------------------------------------------------------------------

export const dashboardCounts = (items) => {
  const list = Array.isArray(items) ? items : [];
  const count = (pred) => list.filter(pred).length;
  return {
    total: list.length,
    scored: count((i) => Boolean(i.score)),
    notScored: count((i) => !i.score),
    evidenceLimited: count((i) => i.score?.evidence_limited === true),
    submitted: count((i) => i.status === 'submitted'),
    shortlisted: count((i) => i.status === 'shortlisted'),
    rejected: count((i) => i.status === 'rejected'),
    assessmentsCompleted: count((i) => i.assessment?.state === 'completed'),
    withReset: count((i) => Array.isArray(i.assessment?.voided) && i.assessment.voided.length > 0),
  };
};

/** Per-job counts from the list: [{ jobId, title, total, scored, shortlisted }], by title. */
export const countsByJob = (items) => {
  const byJob = new Map();
  for (const i of Array.isArray(items) ? items : []) {
    const id = i?.job?.id;
    if (!id) continue;
    const entry = byJob.get(id) || { jobId: id, title: i.job.title ?? null, total: 0, scored: 0, shortlisted: 0 };
    entry.total += 1;
    if (i.score) entry.scored += 1;
    if (i.status === 'shortlisted') entry.shortlisted += 1;
    byJob.set(id, entry);
  }
  return [...byJob.values()].sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
};

/** A date-time as the browser shows it, or null. */
export const formatWhen = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
};
