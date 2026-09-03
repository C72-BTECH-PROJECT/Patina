import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Users, Briefcase, Clock, ShieldAlert, ChevronRight, Star, Plus, Eye, Calendar, Gauge,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import CandidateModal from '../../components/recruiter/CandidateModal';
import { EvidenceUnavailable } from '../../components/recruiter/ScoreBreakdown';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const scoreTone = (score) =>
  score >= 80 ? 'success' : score >= 60 ? 'warning' : 'destructive';

const TONE_TEXT_CLASS = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

const StatCard = ({ icon: Icon, label, value, hint, delay }) => (
  <motion.div
    className="card p-6"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
      <Icon className="w-5 h-5 text-foreground" aria-hidden="true" />
    </div>
    <div className="text-h2 font-extrabold text-foreground tabular-nums mb-1">{value}</div>
    <div className="text-body-sm text-muted-foreground">{label}</div>
    {hint && <div className="text-caption text-muted-foreground mt-1">{hint}</div>}
  </motion.div>
);

const CandidateCard = ({ analysis, rank, onOpen }) => {
  const tone = scoreTone(analysis.credibilityScore);
  const evidenced = (analysis.skillEvidence || []).filter((r) => r.status === 'matched');

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className="card p-4 w-full text-left group"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center font-semibold text-body-sm text-foreground flex-shrink-0">
          #{rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground truncate">{analysis.candidate?.name}</div>
          <div className="text-caption text-muted-foreground truncate">
            {analysis.jobTitle || 'Unassigned role'}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className={`text-h3 font-extrabold tabular-nums ${TONE_TEXT_CLASS[tone]}`}>
            {analysis.credibilityScore}
          </div>
          <div className="text-caption text-muted-foreground">Score</div>
        </div>

        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
      </div>

      <div className="flex gap-1.5 mt-3 flex-wrap">
        {evidenced.slice(0, 3).map((row) => (
          <Badge key={row.name} variant="success">
            {row.name}
          </Badge>
        ))}
        {evidenced.length > 3 && <Badge>+{evidenced.length - 3}</Badge>}
        {evidenced.length === 0 && (
          <span className="text-caption text-muted-foreground">
            No required skill evidenced in the résumé
          </span>
        )}
        {analysis.evidenceLimited && <Badge variant="warning">Evidence-limited</Badge>}
      </div>
    </motion.button>
  );
};

const JobCard = ({ job, index }) => (
  <motion.div
    className="card p-4"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
  >
    <div className="flex items-center justify-between mb-2 gap-3">
      <h3 className="font-medium text-foreground truncate">{job.title}</h3>
      <Link
        to={`/recruiter/jobs/${job.id}`}
        className="px-3 py-1.5 rounded-md bg-muted border border-border text-foreground text-caption font-medium hover:bg-muted/80 transition-all no-underline flex-shrink-0"
      >
        View →
      </Link>
    </div>

    <p className="text-body-sm text-muted-foreground line-clamp-1 mb-3">{job.description}</p>

    <div className="flex items-center gap-1.5 flex-wrap">
      {(job.requiredSkills || []).map((skill) => (
        <Badge key={skill}>{skill}</Badge>
      ))}
    </div>

    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-caption text-muted-foreground">
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3" aria-hidden="true" />
        {job.experienceLevel || 'Any'}
      </span>
      {job.createdAt && (
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" aria-hidden="true" />
          {new Date(job.createdAt).toLocaleDateString()}
        </span>
      )}
    </div>
  </motion.div>
);

/** Applications per day for the last 7 days, from each score's created_at. */
const buildDailyApplications = (analyses) => {
  const days = [];
  const index = new Map();
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const bucket = {
      key: date.toDateString(),
      day: date.toLocaleDateString(undefined, { weekday: 'short' }),
      applications: 0,
    };
    days.push(bucket);
    index.set(bucket.key, bucket);
  }

  for (const analysis of analyses) {
    if (!analysis.appliedAt) continue;
    const day = new Date(analysis.appliedAt);
    day.setHours(0, 0, 0, 0);
    const bucket = index.get(day.toDateString());
    if (bucket) bucket.applications += 1;
  }

  return days;
};

/**
 * Per-skill confidence across the pipeline (CHECKLIST 5.11): for every skill a
 * job asked for, how many of the candidates it was required of actually
 * evidenced it. Counted from stored skill evidence, not a fixed distribution.
 */
const buildSkillEvidenceSummary = (analyses) => {
  const totals = new Map();

  for (const analysis of analyses) {
    for (const row of analysis.skillEvidence || []) {
      if (!row.required_by_job) continue;
      const entry = totals.get(row.name) || { name: row.name, required: 0, evidenced: 0 };
      entry.required += 1;
      if (row.status === 'matched') entry.evidenced += 1;
      totals.set(row.name, entry);
    }
  }

  return [...totals.values()]
    .sort((a, b) => b.required - a.required || b.evidenced - a.evidenced)
    .slice(0, 6);
};

function RecruiterDashboard() {
  const { authFetch, user } = useAuth();
  const [analyses, setAnalyses] = React.useState([]);
  const [jobs, setJobs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState(null);

  React.useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [candidateResponse, jobsResponse] = await Promise.all([
          authFetch(`${API_BASE_URL}/api/candidates`),
          authFetch(`${API_BASE_URL}/api/jobs/mine`),
        ]);
        setAnalyses(candidateResponse.ok ? await candidateResponse.json() : []);
        setJobs(jobsResponse.ok ? await jobsResponse.json() : []);
      } catch (err) {
        console.error('Failed to load the recruiter dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [authFetch]);

  const ranked = React.useMemo(
    () => [...analyses].sort((a, b) => b.credibilityScore - a.credibilityScore),
    [analyses]
  );
  const dailyApplications = React.useMemo(() => buildDailyApplications(analyses), [analyses]);
  const skillSummary = React.useMemo(() => buildSkillEvidenceSummary(analyses), [analyses]);
  const evidenceLimitedCount = analyses.filter((a) => a.evidenceLimited).length;
  const averageScore = analyses.length
    ? Math.round(analyses.reduce((sum, a) => sum + a.credibilityScore, 0) / analyses.length)
    : 0;
  // Flag detection needs a corroborating evidence source; the backend says so
  // per candidate, and every candidate currently reports the same reason.
  const flagsUnavailableReason = analyses.find((a) => !a.flagsAvailable)?.flagsUnavailableReason;
  const flaggedCount = analyses.filter((a) => a.flagsAvailable && a.flags.length > 0).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Spinner />
        <p className="text-body-sm text-muted-foreground">Loading your hiring overview…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-h1 font-heading font-semibold text-foreground mb-2">
            Recruiter Dashboard
          </h1>
          <p className="text-body-sm text-muted-foreground">
            {user?.firstName ? (
              <>
                Welcome back,{' '}
                <span className="text-foreground font-medium">{user.firstName}</span>.{' '}
              </>
            ) : null}
            Candidates are ranked by a credibility score you can audit factor by factor.
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Briefcase} label="Active jobs" value={jobs.length} delay={0.05} />
        <StatCard
          icon={Users}
          label="Candidates scored"
          value={analyses.length}
          delay={0.1}
        />
        <StatCard
          icon={Gauge}
          label="Average credibility"
          value={analyses.length ? `${averageScore}` : '—'}
          hint={analyses.length ? 'Across all scored candidates' : 'No scores yet'}
          delay={0.15}
        />
        <StatCard
          icon={ShieldAlert}
          label="Evidence-limited"
          value={evidenceLimitedCount}
          hint="Scored without GitHub or assessment evidence"
          delay={0.2}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          className="card p-6 lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h3 className="text-body font-medium text-foreground mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
            Applications scored, last 7 days
          </h3>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyApplications}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="applications" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          className="card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-body font-medium text-foreground mb-1 flex items-center gap-2">
            <Star className="w-4 h-4" aria-hidden="true" />
            Skill evidence
          </h3>
          <p className="text-caption text-muted-foreground mb-5">
            How often a skill your jobs require is actually evidenced in the résumés you received.
          </p>

          {skillSummary.length ? (
            <div className="space-y-4">
              {skillSummary.map((skill) => {
                const pct = Math.round((skill.evidenced / skill.required) * 100);
                return (
                  <div key={skill.name}>
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <span className="text-body-sm text-foreground truncate">{skill.name}</span>
                      <span className="text-caption text-muted-foreground tabular-nums flex-shrink-0">
                        {skill.evidenced}/{skill.required}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-body-sm text-muted-foreground">
              No scored candidates yet, so there is no skill evidence to summarise.
            </p>
          )}
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          className="card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h3 className="text-body font-medium text-foreground mb-1 flex items-center gap-2">
            <Eye className="w-4 h-4" aria-hidden="true" />
            Top candidates
          </h3>
          <p className="text-caption text-muted-foreground mb-4">
            Select a candidate to audit how their score was produced.
          </p>

          {ranked.length ? (
            <div className="space-y-3">
              {ranked.slice(0, 5).map((analysis, index) => (
                <CandidateCard
                  key={analysis.id}
                  analysis={analysis}
                  rank={index + 1}
                  onOpen={() => setSelected(analysis)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No candidates scored yet"
              description="Once a candidate uploads a résumé against one of your jobs, their credibility score and its breakdown appear here."
            />
          )}
        </motion.div>

        <motion.div
          className="card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-body font-medium text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4" aria-hidden="true" />
              Your jobs
            </h3>
            <Link
              to="/recruiter/jobs"
              className="text-caption text-muted-foreground hover:text-foreground transition-colors no-underline"
            >
              View all →
            </Link>
          </div>

          {jobs.length ? (
            <div className="space-y-3">
              {jobs.slice(0, 5).map((job, index) => (
                <JobCard key={job.id} job={job} index={index} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Briefcase}
              title="No jobs posted"
              description="Create a job to start receiving and scoring applications."
              action={
                <Link to="/recruiter/create-job" className="btn btn-primary no-underline">
                  Create a job
                </Link>
              }
            />
          )}
        </motion.div>
      </div>

      {/* Attention required — real counts only, and an explicit unavailable
          state for the checks that need evidence the pipeline cannot collect
          yet (CHECKLIST 4.6 / 5.9 / 5.10). */}
      <motion.div
        className="card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <h3 className="text-body font-medium text-foreground mb-4 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-warning" aria-hidden="true" />
          Attention required
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted border border-border">
            <div className="text-h3 font-extrabold text-foreground tabular-nums mb-1">
              {evidenceLimitedCount}
            </div>
            <div className="text-body-sm font-medium text-foreground mb-1">
              Evidence-limited candidates
            </div>
            <p className="text-caption text-muted-foreground leading-relaxed">
              Scored on résumé evidence alone. Their missing sources had their weight
              redistributed, so these scores are not directly comparable to fully evidenced ones.
            </p>
          </div>

          {flagsUnavailableReason ? (
            <EvidenceUnavailable
              title="Inconsistency detection not available"
              reason={flagsUnavailableReason}
            />
          ) : (
            <div className="p-4 rounded-lg bg-muted border border-border">
              <div className="text-h3 font-extrabold text-foreground tabular-nums mb-1">
                {flaggedCount}
              </div>
              <div className="text-body-sm font-medium text-foreground mb-1">
                Flagged applications
              </div>
              <p className="text-caption text-muted-foreground leading-relaxed">
                Candidates whose résumé claims are contradicted by their other evidence.
              </p>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {selected && <CandidateModal analysis={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}

export default RecruiterDashboard;
