import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Briefcase, FileUp, ListChecks } from 'lucide-react';
import ScoreBadge, { VerificationBadge } from '../../components/ScoreBadge';
import { api } from '../../lib/api';
import {
  ScoreAgainButton, StatusBadge, assessmentStateText, scoringReasonText,
} from './applicationState';

// R-16 (D§8.2): "My applications" replaces the static marketing page.
// Endpoints:
//   GET  /api/jobs/my-applications        [{ id, job_id, job_title, status, submitted_at,
//                                           scoring: { state }, score: { composite, band, verification } | null }]
//                                         score = the newest score row for that job
//   GET  /api/assessment/status?jobId=    per row: { state, ... }
//   POST /api/applications/:id/score      "Score again"

const formatDate = (value) => {
  const t = Date.parse(value || '');
  return Number.isFinite(t) ? new Date(t).toLocaleDateString() : null;
};

function ScoreCell({ app, onScored, onFailed }) {
  const [retryError, setRetryError] = useState('');
  const scored = app.scoring?.state === 'scored';

  if (scored) {
    const score = app.score;
    const hasComposite = score && score.composite !== null && score.composite !== undefined;
    return (
      <div data-testid="application-score" data-state="scored" className="flex flex-wrap items-center gap-2">
        {hasComposite ? (
          <>
            <span className="text-lg font-bold tabular-nums text-foreground" data-testid="application-composite">
              {String(score.composite)}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
            <ScoreBadge band={score.band} />
            <VerificationBadge verification={score.verification} />
          </>
        ) : (
          <span className="text-sm font-medium text-foreground">Scored</span>
        )}
      </div>
    );
  }

  return (
    <div data-testid="application-score" data-state={app.scoring?.lastFailure ? 'failed' : 'pending'} className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">Not scored yet</p>
      {app.scoring?.lastFailure && (
        <p className="text-xs text-muted-foreground">{scoringReasonText(app.scoring.lastFailure)}</p>
      )}
      <ScoreAgainButton
        applicationId={app.id}
        onResult={(result) => {
          setRetryError('');
          if (result?.status === 'scored') onScored();
          else onFailed(app.id, result?.reason || null);
        }}
        onError={(err) => setRetryError(err.message)}
      />
      {retryError && <p className="text-xs text-destructive">Score again failed: {retryError}</p>}
    </div>
  );
}

function AssessmentCell({ jobId }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/api/assessment/status?jobId=${encodeURIComponent(jobId)}`, { signal: controller.signal })
      .then((data) => setState({ loading: false, data, error: '' }))
      .catch((err) => {
        if (err.error !== 'aborted') setState({ loading: false, data: null, error: err.message });
      });
    return () => controller.abort();
  }, [jobId]);

  const text = state.data ? assessmentStateText(state.data.state) : null;

  return (
    <div className="space-y-1.5">
      {state.loading && <p className="text-sm text-muted-foreground">Checking...</p>}
      {state.error && <p className="text-sm text-destructive">Could not load: {state.error}</p>}
      {text && (
        <p className="text-sm font-medium text-foreground" data-testid="assessment-state" data-state={state.data.state}>
          {text.label}
        </p>
      )}
      <Link
        to={`/candidate/assessment?jobId=${encodeURIComponent(jobId)}`}
        data-testid="assessment-link"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline underline-offset-2"
      >
        <ListChecks className="h-3.5 w-3.5" />
        Open assessment
      </Link>
    </div>
  );
}

function Dashboard() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'error' | 'ready'
  const [error, setError] = useState('');
  const [apps, setApps] = useState([]);

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const rows = await api.get('/api/jobs/my-applications');
      setApps(Array.isArray(rows) ? rows : []);
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A failed retry keeps the row pending and remembers the reason the server gave.
  const markFailed = (applicationId, reason) => {
    setApps((rows) => rows.map((r) => (r.id === applicationId
      ? { ...r, scoring: { ...r.scoring, lastFailure: reason || 'internal_error' } }
      : r)));
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-foreground">My applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">Each job you applied to, its score and its assessment.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/candidate/upload"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground no-underline transition hover:bg-muted"
          >
            <FileUp className="h-4 w-4" />
            Resume
          </Link>
          <Link
            to="/candidate/jobs"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-underline transition hover:bg-primary-hover active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus"
          >
            <Briefcase className="h-4 w-4" />
            Browse jobs
          </Link>
        </div>
      </div>

      {status === 'loading' && (
        <p className="text-muted-foreground" data-testid="applications-loading">Loading your applications...</p>
      )}

      {status === 'error' && (
        <div className="card p-8 text-center" role="alert" data-testid="applications-error">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h2 className="text-h3 text-foreground">Could not load your applications</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && apps.length === 0 && (
        <div className="card p-8 text-center" data-testid="applications-empty">
          <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="text-h3 text-foreground">You have not applied to any job yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">Upload your resume, then apply to an open role.</p>
        </div>
      )}

      {status === 'ready' && apps.length > 0 && (
        <>
          <div className="space-y-3 anim-stagger">
            {apps.map((app) => {
              const title = app.job_title;
              const appliedOn = formatDate(app.submitted_at);
              return (
                <div key={app.id} className="card p-5" data-testid={`application-row-${app.id}`}>
                  <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-start">
                    <div className="min-w-0">
                      {title ? (
                        <Link to={`/candidate/jobs/${app.job_id}`} className="text-base font-semibold text-foreground no-underline hover:underline">
                          {title}
                        </Link>
                      ) : (
                        <p className="text-base font-semibold text-muted-foreground">Untitled job</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge status={app.status} />
                        {appliedOn && <span className="text-xs text-muted-foreground">Applied {appliedOn}</span>}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Score</p>
                      <ScoreCell
                        app={app}
                        onScored={load}
                        onFailed={markFailed}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assessment</p>
                      <AssessmentCell jobId={app.job_id} />
                    </div>
                    <div className="md:text-right">
                      <Link
                        to={`/candidate/results/${app.id}`}
                        data-testid="application-result-link"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground no-underline transition hover:bg-muted"
                      >
                        Result
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
