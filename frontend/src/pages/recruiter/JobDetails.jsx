import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronRight, Filter, MapPin, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import CandidateModal from '../../components/recruiter/CandidateModal';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const scoreTone = (score) =>
  score >= 80 ? 'success' : score >= 60 ? 'warning' : 'destructive';

const TONE_TEXT_CLASS = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

const countByStatus = (analysis, status) =>
  (analysis.skillEvidence || []).filter((row) => row.status === status).length;

function CandidateRow({ analysis, onOpen, index }) {
  const tone = scoreTone(analysis.credibilityScore);
  const matched = countByStatus(analysis, 'matched');
  const missing = countByStatus(analysis, 'missing');

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className="card p-5 w-full text-left group"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
    >
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center font-semibold text-foreground flex-shrink-0">
          {analysis.candidate?.name?.charAt(0) || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground truncate">{analysis.candidate?.name}</div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {analysis.matchLevel && <Badge variant={tone}>{analysis.matchLevel}</Badge>}
            <span className="text-caption text-muted-foreground">
              {matched} of {matched + missing} required skills evidenced
            </span>
            {analysis.evidenceLimited && <Badge variant="warning">Evidence-limited</Badge>}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className={`text-h3 font-extrabold tabular-nums ${TONE_TEXT_CLASS[tone]}`}>
            {analysis.credibilityScore}
          </div>
          <div className="text-caption text-muted-foreground">Score</div>
        </div>

        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
      </div>
    </motion.button>
  );
}

function JobDetails() {
  const { id } = useParams();
  const { authFetch } = useAuth();

  const [job, setJob] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const [minScore, setMinScore] = useState(0);
  const [skillFilter, setSkillFilter] = useState('all');
  const [evidenceFilter, setEvidenceFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsResponse, candidatesResponse] = await Promise.all([
        authFetch(`${API_BASE_URL}/api/jobs/mine`),
        authFetch(`${API_BASE_URL}/api/candidates`),
      ]);
      if (!jobsResponse.ok || !candidatesResponse.ok) {
        throw new Error('Could not load this job.');
      }
      const jobs = await jobsResponse.json();
      const candidates = await candidatesResponse.json();

      setJob(jobs.find((j) => String(j.id) === String(id)) || null);
      // `/api/candidates` is already scoped to this recruiter's jobs and ranked
      // by composite score; narrow it to this job.
      setAnalyses(candidates.filter((c) => String(c.jobId) === String(id)));
    } catch (err) {
      setError(err.message || 'Could not load this job.');
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      analyses.filter((analysis) => {
        if (analysis.credibilityScore < minScore) return false;
        if (evidenceFilter === 'limited' && !analysis.evidenceLimited) return false;
        if (evidenceFilter === 'complete' && analysis.evidenceLimited) return false;
        if (skillFilter !== 'all') {
          const hasSkill = (analysis.skillEvidence || []).some(
            (row) => row.name === skillFilter && row.status === 'matched'
          );
          if (!hasSkill) return false;
        }
        return true;
      }),
    [analyses, minScore, skillFilter, evidenceFilter]
  );

  // Skills to filter by come from what the pipeline actually recognised in
  // these résumés, not from a static list.
  const filterableSkills = useMemo(() => {
    const names = new Set();
    for (const analysis of analyses) {
      for (const row of analysis.skillEvidence || []) {
        if (row.required_by_job) names.add(row.name);
      }
    }
    return [...names].sort();
  }, [analyses]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Spinner />
        <p className="text-body-sm text-muted-foreground">Loading candidates…</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="card">
        <EmptyState
          icon={AlertTriangle}
          title={error ? 'Something went wrong' : 'Job not found'}
          description={
            error || 'This job does not exist, or it belongs to a different recruiter account.'
          }
          action={
            <Link to="/recruiter/jobs" className="btn btn-primary no-underline">
              Back to jobs
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/recruiter/jobs"
        className="inline-flex items-center gap-2 text-body-sm text-muted-foreground hover:text-foreground transition-colors no-underline"
      >
        ← Back to jobs
      </Link>

      {/* Job header */}
      <motion.div
        className="card p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="min-w-0">
            <h1 className="text-h1 font-heading font-semibold text-foreground mb-2">{job.title}</h1>
            <p className="text-body-sm text-muted-foreground max-w-2xl mb-4 line-clamp-3">
              {job.description}
            </p>

            <div className="flex flex-wrap gap-2">
              {job.location && (
                <Badge variant="outline">
                  <MapPin className="w-3 h-3 mr-1" aria-hidden="true" />
                  {job.location}
                </Badge>
              )}
              {job.experienceLevel && <Badge variant="outline">{job.experienceLevel}</Badge>}
              {(job.requiredSkills || []).map((skill) => (
                <Badge key={skill} variant="primary">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-h1 font-extrabold text-foreground tabular-nums">
              {analyses.length}
            </div>
            <div className="text-caption text-muted-foreground">
              {analyses.length === 1 ? 'Candidate' : 'Candidates'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters (CHECKLIST 5.6 — skill, score band, evidence availability) */}
      <motion.div
        className="card p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-body font-medium text-foreground">Filter candidates</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="min-score" className="block text-caption text-muted-foreground mb-2">
              Minimum credibility score:{' '}
              <span className="text-foreground font-medium tabular-nums">{minScore}</span>
            </label>
            <input
              id="min-score"
              type="range"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
          </div>

          <div>
            <label htmlFor="skill-filter" className="block text-caption text-muted-foreground mb-2">
              Evidenced skill
            </label>
            <select
              id="skill-filter"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Any skill</option>
              {filterableSkills.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="evidence-filter"
              className="block text-caption text-muted-foreground mb-2"
            >
              Evidence availability
            </label>
            <select
              id="evidence-filter"
              value={evidenceFilter}
              onChange={(e) => setEvidenceFilter(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All candidates</option>
              <option value="complete">Scored on all evidence sources</option>
              <option value="limited">Evidence-limited</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Ranked candidates */}
      <div>
        <h2 className="text-body font-medium text-foreground mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          {filtered.length} of {analyses.length} candidates, ranked by credibility score
        </h2>

        <div className="grid gap-3">
          <AnimatePresence initial={false}>
            {filtered.map((analysis, index) => (
              <CandidateRow
                key={analysis.id}
                analysis={analysis}
                index={index}
                onOpen={() => setSelected(analysis)}
              />
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="card">
            <EmptyState
              icon={Users}
              title={analyses.length ? 'No candidates match these filters' : 'No applications yet'}
              description={
                analyses.length
                  ? 'Widen the score range or clear the skill and evidence filters.'
                  : 'Candidates who upload a résumé against this job will be ranked here once the pipeline has scored them.'
              }
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <CandidateModal analysis={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default JobDetails;
