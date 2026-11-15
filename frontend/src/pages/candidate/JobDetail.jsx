import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, MapPin, Layers, Sparkles, CheckCircle, Loader2, FileUp, AlertCircle, ListChecks, ArrowRight,
} from 'lucide-react';
import ScoreBadge, { VerificationBadge } from '../../components/ScoreBadge';
import {
  api, isAborted, isStillWorking, pollServerState, STILL_WORKING_POLL_MS, stillWorkingSeconds,
} from '../../lib/api';
import { ScoreAgainButton, StatusBadge, scoringReasonText } from './applicationState';

// R-16 (D§4.1, Y1). Endpoints:
//   GET  /api/jobs/:id                 the job (+ `applied`)
//   GET  /api/resume/status            whether a resume is on file
//   GET  /api/jobs/my-applications     this candidate's application for the job: id, status,
//                                      scoring.state 'scored' | 'pending' (no stored reason),
//                                      score { composite, band } | null (newest score row)
//   POST /api/jobs/:id/apply           201 { ...application, scoring: { status, reason } };
//                                      the application counts even when scoring failed
//   POST /api/applications/:id/score   "Score again": { applicationId, scoring: { status, reason } }
// R-33: a repeated apply answers 200 { ...existing application, already_applied: true,
// scoring: { state }, score }. A gateway timeout (504) or a dropped connection on apply is
// "Still working": the page reads GET /api/jobs/my-applications every few seconds (lib/api.js
// pollServerState, bounded) until this job's row is scored, then shows the row the server holds.

/**
 * The scoring state of this application. `scoring` is either the object an apply or
 * score-again response carried ({ status: 'scored' | 'failed', reason }) or the list
 * row's ({ state: 'scored' | 'pending' }); only the former can have a reason.
 */
function ScoringState({ application, scoring, onScoring, retryError, onRetryError }) {
  const scored = scoring?.status === 'scored' || scoring?.state === 'scored';
  const reason = scoring?.status === 'failed' ? scoringReasonText(scoring.reason) : null;

  if (scored) {
    return (
      <div
        className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4"
        data-testid="application-score"
        data-state="scored"
      >
        <CheckCircle className="h-5 w-5 flex-shrink-0 text-success" />
        <p className="text-sm font-medium text-foreground">Scored.</p>
        {application.score && application.score.composite !== null && application.score.composite !== undefined && (
          <span className="inline-flex items-center gap-2">
            <span className="text-base font-bold tabular-nums text-foreground" data-testid="application-composite">
              {String(application.score.composite)}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
            <ScoreBadge band={application.score.band} />
            <VerificationBadge verification={application.score.verification} />
          </span>
        )}
        <Link
          to={`/candidate/results/${application.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-2"
        >
          See the result
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-4"
      data-testid="application-score"
      data-state={scoring?.status === 'failed' ? 'failed' : 'pending'}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Not scored yet.</p>
          {reason && <p className="mt-1 text-sm text-muted-foreground">{reason}</p>}
          <p className="mt-1 text-sm text-muted-foreground">
            Your application is submitted either way. You can try scoring it again.
          </p>
        </div>
        <ScoreAgainButton
          applicationId={application.id}
          onResult={(next) => {
            onRetryError('');
            onScoring(next);
          }}
          onError={(err) => onRetryError(err.message)}
        />
      </div>
      {retryError && <p className="mt-2 text-sm text-destructive">Score again failed: {retryError}</p>}
    </div>
  );
}

function CandidateJobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [hasResume, setHasResume] = useState(null);
  const [resumeError, setResumeError] = useState('');

  // This candidate's application for the job (from the list or the apply response).
  const [application, setApplication] = useState(null);
  const [scoring, setScoring] = useState(null);
  const [applicationsError, setApplicationsError] = useState('');

  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [justApplied, setJustApplied] = useState(false);
  const [retryError, setRetryError] = useState('');
  // R-33: reading the real state after an apply whose answer did not arrive.
  const [stillWorking, setStillWorking] = useState(false);
  const [stillNote, setStillNote] = useState('');
  const applyCtrlRef = useRef(null);
  useEffect(() => () => applyCtrlRef.current?.abort(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get(`/api/jobs/${id}`)
      .then((data) => { if (!cancelled) setJob(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/resume/status')
      .then((data) => { if (!cancelled) setHasResume(Boolean(data?.hasResume)); })
      .catch((err) => { if (!cancelled) setResumeError(err.message); });
    return () => { cancelled = true; };
  }, []);

  const loadApplication = useCallback(async (signal) => {
    try {
      const rows = await api.get('/api/jobs/my-applications', { signal });
      const row = Array.isArray(rows) ? rows.find((r) => r.job_id === id) : null;
      setApplicationsError('');
      if (row) {
        setApplication(row);
        setScoring(row.scoring || null);
      }
    } catch (err) {
      if (err.error !== 'aborted') setApplicationsError(err.message);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    loadApplication(controller.signal);
    return () => controller.abort();
  }, [loadApplication]);

  const applied = Boolean(application) || job?.applied === true;

  // R-33: the apply's answer was lost (504 or a dropped connection), but core may still be
  // saving and scoring it. Read this candidate's applications until this job's row is
  // scored, for a bounded time, then show the row as the server holds it (or say there is
  // none). Nothing is assumed: every state shown comes from a read.
  const readBackApplication = async () => {
    applyCtrlRef.current?.abort();
    const ctrl = new AbortController();
    applyCtrlRef.current = ctrl;
    setStillWorking(true);
    const rowOf = (rows) => (Array.isArray(rows) ? rows.find((r) => r.job_id === id) : null) || null;
    try {
      const out = await pollServerState(
        (signal) => api.get('/api/jobs/my-applications', { signal, cache: 'no-store' }),
        (rows) => rowOf(rows)?.scoring?.state === 'scored',
        { signal: ctrl.signal },
      );
      const row = out.hasValue ? rowOf(out.value) : null;
      if (row) {
        setApplication(row);
        setScoring(row.scoring || null);
        setJustApplied(true);
        setApplicationsError('');
      }
      if (out.settled) return;
      if (row) {
        setStillNote(`The server holds your application, but no score after ${stillWorkingSeconds()} s of checking. Scoring may still be finishing: reload this page later, or use Score again.`);
      } else if (out.hasValue) {
        setStillNote(`The server holds no application for this job after ${stillWorkingSeconds()} s of checking. You can apply again; applying twice never creates a second application.`);
      } else {
        setStillNote(`The server did not answer in time, and your applications could not be read (${out.error?.message || 'no answer'}). Reload this page before applying again; applying twice never creates a second application.`);
      }
    } catch (err) {
      if (!isAborted(err)) setStillNote(`Your applications could not be read: ${err.message}`);
    } finally {
      if (!ctrl.signal.aborted) setStillWorking(false);
    }
  };

  const handleApply = async () => {
    if (applying || applied || stillWorking) return;
    setApplying(true);
    setApplyError('');
    setStillNote('');
    let lost = false;
    try {
      const data = await api.post(`/api/jobs/${id}/apply`, {});
      setApplication(data);
      setScoring(data?.scoring || null);
      setJustApplied(data?.already_applied ? 'already' : true);
      // Scored: read the row back for its composite and band. A failed scoring keeps
      // the apply response's reason (the list does not store one). A repeated apply
      // (200, already_applied) carries the list's `scoring.state`.
      if (data?.scoring?.status === 'scored' || data?.scoring?.state === 'scored') await loadApplication();
    } catch (err) {
      if (isStillWorking(err)) {
        lost = true;
      } else if (err.status === 409) {
        // Already applied (answer of a core older than R-33): read the existing application.
        await loadApplication();
      } else if (err.status === 400 && err.body?.code === 'RESUME_REQUIRED') {
        setHasResume(false);
        setApplyError(err.message);
      } else {
        setApplyError(err.message);
      }
    } finally {
      setApplying(false);
    }
    if (lost) await readBackApplication();
  };

  // Lines that start with "#" are headings (hashes stripped, shown bold).
  const renderJobDescription = (description) => {
    const lines = String(description || '').split('\n');
    return lines.map((line, index) => {
      const heading = line.match(/^(#{1,6})\s*(.*)$/);
      if (heading) {
        const title = heading[2].replace(/\*\*/g, '').trim();
        return (
          <h3 key={index} className={`text-h3 text-foreground ${index === 0 ? '' : 'mt-6'}`}>
            {title}
          </h3>
        );
      }
      if (line.trim() === '') return <div key={index} className="h-4" aria-hidden="true" />;
      return <div key={index} className="whitespace-pre-wrap">{line}</div>;
    });
  };

  const requiredSkills = job?.requiredSkills || [];
  const preferredSkills = job?.preferredSkills || [];

  return (
    <div>
      <Link
        to="/candidate/jobs"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground no-underline transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all jobs
      </Link>

      {loading && <p className="text-muted-foreground">Loading job details...</p>}

      {!loading && error && (
        <div className="card p-8 text-center" role="alert">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h2 className="text-h3 text-foreground">Could not load this job</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!loading && job && (
        <div className="space-y-5">
          <div className="card p-6 md:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Briefcase className="h-5 w-5" />
              </div>
              <h1 className="text-h1 text-foreground">{job.title}</h1>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {job.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {job.location}
                </span>
              )}
              {job.experienceLevel && (
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  {job.experienceLevel}
                </span>
              )}
            </div>

            {requiredSkills.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required skills</p>
                <div className="flex flex-wrap gap-2">
                  {requiredSkills.map((skill) => (
                    <span key={skill} className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {preferredSkills.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nice to have</p>
                <div className="flex flex-wrap gap-2">
                  {preferredSkills.map((skill) => (
                    <span key={skill} className="rounded-full border border-border px-3 py-1 text-sm font-medium text-foreground">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!applied && hasResume === false && (
              <div className="mt-6 flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <FileUp className="h-5 w-5 flex-shrink-0 text-warning" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Upload your resume first</p>
                    <p className="text-sm text-muted-foreground">
                      You need a resume on your profile before you can apply. It is used for every job.
                    </p>
                  </div>
                </div>
                <Link
                  to="/candidate/upload"
                  className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline transition hover:bg-primary-hover active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus"
                >
                  <FileUp className="h-4 w-4" />
                  Upload resume
                </Link>
              </div>
            )}
            {resumeError && (
              <p className="mt-4 text-sm text-destructive">Could not check your resume: {resumeError}</p>
            )}
            {applicationsError && (
              <p className="mt-4 text-sm text-destructive">
                Could not check your applications: {applicationsError}
              </p>
            )}

            {/* Apply */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || stillWorking || applied || hasResume === false}
                data-testid="apply-button"
                className={`inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-all ${
                  applied
                    ? 'cursor-not-allowed border border-border bg-muted text-muted-foreground'
                    : 'cursor-pointer bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying and scoring...
                  </>
                ) : stillWorking && !applied ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Still working...
                  </>
                ) : applied ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Applied
                  </>
                ) : (
                  <>
                    <Briefcase className="h-4 w-4" />
                    Apply
                  </>
                )}
              </button>
              {application?.status && <StatusBadge status={application.status} />}
              {justApplied && (
                <span className="text-sm font-medium text-success">
                  {justApplied === 'already' ? 'You had already applied to this job.' : 'Application submitted.'}
                </span>
              )}
              {applyError && <span className="text-sm font-medium text-destructive">{applyError}</span>}
            </div>
            {stillWorking && (
              <p className="mt-3 text-sm text-muted-foreground" role="status" data-testid="still-working">
                Still working: the server has not answered yet, but it may still be saving and scoring your
                application. This page checks with the server every {Math.round(STILL_WORKING_POLL_MS / 1000)} s
                for up to {stillWorkingSeconds()} s.
              </p>
            )}
            {!stillWorking && stillNote && (
              <p className="mt-3 text-sm text-muted-foreground" role="status" data-testid="still-working-note">{stillNote}</p>
            )}

            {application && (
              <ScoringState
                application={application}
                scoring={scoring}
                onScoring={(next) => {
                  setScoring(next);
                  if (next?.status === 'scored') loadApplication();
                }}
                retryError={retryError}
                onRetryError={setRetryError}
              />
            )}

            {applied && !application && !applicationsError && (
              <p className="mt-4 text-sm text-muted-foreground">You have applied to this job.</p>
            )}

            {applied && (
              <Link
                to={`/candidate/assessment?jobId=${encodeURIComponent(id)}`}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground no-underline transition hover:bg-muted"
              >
                <ListChecks className="h-4 w-4" />
                Go to the assessment for this job
              </Link>
            )}
          </div>

          <div className="card p-6 md:p-8">
            <div className="mb-4 flex items-center gap-2.5">
              <Layers className="h-5 w-5 text-foreground" />
              <h2 className="text-h3 text-foreground">Full job description</h2>
            </div>
            <div className="text-body leading-7 text-foreground">{renderJobDescription(job.description)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidateJobDetail;
