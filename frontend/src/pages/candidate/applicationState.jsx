import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Badge from '../../components/Badge';
import {
  api, isAborted, isStillWorking, pollServerState, STILL_WORKING_POLL_MS, stillWorkingSeconds,
} from '../../lib/api';

/**
 * Shared candidate-side vocabulary for one application (card R-16). Everything here
 * turns a code the backend sent into words; nothing is derived or invented.
 *
 * Sources (backend):
 *   scoring reason codes   Services/scoringPipeline.js SCORING_FAILURE_REASONS, sent by
 *                          POST /api/jobs/:id/apply and POST /api/applications/:id/score
 *                          as `scoring: { status: 'scored' | 'failed', reason }`
 *   scoring state          GET /api/jobs/my-applications rows: `scoring.state` 'scored' | 'pending'
 *                          (no failure reason is stored, so a listed row never has one)
 *   application status     the `application_status` enum (supabase migration 20260830000000)
 *   assessment state       GET /api/assessment/status?jobId= `state`
 *                          (Controllers/assessment.controller.js candidateView)
 */

const SCORING_REASONS = {
  no_resume: 'There is no resume on your profile to score.',
  storage_error: 'Your stored resume could not be read from storage.',
  unreadable_document: 'No text could be read from your resume file.',
  unsupported_file_type: 'The resume parser cannot read this file type.',
  parser_unavailable: 'The resume parser is not available right now.',
  parser_failed: 'The resume parser returned an error.',
  database_error: 'A database error stopped the score from being saved.',
  job_not_found: 'The job could not be found.',
  job_lookup_failed: 'The job details could not be loaded.',
  assessment_lookup_failed: 'Your assessment results could not be loaded.',
  no_evidence: 'No evidence source produced a result, so there was nothing to score.',
  score_insert_failed: 'The score was worked out but could not be saved.',
  internal_error: 'An unexpected server error stopped scoring.',
};

/** A plain sentence for a scoring failure reason code; an unknown code is shown as sent. */
export const scoringReasonText = (reason) => {
  if (!reason) return null;
  return SCORING_REASONS[reason] || `Scoring did not complete (reason code: ${reason}).`;
};

const APPLICATION_STATUS = {
  submitted: { label: 'Submitted', variant: 'outline' },
  under_review: { label: 'Under review', variant: 'primary' },
  shortlisted: { label: 'Shortlisted', variant: 'success' },
  rejected: { label: 'Not selected', variant: 'destructive' },
  withdrawn: { label: 'Withdrawn', variant: 'default' },
};

export function StatusBadge({ status }) {
  const known = APPLICATION_STATUS[status];
  return (
    <Badge variant={known ? known.variant : 'outline'} data-testid="status-badge" data-status={status || ''}>
      {known ? known.label : String(status || 'Unknown')}
    </Badge>
  );
}

const ASSESSMENT_STATE = {
  not_applied: { label: 'Not applied', hint: 'Apply to this job to take its assessment.' },
  preparing: { label: 'Being prepared', hint: 'Your assessment is being prepared.' },
  unavailable: { label: 'Not ready yet', hint: 'Not ready yet. We will keep trying.' },
  ready: { label: 'Ready to start', hint: 'Your assessment is ready. The clock starts when you press Start.' },
  in_progress: { label: 'In progress', hint: 'You have started this assessment.' },
  grading_pending: { label: 'Submitted, grading pending', hint: 'Your answers are saved and waiting to be graded.' },
  completed: { label: 'Completed', hint: 'You have completed this assessment.' },
  attempts_used: { label: 'No attempts left', hint: 'You have used your attempts for this assessment.' },
};

/** Label and one-line hint for an assessment state name; an unknown state is shown as sent. */
export const assessmentStateText = (state) =>
  ASSESSMENT_STATE[state] || { label: String(state), hint: null };

/**
 * "Score again": POST /api/applications/:id/score. Calls `onResult(scoring)` with the
 * `{ status, reason }` object the server returned, or `onError(apiError)` when the
 * request itself failed. The application is never affected either way.
 *
 * R-33: a gateway timeout or a dropped connection is not a failure (the score may still
 * be saved). The button shows "Still working" and reads GET /api/applications/:id/result
 * every few seconds for a bounded time. When that read shows a score row, `onResult`
 * gets `{ status: 'scored', reason: null }` (the server holds a score); otherwise the
 * button says the server holds no score yet. It is only used while the application has
 * no score, so "a score row exists" means this scoring completed.
 */
export function ScoreAgainButton({ applicationId, onResult, onError, className = '' }) {
  const [busy, setBusy] = useState(false);
  const [still, setStill] = useState(false);
  const [note, setNote] = useState('');
  const ctrlRef = useRef(null);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  const readBack = async () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setStill(true);
    try {
      const out = await pollServerState(
        (signal) => api.get(`/api/applications/${encodeURIComponent(applicationId)}/result`, { signal, cache: 'no-store' }),
        (data) => Boolean(data?.score),
        { signal: ctrl.signal },
      );
      if (out.settled) {
        onResult?.({ status: 'scored', reason: null });
      } else if (out.error && !out.hasValue) {
        setNote(`The server did not answer in time, and the current state could not be read: ${out.error.message} Reload the page to see it.`);
      } else {
        setNote(`The server did not answer in time and still shows no score after ${stillWorkingSeconds()} s. It may still be finishing; reload the page later.`);
      }
    } catch (err) {
      if (!isAborted(err)) setNote(`The current state could not be read: ${err.message}`);
    } finally {
      if (!ctrl.signal.aborted) setStill(false);
    }
  };

  const run = async () => {
    if (busy || still || !applicationId) return;
    setBusy(true);
    setNote('');
    let stillWorking = false;
    try {
      const data = await api.post(`/api/applications/${applicationId}/score`);
      onResult?.(data?.scoring || null);
    } catch (err) {
      if (isStillWorking(err)) stillWorking = true;
      else onError?.(err);
    } finally {
      setBusy(false);
    }
    if (stillWorking) await readBack();
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy || still || !applicationId}
        data-testid="score-again-button"
        className={`inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${busy || still ? 'animate-spin' : ''}`} />
        {busy ? 'Scoring...' : still ? 'Still working...' : 'Score again'}
      </button>
      {still && (
        <span className="text-xs text-muted-foreground" role="status" data-testid="still-working">
          Still working: the server has not answered yet but may still be scoring. Checking every {Math.round(STILL_WORKING_POLL_MS / 1000)} s.
        </span>
      )}
      {!still && note && (
        <span className="text-xs text-muted-foreground" role="status" data-testid="still-working-note">{note}</span>
      )}
    </span>
  );
}
