import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, ArrowRight, AlertCircle } from 'lucide-react';
import Badge from '../../components/Badge';
import { api } from '../../lib/api';

// Endpoints: GET /api/jobs (published jobs), GET /api/jobs/my-applications (to mark
// the jobs this candidate has applied to). Loading, empty and error are distinct.
function CandidateJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());
  const [appliedError, setAppliedError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/api/jobs')
      .then((data) => { if (!cancelled) setJobs(Array.isArray(data) ? data : []); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    api.get('/api/jobs/my-applications')
      .then((rows) => { if (!cancelled) setAppliedJobIds(new Set((rows || []).map((r) => r.job_id))); })
      .catch((err) => { if (!cancelled) setAppliedError(err.message); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Open roles</h1>
      {loading && <p className="text-muted-foreground">Loading available jobs...</p>}
      {!loading && error && (
        <div className="card p-8 text-center" role="alert">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Could not load jobs</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      )}
      {!loading && !error && jobs.length === 0 && (
        <div className="card p-8 text-center">
          <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">No jobs are open right now</h2>
          <p className="mt-2 text-sm text-muted-foreground">Check back when recruiters publish new roles.</p>
        </div>
      )}
      {!loading && !error && jobs.length > 0 && (
        <>
          {appliedError && (
            <p className="mb-4 text-sm text-destructive">Could not check which jobs you applied to: {appliedError}</p>
          )}
          <div className="grid gap-4">
            {jobs.map((job) => (
              <div key={job.id} className="card p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Briefcase className="w-5 h-5 text-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">{job.title}</h2>
                  {appliedJobIds.has(job.id) && <Badge variant="success">Applied</Badge>}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {job.location && (
                    <>
                      <MapPin className="w-4 h-4" />
                      <span>{job.location}</span>
                    </>
                  )}
                  {job.location && job.experienceLevel && <span>•</span>}
                  {job.experienceLevel && <span>{job.experienceLevel}</span>}
                </div>
                <div className="mt-4 flex justify-end">
                  <Link
                    to={`/candidate/jobs/${job.id}`}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-underline transition hover:bg-primary/90"
                  >
                    View job
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default CandidateJobs;
