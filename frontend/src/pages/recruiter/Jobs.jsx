import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { api, isAborted } from '../../lib/api';

// R-15: each card shows the real `applicationCount` from GET /api/jobs/mine
// (jobs.controller.js getMyJobs). The old hardcoded `count={0}` and the "N New"
// badge are gone. The old dark-theme white text is replaced by theme tokens.

const applicationsLabel = (count) => `${count} ${count === 1 ? 'application' : 'applications'}`;

// Job Card Component
const JobCard = ({ job, index }) => (
  <motion.div
    className="card p-6 relative"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
  >
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xl font-bold text-foreground truncate">{job.title}</h2>
          {job.status && job.status !== 'published' && (
            <span className="px-2.5 py-0.5 rounded-full bg-muted border border-border text-muted-foreground text-xs font-medium capitalize">
              {job.status}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {(job.requiredSkills || []).map((skill) => (
            <span
              key={skill}
              className="px-2.5 py-1 rounded-lg bg-muted border border-border text-foreground text-xs font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-start md:items-end gap-3">
        {typeof job.applicationCount === 'number' && (
          <span className="text-sm text-muted-foreground">{applicationsLabel(job.applicationCount)}</span>
        )}
        <Link
          to={`/recruiter/jobs/${job.id}`}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors no-underline"
        >
          View Applications
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  </motion.div>
);

// Main Jobs Component
function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadJobs = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/jobs/mine', { signal });
      setJobs(Array.isArray(data) ? data : []);
    } catch (loadError) {
      if (isAborted(loadError)) return;
      setError(loadError.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadJobs(controller.signal);
    return () => controller.abort();
  }, [loadJobs]);

  return (
    <div className="relative">
      {/* Header */}
      <motion.div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2 flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-foreground" />
            Posted Jobs
          </h1>
          <p className="text-muted-foreground">Your job listings and the applications each one has received.</p>
        </div>

        <Link
          to="/recruiter/create-job"
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors no-underline"
        >
          <Plus className="w-4 h-4" />
          Create New Job
        </Link>
      </motion.div>

      {loading && <p className="text-muted-foreground">Loading your jobs...</p>}

      {!loading && error && (
        <div role="alert" className="card p-6 border-destructive/30">
          <p className="font-semibold text-destructive">Could not load your jobs.</p>
          <p className="mt-1 text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => loadJobs()}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {jobs.map((job, index) => (
            <JobCard key={job.id} job={job} index={index} />
          ))}
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <motion.div
          className="card p-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No Jobs Yet</h3>
          <p className="text-muted-foreground mb-6">Create your first job listing to start receiving applications.</p>
          <Link
            to="/recruiter/create-job"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors no-underline"
          >
            <Plus className="w-5 h-5" />
            Create Job
          </Link>
        </motion.div>
      )}
    </div>
  );
}

export default Jobs;
