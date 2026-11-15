import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronRight, RefreshCw, Users } from 'lucide-react';
import Badge from '../Badge';
import Button from '../Button';
import EmptyState from '../EmptyState';
import ScoreBadge, {
  AWAITING_ASSESSMENT, VerificationBadge, partialScoreLabel, showEvidenceLimited,
} from '../ScoreBadge';
import Spinner from '../Spinner';
import CandidateModal from './CandidateModal';
import { api, isAborted, isStillWorking, pollServerState, stillWorkingSeconds } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  assessmentStateText, describeVoid, filterByStatus, formatWhen, scoringFailureText,
  statusFilterOptions, statusText, withStatus,
} from './applicationsLogic';

/**
 * The one recruiter applications table (card R-18, DECISIONS.md §8.2, Y2). Used for
 * "all applications" (no `jobId`) and for one job (`jobId`).
 *
 * Data: GET /api/recruiter/applications[?jobId=] (backend/Controllers/analysis.controller.js).
 * The server ranks the rows (R-27, D§7.1 W4: scored with the assessment over first, then
 * scored applicants awaiting the assessment, then unscored; composite descending inside a
 * group); this table keeps that order and never re-ranks or re-bands. A row with
 * `score_state: 'awaiting_assessment'` leads with "Awaiting assessment" and shows its
 * composite smaller, labelled as a partial score. Actions:
 *   shortlist / reject   POST /api/jobs/applications/shortlist { applicationId, status };
 *                        the row takes the status from the server's answer
 *   score again          POST /api/applications/:id/score; on `scored` the list is reloaded
 *   details              opens the drill-down (CandidateModal)
 *
 * Loading, empty and error are three distinct states. A failed load is an error state,
 * never an empty list (lib/api.js).
 */

/**
 * Loads the applications list. Returns { status: 'loading' | 'error' | 'ready', items,
 * error, reload, setItems }. `jobId` undefined = all of the recruiter's jobs.
 */
export function useApplications(jobId) {
  const [state, setState] = useState({ status: 'loading', items: [], error: null });
  const controllerRef = useRef(null);

  const reload = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const path = jobId
        ? `/api/recruiter/applications?jobId=${encodeURIComponent(jobId)}`
        : '/api/recruiter/applications';
      const data = await api.get(path, { signal: controller.signal, cache: 'no-store' });
      if (!Array.isArray(data)) {
        setState({ status: 'error', items: [], error: { message: 'The server sent an applications list that could not be read.' } });
        return;
      }
      setState({ status: 'ready', items: data, error: null });
    } catch (err) {
      if (isAborted(err)) return;
      setState({ status: 'error', items: [], error: err });
    }
  }, [jobId]);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  const setItems = useCallback((update) => {
    setState((s) => ({ ...s, items: typeof update === 'function' ? update(s.items) : update }));
  }, []);

  return { ...state, reload, setItems };
}

export function StatusBadge({ status, testId = 'status-badge' }) {
  const text = statusText(status);
  return (
    <Badge variant={text.variant} data-testid={testId || undefined} data-status={status || ''}>
      {text.label}
    </Badge>
  );
}

export function ApplicationsError({ error, onRetry }) {
  return (
    <div className="card" data-testid="applications-error" role="alert">
      <EmptyState
        icon={AlertTriangle}
        title="Could not load applications"
        description={`${error?.message || 'The request failed.'} This is an error, not an empty list.`}
        action={onRetry ? <Button variant="outline" onClick={onRetry}>Try again</Button> : null}
      />
    </div>
  );
}

export function ScoreCell({ item, onScored }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [still, setStill] = useState(false); // R-33: reading the state after a lost answer

  if (item.score && item.score_state === AWAITING_ASSESSMENT) {
    // D§7.1 W4: the state first; the partial number smaller, labelled, and with no band
    // (a bare low score is never shown for an applicant who has not been assessed).
    // The composite stays the first <span> in this cell (tests/e2e reads it there).
    return (
      <div data-testid="application-score" data-state="scored" data-score-state={AWAITING_ASSESSMENT}>
        <div className="text-body-sm font-semibold text-foreground" data-testid="awaiting-assessment">Awaiting assessment</div>
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-body-sm font-medium text-muted-foreground tabular-nums">{String(item.score.composite)}</span>
          <em className="not-italic text-caption text-muted-foreground" data-testid="partial-score-label">
            {partialScoreLabel(item.score.subscores)}
          </em>
        </div>
        <VerificationBadge verification={item.score.verification} className="mt-1" />
      </div>
    );
  }

  if (item.score) {
    return (
      <div data-testid="application-score" data-state="scored" data-score-state={item.score_state || ''}>
        <div className="flex items-center gap-2">
          <span className="text-h3 font-extrabold text-foreground tabular-nums">{String(item.score.composite)}</span>
          <ScoreBadge band={item.score.band} />
          <VerificationBadge verification={item.score.verification} />
        </div>
        {showEvidenceLimited(item.score.evidence_limited, item.score.verification) && (
          <Badge variant="warning" className="mt-1" title="Scored on fewer than all three evidence sources">
            Evidence-limited
          </Badge>
        )}
      </div>
    );
  }

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await api.post(`/api/applications/${item.id}/score`);
      if (data?.scoring?.status === 'scored') {
        setMessage(null);
        onScored?.();
      } else {
        setMessage(scoringFailureText(data?.scoring?.reason));
      }
    } catch (err) {
      if (!isStillWorking(err)) {
        setMessage(`Could not start scoring: ${err.message}`);
      } else {
        // R-33: a 504 or a dropped connection is not a failure; the score may still be saved.
        // Read this application back (bounded) and show what the server holds.
        setStill(true);
        const out = await pollServerState(
          (signal) => api.get(`/api/recruiter/applications/${encodeURIComponent(item.id)}`, { signal, cache: 'no-store' }),
          (detail) => Boolean(detail?.score),
        ).catch(() => null);
        setStill(false);
        if (out?.settled) onScored?.();
        else if (out?.hasValue) setMessage(`The server did not answer in time and shows no score after ${stillWorkingSeconds()} s of checking. It may still be finishing: reload later.`);
        else setMessage(`The server did not answer in time and the current state could not be read: ${out?.error?.message || 'no answer'}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="application-score" data-state="pending">
      <div className="text-body-sm font-medium text-foreground">Not scored yet</div>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        data-testid="score-again-button"
        className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-caption font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
        {busy ? 'Scoring...' : 'Score again'}
      </button>
      {still && (
        <p className="mt-1 text-caption text-muted-foreground max-w-[16rem]" role="status" data-testid="still-working">
          Still working: the server has not answered yet but may still be scoring. Checking every few seconds.
        </p>
      )}
      {message && <p className="mt-1 text-caption text-destructive max-w-[16rem]">{message}</p>}
    </div>
  );
}

function AssessmentCell({ assessment, currentUserId }) {
  const text = assessmentStateText(assessment);
  const voided = Array.isArray(assessment?.voided) ? assessment.voided : [];
  const last = voided.length ? describeVoid(voided[voided.length - 1], currentUserId) : null;
  return (
    <div data-testid="assessment-state" data-state={assessment?.state || ''}>
      <div className="text-body-sm text-foreground" title={text.hint || undefined}>{text.label}</div>
      {assessment?.attempts && (
        <div className="text-caption text-muted-foreground tabular-nums">
          Attempts used {assessment.attempts.used} of {assessment.attempts.max}
        </div>
      )}
      {last && (
        <p className="text-caption text-warning-text mt-1 max-w-[16rem]" data-testid="row-reset-record">
          {voided.length === 1 ? 'An attempt was reset' : `${voided.length} attempts were reset`}; last by {last.who}
          {last.at ? ` on ${formatWhen(last.at)}` : ''}: {last.reason}
        </p>
      )}
    </div>
  );
}

function DecisionButtons({ item, onStatus }) {
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  const decide = async (status) => {
    if (busy) return;
    setBusy(status);
    setMessage(null);
    try {
      const data = await api.post('/api/jobs/applications/shortlist', { applicationId: item.id, status });
      if (!data || typeof data.status !== 'string') {
        setMessage({ tone: 'error', text: 'The server answered without a status; reload to see the current state.' });
        return;
      }
      onStatus(item.id, data.status);
      setMessage(data.notified
        ? { tone: 'ok', text: 'Saved. The candidate was notified.' }
        : { tone: 'warn', text: 'Saved, but the candidate notification could not be sent.' });
    } catch (err) {
      setMessage({ tone: 'error', text: `Not saved: ${err.message}` });
    } finally {
      setBusy(null);
    }
  };

  const toneClass = { ok: 'text-success', warn: 'text-warning-text', error: 'text-destructive' };

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => decide('shortlisted')}
          loading={busy === 'shortlisted'}
          disabled={Boolean(busy) || item.status === 'shortlisted'}
          data-testid="shortlist-button"
        >
          Shortlist
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => decide('rejected')}
          loading={busy === 'rejected'}
          disabled={Boolean(busy) || item.status === 'rejected'}
          data-testid="reject-button"
        >
          Reject
        </Button>
      </div>
      {message && <p className={`text-caption ${toneClass[message.tone]} max-w-[14rem]`}>{message.text}</p>}
    </div>
  );
}

function ApplicationRow({ item, rank, showJob, currentUserId, onOpen, onStatus, onScored }) {
  return (
    <tr
      className="border-b border-border last:border-0 align-top"
      data-testid={`application-row-${item.id}`}
      data-status={item.status || ''}
      data-scoring={item.scoring?.state || ''}
    >
      <td className="py-3 pl-4 pr-3 text-body-sm text-muted-foreground tabular-nums">{rank ? `#${rank}` : '—'}</td>
      <td className="py-3 pr-3 min-w-[12rem]">
        {item.candidate?.name ? (
          <div className="font-medium text-foreground">{item.candidate.name}</div>
        ) : (
          <div className="text-body-sm italic text-muted-foreground">No name on the candidate's profile</div>
        )}
        {item.candidate?.email ? (
          <a href={`mailto:${item.candidate.email}`} className="text-caption text-muted-foreground hover:text-foreground no-underline">
            {item.candidate.email}
          </a>
        ) : (
          <div className="text-caption italic text-muted-foreground">No email on the account</div>
        )}
        {item.applied_at && (
          <div className="text-caption text-muted-foreground">Applied {formatWhen(item.applied_at)}</div>
        )}
      </td>
      {showJob && (
        <td className="py-3 pr-3 text-body-sm text-foreground min-w-[8rem]">
          {item.job?.title || <span className="italic text-muted-foreground">Untitled job</span>}
        </td>
      )}
      <td className="py-3 pr-3 min-w-[9rem]"><ScoreCell item={item} onScored={onScored} /></td>
      <td className="py-3 pr-3 min-w-[10rem]"><AssessmentCell assessment={item.assessment} currentUserId={currentUserId} /></td>
      <td className="py-3 pr-3"><StatusBadge status={item.status} /></td>
      <td className="py-3 pr-3"><DecisionButtons item={item} onStatus={onStatus} /></td>
      <td className="py-3">
        <Button size="sm" variant="ghost" onClick={() => onOpen(item.id)} data-testid="open-drilldown">
          Details
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Button>
      </td>
    </tr>
  );
}

/**
 * `data`: the value of useApplications(). `showJob`: show the job column (all-applications
 * view). `emptyText`: the sentence for a list that loaded and is empty.
 */
function ApplicationsTable({ data, showJob = true, emptyText }) {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const { status, items, error, reload, setItems } = data;

  const options = useMemo(() => statusFilterOptions(items), [items]);
  const visible = useMemo(() => filterByStatus(items, statusFilter), [items, statusFilter]);
  // Rank = position in the server's ranking among scored rows whose assessment is over.
  // Rows awaiting the assessment (D§7.1 W4) and unscored rows have none: a partial score
  // is never ranked against a full one.
  const rankOf = useMemo(() => {
    const m = new Map();
    let n = 0;
    for (const i of items) if (i.score && i.score_state !== AWAITING_ASSESSMENT) m.set(i.id, (n += 1));
    return m;
  }, [items]);

  const onStatus = useCallback((id, newStatus) => setItems((list) => withStatus(list, id, newStatus)), [setItems]);
  // Stable, so the drill-down's Escape listener is not re-attached on every render.
  const closeDrilldown = useCallback(() => setOpenId(null), []);

  if (status === 'loading' && !items.length) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 gap-3" data-testid="applications-loading">
        <Spinner />
        <p className="text-body-sm text-muted-foreground">Loading applications...</p>
      </div>
    );
  }
  if (status === 'error') return <ApplicationsError error={error} onRetry={reload} />;
  if (!items.length) {
    return (
      <div className="card" data-testid="applications-empty">
        <EmptyState
          icon={Users}
          title="No applications yet"
          description={emptyText || 'No candidate has applied to your jobs yet.'}
        />
      </div>
    );
  }

  return (
    <>
    <div className="card p-0 overflow-hidden" data-testid="applications-table">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-caption text-muted-foreground">Status</label>
          <select
            id="status-filter"
            data-testid="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-input rounded-md px-3 py-1.5 text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label} ({o.count})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-caption text-muted-foreground">
            Showing {visible.length} of {items.length}. Ranked by credibility score; applicants awaiting the assessment next, as their own group; unscored last.
          </span>
          <Button size="sm" variant="outline" onClick={reload} loading={status === 'loading'}>
            Refresh
          </Button>
        </div>
      </div>

      {visible.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="py-2 pl-4 pr-3 text-caption font-medium text-muted-foreground">Rank</th>
                <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Candidate</th>
                {showJob && <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Job</th>}
                <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Credibility score</th>
                <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Assessment</th>
                <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Status</th>
                <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Decision</th>
                <th className="py-2 text-caption font-medium text-muted-foreground"><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <ApplicationRow
                  key={item.id}
                  item={item}
                  rank={rankOf.get(item.id)}
                  showJob={showJob}
                  currentUserId={user?.id || null}
                  onOpen={setOpenId}
                  onStatus={onStatus}
                  onScored={reload}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-6 text-body-sm text-muted-foreground" data-testid="applications-filter-empty">
          No application has the status "{statusText(statusFilter).label}".
        </p>
      )}
    </div>

    <AnimatePresence>
      {openId && (
        <CandidateModal
          applicationId={openId}
          onClose={closeDrilldown}
          onChanged={reload}
          currentUserId={user?.id || null}
        />
      )}
    </AnimatePresence>
    </>
  );
}

export default ApplicationsTable;
