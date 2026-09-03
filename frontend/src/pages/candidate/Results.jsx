import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy, Briefcase, LayoutDashboard, Wrench, GraduationCap,
  FolderGit2, Code2, AlertCircle, FileUp,
} from 'lucide-react';
import Badge from '../../components/Badge';
import Spinner from '../../components/Spinner';
import ScoreBreakdown from '../../components/recruiter/ScoreBreakdown';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const scoreTone = (score) =>
  score >= 80 ? 'success' : score >= 60 ? 'warning' : 'destructive';

// Written out, not interpolated: Tailwind only emits classes it finds as
// literal strings in the source.
const TONE_TEXT = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

const TONE_BG_SOFT = {
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  destructive: 'bg-destructive/10',
};

function ScoreRing({ score }) {
  const tone = scoreTone(score);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={`hsl(var(--${tone}))`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-h1 font-extrabold ${TONE_TEXT[tone]} tabular-nums`}>
          {Math.round(score)}
        </span>
        <span className="text-caption text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

/** A parsed-entity block: title + icon + whatever the parser found, or an honest "nothing found". */
function EntitySection({ icon: Icon, title, count, children, empty }) {
  return (
    <div>
      <h3 className="text-body font-medium text-foreground mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        {title}
        {count != null && (
          <span className="text-caption text-muted-foreground font-normal">({count})</span>
        )}
      </h3>
      {count ? children : <p className="text-body-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}

function Results() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(location.state?.analysis || null);
  const [status, setStatus] = useState(location.state?.analysis ? 'ok' : 'loading');

  useEffect(() => {
    if (location.state?.analysis) {
      setAnalysis(location.state.analysis);
      setStatus('ok');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/candidate-analysis`);
        if (cancelled) return;
        if (resp.status === 404) {
          setStatus('none');
        } else if (!resp.ok) {
          setStatus('error');
        } else {
          setAnalysis(await resp.json());
          setStatus('ok');
        }
      } catch {
        if (!cancelled) setStatus('error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [location.state]);

  if (loading) {
    return <Spinner.Page message="Loading your credibility score..." />;
  }

  if (status === 'none' || status === 'error' || !analysis) {
    const isEmpty = status === 'none';
    return (
      <motion.div {...fadeUp} className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-h2 font-heading font-semibold text-foreground mb-2">
          {isEmpty ? 'No analysis yet' : 'Could not load your analysis'}
        </h1>
        <p className="text-body-sm text-muted-foreground mb-8">
          {isEmpty
            ? 'Upload your résumé against a job to get your credibility score and a full breakdown of how it was calculated.'
            : 'Something went wrong loading your most recent analysis. Please try again in a moment.'}
        </p>
        <Link
          to="/candidate/upload"
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-6 py-3 font-medium no-underline hover:bg-primary/90 transition-colors"
        >
          <FileUp className="w-4 h-4" />
          Upload résumé
        </Link>
      </motion.div>
    );
  }

  const score = Number(analysis.credibilityScore) || 0;
  const skills = analysis.extractedSkills || [];
  const experience = analysis.experience || [];
  const education = analysis.education || [];
  const projects = analysis.projects || [];
  const summary = analysis.explanation?.summary;

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div {...fadeUp} className="text-center mb-8">
        <div
          className={`w-16 h-16 rounded-full ${TONE_BG_SOFT[scoreTone(score)]} flex items-center justify-center mx-auto mb-4`}
        >
          <Trophy className={`w-8 h-8 ${TONE_TEXT[scoreTone(score)]}`} />
        </div>
        <h1 className="text-h1 text-foreground mb-2">Your credibility score</h1>
        {analysis.jobTitle && (
          <p className="text-body text-muted-foreground">
            Résumé analysed against <span className="text-foreground">{analysis.jobTitle}</span>
          </p>
        )}
      </motion.div>

      {/* Composite + summary */}
      <motion.div {...fadeUp} transition={{ delay: 0.1, duration: 0.4 }} className="card p-8 mb-6">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <ScoreRing score={score} />
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start mb-3">
              {analysis.matchLevel && (
                <Badge variant={scoreTone(score)}>{analysis.matchLevel}</Badge>
              )}
              {analysis.evidenceLimited && <Badge variant="warning">Evidence-limited</Badge>}
            </div>
            <p className="text-body-sm text-muted-foreground leading-relaxed">
              {summary ||
                'Your score combines every evidence source available for your résumé. Recruiters see this same score alongside the breakdown below.'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Parsed entities */}
      <motion.div {...fadeUp} transition={{ delay: 0.2, duration: 0.4 }} className="card p-6 mb-6">
        <h2 className="text-body font-medium text-foreground mb-4 flex items-center gap-2">
          <Code2 className="w-4 h-4 text-warning" />
          What we parsed from your résumé
        </h2>
        <div className="space-y-6">
          <EntitySection
            icon={Code2}
            title="Skills"
            count={skills.length}
            empty="No skills were detected in your résumé text."
          >
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <Badge key={skill} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
          </EntitySection>

          <EntitySection
            icon={Wrench}
            title="Experience"
            count={experience.length}
            empty="No experience section was found in your résumé."
          >
            <ul className="space-y-4">
              {experience.map((item, i) => (
                <li key={i}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-body-sm font-medium text-foreground">
                      {item.title || item.organisation || 'Role'}
                    </span>
                    {item.organisation && item.title && (
                      <span className="text-body-sm text-muted-foreground">
                        · {item.organisation}
                      </span>
                    )}
                    {item.dates && (
                      <span className="text-caption text-muted-foreground">{item.dates}</span>
                    )}
                  </div>
                  {Array.isArray(item.highlights) && item.highlights.length > 0 && (
                    <ul className="mt-1 space-y-0.5 list-disc pl-5">
                      {item.highlights.map((h, j) => (
                        <li key={j} className="text-caption text-muted-foreground leading-relaxed">
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </EntitySection>

          <EntitySection
            icon={GraduationCap}
            title="Education"
            count={education.length}
            empty="No education entries were detected."
          >
            <ul className="space-y-1.5 list-disc pl-5">
              {education.map((line, i) => (
                <li key={i} className="text-body-sm text-foreground">
                  {line}
                </li>
              ))}
            </ul>
          </EntitySection>

          <EntitySection
            icon={FolderGit2}
            title="Projects"
            count={projects.length}
            empty="No projects were detected."
          >
            <ul className="space-y-3">
              {projects.map((project, i) => (
                <li key={i}>
                  <p className="text-body-sm font-medium text-foreground">{project.title}</p>
                  {project.description && (
                    <p className="text-caption text-muted-foreground leading-relaxed mt-0.5">
                      {project.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </EntitySection>
        </div>
      </motion.div>

      {/* Same factor breakdown recruiters see */}
      <motion.div {...fadeUp} transition={{ delay: 0.3, duration: 0.4 }} className="card p-6 mb-6">
        <h2 className="text-body font-medium text-foreground mb-4">
          How your score was calculated
        </h2>
        <ScoreBreakdown analysis={analysis} />
      </motion.div>

      <motion.div
        {...fadeUp}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <Link
          to="/candidate/jobs"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-6 py-3 font-medium no-underline hover:bg-primary/90 transition-colors"
        >
          <Briefcase className="w-4 h-4" />
          Browse jobs
        </Link>
        <Link
          to="/candidate/dashboard"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-6 py-3 font-medium no-underline hover:bg-accent transition-colors"
        >
          <LayoutDashboard className="w-4 h-4" />
          Go to dashboard
        </Link>
      </motion.div>
    </div>
  );
}

export default Results;
