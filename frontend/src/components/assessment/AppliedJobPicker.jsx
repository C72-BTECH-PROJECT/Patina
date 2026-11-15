import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ListChecks } from 'lucide-react';
import EmptyState from '../EmptyState';
import { api, isAborted } from '../../lib/api';

/**
 * R-17: shown at /candidate/assessment with no ?jobId=. The assessment is offered
 * only for jobs the candidate applied to, so this lists their applications
 * (GET /api/jobs/my-applications) with titles from the published job list
 * (GET /api/jobs), each linking to /candidate/assessment?jobId=<id>.
 */
function AppliedJobPicker() {
  const [phase, setPhase] = useState('loading'); // loading | error | ready
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [titlesError, setTitlesError] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      let apps;
      try {
        apps = await api.get('/api/jobs/my-applications', { signal: ctrl.signal });
      } catch (err) {
        if (isAborted(err)) return;
        setError(err.message);
        setPhase('error');
        return;
      }
      let titles = {};
      try {
        const jobs = await api.get('/api/jobs', { signal: ctrl.signal });
        titles = Object.fromEntries((Array.isArray(jobs) ? jobs : []).map((j) => [j.id, j.title]));
      } catch (err) {
        if (isAborted(err)) return;
        setTitlesError(err.message);
      }
      setRows((Array.isArray(apps) ? apps : []).map((a) => ({ jobId: a.job_id, title: titles[a.job_id] || null, status: a.status })));
      setPhase('ready');
    })();
    return () => ctrl.abort();
  }, []);

  return (
    <div className="max-w-3xl mx-auto" data-testid="assessment-state" data-state={phase === 'ready' ? 'choose_job' : phase === 'error' ? 'error' : 'loading'}>
      <h1 className="text-h1 text-foreground">Skill assessment</h1>
      <p className="text-body-sm text-muted-foreground mt-1 mb-6">
        The assessment is offered for jobs you have applied to. Choose one.
      </p>

      {phase === 'loading' && <p className="text-body-sm text-muted-foreground">Loading your applications...</p>}

      {phase === 'error' && (
        <EmptyState icon={AlertCircle} title="Could not load your applications" description={error} />
      )}

      {phase === 'ready' && rows.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title="No applications yet"
          description="Apply to a job first; its assessment is offered after you apply."
          action={<Link to="/candidate/jobs" className="btn btn-primary no-underline">Browse jobs</Link>}
        />
      )}

      {phase === 'ready' && rows.length > 0 && (
        <>
          {titlesError && (
            <p className="text-caption text-destructive mb-3">Job titles could not be loaded: {titlesError}</p>
          )}
          <div className="space-y-3">
            {rows.map((r) => (
              <Link
                key={r.jobId}
                to={`/candidate/assessment?jobId=${encodeURIComponent(r.jobId)}`}
                className="card p-4 block no-underline hover:border-primary transition-colors"
              >
                <div className="font-medium text-foreground">{r.title || 'Job title not available'}</div>
                <div className="text-caption text-muted-foreground">Application status: {r.status || 'unknown'}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default AppliedJobPicker;
