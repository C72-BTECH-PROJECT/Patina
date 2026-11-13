import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, CheckCircle2, ClipboardCheck, Clock, Plus, ShieldAlert, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import { ApplicationsError, useApplications } from '../../components/recruiter/ApplicationsTable';
import { countsByJob, dashboardCounts } from '../../components/recruiter/applicationsLogic';

/**
 * Recruiter dashboard (card R-18). Every count here is computed from ONE response,
 * GET /api/recruiter/applications (all of this recruiter's jobs), the same list the
 * applications table shows; each label says what is counted. Loading, empty and error
 * are distinct: with the backend down the page says it could not load, never "0".
 */

const StatCard = ({ icon: Icon, label, value, hint, testId }) => (
  <div className="card p-5" data-testid={testId}>
    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center mb-3">
      <Icon className="w-4 h-4 text-foreground" aria-hidden="true" />
    </div>
    <div className="text-h2 font-extrabold text-foreground tabular-nums mb-1" data-testid={testId ? `${testId}-value` : undefined}>
      {value}
    </div>
    <div className="text-body-sm text-foreground">{label}</div>
    {hint && <div className="text-caption text-muted-foreground mt-1">{hint}</div>}
  </div>
);

function RecruiterDashboard() {
  const { user } = useAuth();
  const data = useApplications();
  const counts = useMemo(() => dashboardCounts(data.items), [data.items]);
  const perJob = useMemo(() => countsByJob(data.items), [data.items]);

  const header = (
    <motion.div
      className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div>
        <h1 className="text-h1 font-heading font-semibold text-foreground mb-2">Recruiter Dashboard</h1>
        <p className="text-body-sm text-muted-foreground">
          {user?.firstName ? (
            <>Welcome back, <span className="text-foreground font-medium">{user.firstName}</span>. </>
          ) : null}
          Applications to your jobs, ranked by a credibility score you can audit factor by factor.
        </p>
      </div>
      <Link
        to="/recruiter/create-job"
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-body-sm font-medium hover:bg-primary/90 transition-colors no-underline"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        Create new job
      </Link>
    </motion.div>
  );

  if (data.status === 'loading' && !data.items.length) {
    return (
      <div className="space-y-8">
        {header}
        <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="applications-loading">
          <Spinner size="lg" />
          <p className="text-body-sm text-muted-foreground">Loading applications...</p>
        </div>
      </div>
    );
  }

  if (data.status === 'error') {
    return (
      <div className="space-y-8">
        {header}
        <ApplicationsError error={data.error} onRetry={data.reload} />
      </div>
    );
  }

  if (!data.items.length) {
    return (
      <div className="space-y-8">
        {header}
        <div className="card" data-testid="applications-empty">
          <EmptyState
            icon={Users}
            title="No applications yet"
            description="No candidate has applied to any of your jobs yet. Applications appear here, with their scores, as soon as candidates apply."
            action={<Link to="/recruiter/jobs" className="btn btn-primary no-underline">Your jobs</Link>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Applications to your jobs"
          value={counts.total}
          hint={`${perJob.length} ${perJob.length === 1 ? 'job has' : 'jobs have'} at least one application`}
          testId="count-applications"
        />
        <StatCard
          icon={CheckCircle2}
          label="Applications with a score"
          value={counts.scored}
          hint={`${counts.notScored} not scored yet`}
          testId="count-scored"
        />
        <StatCard
          icon={ShieldAlert}
          label="Scores that are evidence-limited"
          value={counts.evidenceLimited}
          hint="Scored on fewer than all three evidence sources"
          testId="count-evidence-limited"
        />
        <StatCard
          icon={Clock}
          label="Awaiting your decision"
          value={counts.submitted}
          hint="Status still 'submitted'"
          testId="count-submitted"
        />
        <StatCard
          icon={Briefcase}
          label="Shortlisted"
          value={counts.shortlisted}
          hint={`${counts.rejected} rejected`}
          testId="count-shortlisted"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Assessments completed"
          value={counts.assessmentsCompleted}
          hint={counts.withReset ? `${counts.withReset} with a reset attempt on record` : 'Graded attempts that count toward the score'}
          testId="count-assessments-completed"
        />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-body font-semibold text-foreground">Applications by job</h2>
          <Link to="/recruiter/applications" className="text-body-sm text-foreground no-underline hover:underline">
            Review all applications →
          </Link>
        </div>
        <p className="text-caption text-muted-foreground mb-3">
          Only jobs with at least one application are listed. All your jobs are on the Jobs page.
        </p>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Job</th>
              <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Applications</th>
              <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Scored</th>
              <th className="py-2 text-caption font-medium text-muted-foreground">Shortlisted</th>
            </tr>
          </thead>
          <tbody>
            {perJob.map((j) => (
              <tr key={j.jobId} className="border-b border-border last:border-0">
                <td className="py-2 pr-3 text-body-sm">
                  <Link to={`/recruiter/jobs/${j.jobId}`} className="text-foreground no-underline hover:underline">
                    {j.title || 'Untitled job'}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-body-sm tabular-nums">{j.total}</td>
                <td className="py-2 pr-3 text-body-sm tabular-nums">{j.scored}</td>
                <td className="py-2 text-body-sm tabular-nums">{j.shortlisted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RecruiterDashboard;
