import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle, ArrowRight, Briefcase, Code2, FolderGit2, GraduationCap, LayoutDashboard, Wrench,
} from 'lucide-react';
import Badge from '../../components/Badge';
import ScoreBadge, { bandTone } from '../../components/ScoreBadge';
import Spinner from '../../components/Spinner';
import ScoreBreakdown from '../../components/recruiter/ScoreBreakdown';
import { api } from '../../lib/api';
import { ScoreAgainButton, StatusBadge, scoringReasonText } from './applicationState';

// R-16 (D§8.2, F13, F14): the result of ONE application.
//   /candidate/results                  pick an application (from the nav)
//   /candidate/results/:applicationId   that application's result (from a dashboard row)
// Endpoints:
//   GET  /api/jobs/my-applications        the picker: id, job_title, scoring.state
//   GET  /api/applications/:id/result     { application: { id, job_id, job_title, status, submitted_at },
//                                           scoring: { state }, score: serializeCandidate shape | null }
//                                         404 = not this candidate's application
//   POST /api/applications/:id/score      "Score again"
// Nothing here is defaulted: no 0 for a missing score, no stock sentence for a
// missing explanation.

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

// Tone from the backend band only (ScoreBadge.bandTone). Literal class strings so
// Tailwind emits them.
const TONE_TEXT = {
  success: 'text-success',
  warning: 'text-warning-text',
  destructive: 'text-destructive',
  neutral: 'text-foreground',
};

const TONE_STROKE = {
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))',
  neutral: 'hsl(var(--foreground))',
};

function ScoreRing({ value, band }) {
  const tone = bandTone(band);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-h1 font-extrabold ${TONE_TEXT[tone]} tabular-nums`}
          data-testid="application-score"
          data-state="scored"
        >
          {String(value)}
        </span>
        <span className="text-caption text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

/** A parsed-entity block: what the parser found, or that it found nothing. */
function EntitySection({ icon: Icon, title, count, children, empty }) {
  return (
    <div>
      <h3 className="text-body font-medium text-foreground mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        {title}
        <span className="text-caption text-muted-foreground font-normal">({count})</span>
      </h3>
      {count ? children : <p className="text-body-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}

/** The stored sub-scores, when the score row has no explanation factors to render. */
function SubScoreList({ subScores }) {
  const entries = Object.entries(subScores || {}).filter(([, s]) => s && typeof s === 'object');
  if (!entries.length) {
    return <p className="text-body-sm text-muted-foreground">No sub-scores were stored with this score.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {entries.map(([key, s]) => (
        <li key={key} className="flex flex-wrap items-baseline justify-between gap-3 py-2">
          <span className="text-body-sm text-foreground">{s.label || key}</span>
          {s.available ? (
            <span className="text-body-sm font-semibold tabular-nums text-foreground">{String(s.value)}/100</span>
          ) : (
            <span className="text-caption text-muted-foreground">Not available{s.reason ? `: ${s.reason}` : ''}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Message({ icon: Icon = AlertCircle, title, children, testId, tone = 'muted' }) {
  return (
    <motion.div {...fadeUp} className="max-w-xl mx-auto text-center py-12" data-testid={testId}>
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
        <Icon className={`w-8 h-8 ${tone === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
      </div>
      <h1 className="text-h2 font-heading font-semibold text-foreground mb-2">{title}</h1>
      <div className="text-body-sm text-muted-foreground space-y-4">{children}</div>
    </motion.div>
  );
}

const BackLinks = () => (
  <div className="mt-8 flex flex-col sm:flex-row gap-3">
    <Link
      to="/candidate/dashboard"
      className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-background px-6 py-3 font-medium text-foreground no-underline hover:bg-muted transition-colors"
    >
      <LayoutDashboard className="w-4 h-4" />
      My applications
    </Link>
    <Link
      to="/candidate/jobs"
      className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-6 py-3 font-medium no-underline hover:bg-primary/90 transition-colors"
    >
      <Briefcase className="w-4 h-4" />
      Browse jobs
    </Link>
  </div>
);

/** /candidate/results with no id: choose which application's result to see. */
function ResultsPicker() {
  const [state, setState] = useState({ status: 'loading', apps: [], error: '' });

  useEffect(() => {
    let cancelled = false;
    api.get('/api/jobs/my-applications')
      .then((rows) => { if (!cancelled) setState({ status: 'ready', apps: Array.isArray(rows) ? rows : [], error: '' }); })
      .catch((err) => { if (!cancelled) setState({ status: 'error', apps: [], error: err.message }); });
    return () => { cancelled = true; };
  }, []);

  if (state.status === 'loading') return <Spinner.Page message="Loading your applications..." />;
  if (state.status === 'error') {
    return <Message title="Could not load your applications" tone="error" testId="results-error"><p>{state.error}</p></Message>;
  }
  if (!state.apps.length) {
    return (
      <Message icon={Briefcase} title="No results yet" testId="results-empty">
        <p>Results are per application. Apply to a job and its result appears here.</p>
        <BackLinks />
      </Message>
    );
  }
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2">Results</h1>
      <p className="text-sm text-muted-foreground mb-6">Each application has its own result. Choose one.</p>
      <div className="space-y-3">
        {state.apps.map((app) => (
          <Link
            key={app.id}
            to={`/candidate/results/${app.id}`}
            className="card p-4 flex items-center justify-between gap-3 no-underline hover:bg-muted transition-colors"
          >
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{app.job_title || 'Untitled job'}</p>
              <p className="text-xs text-muted-foreground">
                {app.scoring?.state === 'scored' ? 'Scored' : 'Not scored yet'}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

/** /candidate/results/:applicationId */
function ApplicationResult({ applicationId }) {
  const [status, setStatus] = useState('loading'); // loading | error | not_found | ready
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [retry, setRetry] = useState({ error: '', failure: null });

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      setData(await api.get(`/api/applications/${encodeURIComponent(applicationId)}/result`));
      setStatus('ready');
    } catch (err) {
      // 404: no such application, or not this candidate's (the server answers both alike).
      if (err.status === 404 || err.status === 400) {
        setStatus('not_found');
        return;
      }
      setError(err.message);
      setStatus('error');
    }
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading') return <Spinner.Page message="Loading this result..." />;
  if (status === 'error') {
    return (
      <Message title="Could not load this result" tone="error" testId="results-error">
        <p>{error}</p>
        <BackLinks />
      </Message>
    );
  }
  if (status === 'not_found') {
    return (
      <Message title="Application not found" testId="results-not-found">
        <p>None of your applications has this id.</p>
        <BackLinks />
      </Message>
    );
  }

  const app = data?.application || {};
  const analysis = data?.score || null;

  const header = (
    <motion.div {...fadeUp} className="mb-6">
      <p className="text-sm text-muted-foreground">Result for your application to</p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h1 text-foreground">{app.job_title || 'an untitled job'}</h1>
        <StatusBadge status={app.status} />
      </div>
    </motion.div>
  );

  // No score row for this application.
  if (!analysis) {
    return (
      <div className="max-w-3xl mx-auto">
        {header}
        <div className="card p-6" data-testid="application-score" data-state={retry.failure ? 'failed' : 'pending'}>
          <h2 className="text-body font-semibold text-foreground">Not scored yet</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Your application is submitted. It has no score yet; you can try scoring it again.
          </p>
          {retry.failure && <p className="mt-2 text-body-sm text-foreground">{scoringReasonText(retry.failure)}</p>}
          <div className="mt-4">
            <ScoreAgainButton
              applicationId={app.id}
              onResult={(result) => {
                if (result?.status === 'scored') {
                  setRetry({ error: '', failure: null });
                  load();
                } else {
                  setRetry({ error: '', failure: result?.reason || 'internal_error' });
                }
              }}
              onError={(err) => setRetry((r) => ({ ...r, error: err.message }))}
            />
          </div>
          {retry.error && <p className="mt-2 text-body-sm text-destructive">Score again failed: {retry.error}</p>}
        </div>
        <BackLinks />
      </div>
    );
  }

  const composite = Number(analysis.credibilityScore);
  const hasComposite = analysis.credibilityScore !== null && analysis.credibilityScore !== undefined && Number.isFinite(composite);
  const skills = analysis.extractedSkills || [];
  const experience = analysis.experience || [];
  const education = analysis.education || [];
  const projects = analysis.projects || [];
  const explanation = analysis.explanation;
  const hasFactors = Array.isArray(explanation?.factors) && explanation.factors.length > 0;

  return (
    <div className="max-w-3xl mx-auto">
      {header}

      {/* Composite */}
      <motion.div {...fadeUp} transition={{ delay: 0.1, duration: 0.4 }} className="card p-8 mb-6">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {hasComposite ? (
            <ScoreRing value={composite} band={analysis.band} />
          ) : (
            <p className="text-body-sm text-destructive">The stored score has no composite value.</p>
          )}
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start mb-3">
              <ScoreBadge band={analysis.band} />
              {analysis.matchLevel && <Badge variant="outline">{analysis.matchLevel}</Badge>}
              {analysis.evidenceLimited && <Badge variant="warning">Evidence-limited</Badge>}
            </div>
            {explanation?.summary && (
              <p className="text-body-sm text-foreground leading-relaxed" data-testid="score-explanation">
                {explanation.summary}
              </p>
            )}
            {explanation?.band_thresholds?.note && (
              <p className="mt-2 text-caption text-muted-foreground">{explanation.band_thresholds.note}</p>
            )}
            <p className="mt-2 text-caption text-muted-foreground">
              The weights are provisional: a design choice, not yet calibrated.
            </p>
            {explanation?.github_account?.note && (
              <p className="mt-2 text-caption text-muted-foreground">{explanation.github_account.note}</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Sub-scores and evidence, read from the stored explanation */}
      <motion.div {...fadeUp} transition={{ delay: 0.2, duration: 0.4 }} className="card p-6 mb-6">
        <h2 className="text-body font-medium text-foreground mb-4">How this score was calculated</h2>
        {hasFactors ? (
          <ScoreBreakdown analysis={analysis} />
        ) : (
          <>
            <p className="text-body-sm text-muted-foreground mb-3">No explanation was stored with this score.</p>
            <SubScoreList subScores={analysis.subScores} />
          </>
        )}
      </motion.div>

      {/* What the parser read from the resume this score used */}
      <motion.div {...fadeUp} transition={{ delay: 0.3, duration: 0.4 }} className="card p-6 mb-6">
        <h2 className="text-body font-medium text-foreground mb-4 flex items-center gap-2">
          <Code2 className="w-4 h-4 text-muted-foreground" />
          What was read from your resume
        </h2>
        <div className="space-y-6">
          <EntitySection icon={Code2} title="Skills" count={skills.length} empty="No skills were found in the text.">
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <Badge key={skill} variant="outline">{skill}</Badge>
              ))}
            </div>
          </EntitySection>

          <EntitySection icon={Wrench} title="Experience" count={experience.length} empty="No experience entries were found.">
            <ul className="space-y-4">
              {experience.map((item, i) => (
                <li key={i}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-body-sm font-medium text-foreground">
                      {[item?.title, item?.organisation].filter(Boolean).join(' · ') || 'Entry without a title'}
                    </span>
                    {item?.dates && <span className="text-caption text-muted-foreground">{item.dates}</span>}
                  </div>
                  {Array.isArray(item?.highlights) && item.highlights.length > 0 && (
                    <ul className="mt-1 space-y-0.5 list-disc pl-5">
                      {item.highlights.map((h, j) => (
                        <li key={j} className="text-caption text-muted-foreground leading-relaxed">{h}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </EntitySection>

          <EntitySection icon={GraduationCap} title="Education" count={education.length} empty="No education entries were found.">
            <ul className="space-y-1.5 list-disc pl-5">
              {education.map((line, i) => (
                <li key={i} className="text-body-sm text-foreground">{typeof line === 'string' ? line : JSON.stringify(line)}</li>
              ))}
            </ul>
          </EntitySection>

          <EntitySection icon={FolderGit2} title="Projects" count={projects.length} empty="No projects were found.">
            <ul className="space-y-3">
              {projects.map((project, i) => (
                <li key={i}>
                  <p className="text-body-sm font-medium text-foreground">{project?.title}</p>
                  {project?.description && (
                    <p className="text-caption text-muted-foreground leading-relaxed mt-0.5">{project.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </EntitySection>
        </div>
      </motion.div>

      <BackLinks />
    </div>
  );
}

function Results() {
  const { applicationId } = useParams();
  return applicationId ? <ApplicationResult key={applicationId} applicationId={applicationId} /> : <ResultsPicker />;
}

export default Results;
