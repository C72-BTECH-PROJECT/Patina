import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, MapPin, Layers, Sparkles, CheckCircle, Loader2, FileUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function CandidateJobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadJob = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/jobs/${id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not load this job.');
        setJob(data);
        // If the candidate already applied, reflect it immediately on load.
        if (data.applied) setApplied(true);
      } catch (loadError) {
        setError(loadError.message || 'Could not load this job.');
      } finally {
        setLoading(false);
      }
    };

    loadJob();
  }, [id]);

  const requiredSkills = job?.requiredSkills || [];
  const preferredSkills = job?.preferredSkills || [];

  const { authFetch } = useAuth();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [hasResume, setHasResume] = useState(null);
  const [resumeCheckDone, setResumeCheckDone] = useState(false);

  // Check whether the candidate has uploaded a resume (in Supabase Storage).
  // Apply is only possible once a resume exists — uploaded once, reused for all jobs.
  useEffect(() => {
    let cancelled = false;
    const checkResume = async () => {
      try {
        const response = await authFetch(`${API_BASE_URL}/api/resume/status`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setHasResume(Boolean(data.hasResume));
      } catch {
        // Swallow — apply endpoint enforces the rule anyway if check fails.
      } finally {
        if (!cancelled) setResumeCheckDone(true);
      }
    };
    checkResume();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const handleApply = async () => {
    if (applying || applied) return;
    setApplying(true);
    setApplyMessage('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/jobs/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (response.status === 409) {
        // Already applied for this job — show it as applied.
        setApplied(true);
        setApplyMessage(data.message || 'You have already applied for this job.');
        return;
      }
      if (response.status === 400 && data.code === 'RESUME_REQUIRED') {
        // Backend confirms no resume exists.
        setHasResume(false);
        setApplyMessage(data.message || 'Please upload your resume first.');
        return;
      }
      if (!response.ok) throw new Error(data.message || 'Could not submit application.');
      setApplied(true);
      setApplyMessage('Application submitted successfully!');
    } catch (applyError) {
      setApplyMessage(applyError.message || 'Could not submit application.');
    } finally {
      setApplying(false);
    }
  };

  // Render the description: lines that start with "#" are headings (hashes are
  // stripped and the text is shown bold). Everything else is kept as-is.
  const renderJobDescription = (description) => {
    const lines = String(description || '').split('\n');

    return lines.map((line, index) => {
      const heading = line.match(/^(#{1,6})\s*(.*)$/);
      if (heading) {
        const title = heading[2].replace(/\*\*/g, '').trim();
        return (
          <h3
            key={index}
            className={`text-base font-bold text-foreground ${index === 0 ? '' : 'mt-6'}`}
          >
            {title}
          </h3>
        );
      }

      if (line.trim() === '') {
        return <div key={index} className="h-4" aria-hidden="true" />;
      }

      return (
        <div key={index} className="whitespace-pre-wrap">
          {line}
        </div>
      );
    });
  };

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

      {error && <p className="text-destructive">{error}</p>}

      {!loading && !error && !job && (
        <div className="card p-8 text-center">
          <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Job not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This job may have been removed or is no longer published.
          </p>
        </div>
      )}

      {job && (
        <div className="space-y-5">
          {/* Header */}
          <div className="card p-6 md:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Briefcase className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold leading-tight text-foreground md:text-3xl">
                {job.title}
              </h1>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {job.location}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                {job.experienceLevel}
              </span>
            </div>

            {requiredSkills.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Required Skills
                </p>
                <div className="flex flex-wrap gap-2">
                  {requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {preferredSkills.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Nice to Have
                </p>
                <div className="flex flex-wrap gap-2">
                  {preferredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-border px-3 py-1 text-sm font-medium text-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
{/* Resume required alert */}
            {resumeCheckDone && hasResume === false && (
              <div className="mt-6 flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <FileUp className="h-5 w-5 flex-shrink-0 text-warning" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Upload your resume first</p>
                    <p className="text-sm text-muted-foreground">
                      You need a resume on your profile before you can apply. Upload one — it only
                      takes a minute and applies to every job.
                    </p>
                  </div>
                </div>
                <Link
                  to="/candidate/upload"
                  className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline transition hover:bg-primary/90"
                >
                  <FileUp className="h-4 w-4" />
                  Upload Resume
                </Link>
              </div>
            )}

            {/* Apply */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || applied || (resumeCheckDone && hasResume === false)}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-all ${
                  applied
                    ? 'cursor-not-allowed border border-border bg-muted text-muted-foreground'
                    : 'cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying...
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
              {applyMessage && (
                <span
                  className={`text-sm font-medium ${applied ? 'text-success' : 'text-destructive'}`}
                >
                  {applyMessage}
                </span>
              )}
            </div>
          </div>

          {/* Full Job Description */}
          <div className="card p-6 md:p-8">
            <div className="mb-4 flex items-center gap-2.5">
              <Layers className="h-5 w-5 text-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Full Job Description</h2>
            </div>
            <div className="text-body leading-7 text-foreground">
              {renderJobDescription(job.description)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidateJobDetail;