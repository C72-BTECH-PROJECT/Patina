import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, MapPin } from 'lucide-react';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import ApplicationsTable, { useApplications } from '../../components/recruiter/ApplicationsTable';
import { api, isAborted } from '../../lib/api';

/**
 * One job and its applications (card R-18). The job header comes from
 * GET /api/jobs/mine (only this recruiter's jobs, with the real `applicationCount`);
 * the applications come from GET /api/recruiter/applications?jobId= through the
 * shared ApplicationsTable. Each part has its own loading, empty and error state.
 */
function JobHeader({ id }) {
  const [state, setState] = useState({ status: 'loading', job: null, error: null });

  const load = useCallback(async (signal) => {
    setState({ status: 'loading', job: null, error: null });
    try {
      const jobs = await api.get('/api/jobs/mine', { signal, cache: 'no-store' });
      const job = Array.isArray(jobs) ? jobs.find((j) => String(j.id) === String(id)) : null;
      setState({ status: job ? 'ready' : 'missing', job: job || null, error: null });
    } catch (err) {
      if (isAborted(err)) return;
      setState({ status: 'error', job: null, error: err });
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div className="card p-6 flex items-center gap-3">
        <Spinner size="sm" />
        <span className="text-body-sm text-muted-foreground">Loading job...</span>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="card" role="alert" data-testid="job-error">
        <EmptyState
          icon={AlertTriangle}
          title="Could not load this job"
          description={state.error?.message || 'The request failed.'}
          action={<Button variant="outline" onClick={() => load()}>Try again</Button>}
        />
      </div>
    );
  }
  if (state.status === 'missing') {
    return (
      <div className="card">
        <EmptyState
          icon={AlertTriangle}
          title="Job not found"
          description="This job does not exist, or it belongs to a different recruiter account."
          action={<Link to="/recruiter/jobs" className="btn btn-primary no-underline">Back to jobs</Link>}
        />
      </div>
    );
  }

  const { job } = state;
  return (
    <motion.div className="card p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="min-w-0">
          <h1 className="text-h1 font-heading font-semibold text-foreground mb-2">{job.title}</h1>
          <p className="text-body-sm text-muted-foreground max-w-2xl mb-4 line-clamp-3">{job.description}</p>
          <div className="flex flex-wrap gap-2">
            {job.status && <Badge variant="outline">{job.status}</Badge>}
            {job.location && (
              <Badge variant="outline">
                <MapPin className="w-3 h-3 mr-1" aria-hidden="true" />
                Job location: {job.location}
              </Badge>
            )}
            {job.experienceLevel && <Badge variant="outline">{job.experienceLevel}</Badge>}
            {(job.requiredSkills || []).map((skill) => (
              <Badge key={skill} variant="primary">{skill}</Badge>
            ))}
          </div>
        </div>
        {typeof job.applicationCount === 'number' && (
          <div className="text-right flex-shrink-0">
            <div className="text-h1 font-extrabold text-foreground tabular-nums">{job.applicationCount}</div>
            <div className="text-caption text-muted-foreground">
              {job.applicationCount === 1 ? 'application received' : 'applications received'}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function JobDetails() {
  const { id } = useParams();
  const data = useApplications(id);

  return (
    <div className="space-y-6">
      <Link
        to="/recruiter/jobs"
        className="inline-flex items-center gap-2 text-body-sm text-muted-foreground hover:text-foreground transition-colors no-underline"
      >
        ← Back to jobs
      </Link>

      <JobHeader id={id} />

      <div>
        <h2 className="text-body font-semibold text-foreground mb-3">Applications to this job</h2>
        {data.status === 'error' && data.error?.error === 'job_not_found' ? (
          <div className="card" data-testid="applications-error" role="alert">
            <EmptyState
              icon={AlertTriangle}
              title="Job not found"
              description="This job does not exist, or it belongs to a different recruiter account, so its applications cannot be shown."
            />
          </div>
        ) : (
          <ApplicationsTable
            data={data}
            showJob={false}
            emptyText="No candidate has applied to this job yet."
          />
        )}
      </div>
    </div>
  );
}

export default JobDetails;
