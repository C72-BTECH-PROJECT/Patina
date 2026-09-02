import React from 'react';
import { motion } from 'framer-motion';
// lucide-react carries no brand icons, so the LinkedIn link uses the generic
// Link glyph and its own label.
import { X, Mail, MapPin, Link as LinkIcon, FileText, Calendar } from 'lucide-react';
import Badge from '../Badge';
import ScoreBreakdown from './ScoreBreakdown';

/**
 * CandidateModal — the "Audit Score Breakdown" view (CHECKLIST 5.7 / 5.8).
 *
 * Takes one analysis from `GET /api/candidates` (the
 * `analysis.controller.serializeCandidate` shape) and shows the composite next
 * to the stored explanation that produced it. It renders no metric the backend
 * did not persist: sources with no evidence show their reason, not a zero.
 */

const GithubIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const scoreTone = (score) =>
  score >= 80 ? 'success' : score >= 60 ? 'warning' : 'destructive';

// Written out rather than interpolated: Tailwind only emits classes it can find
// as literal strings in the source.
const TONE_TEXT_CLASS = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

function ScoreRing({ score }) {
  const tone = scoreTone(score);
  const circumference = 2 * Math.PI * 50;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={`hsl(var(--${tone}))`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-h2 font-extrabold ${TONE_TEXT_CLASS[tone]} tabular-nums`}>
          {score}
        </span>
        <span className="text-caption text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function CandidateModal({ analysis, onClose }) {
  if (!analysis) return null;

  const person = analysis.candidate || {};
  const appliedAt = analysis.appliedAt ? new Date(analysis.appliedAt) : null;

  return (
    <motion.div
      className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Score breakdown for ${person.name}`}
    >
      <motion.div
        className="bg-background rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden relative border border-border shadow-lg"
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 24 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="overflow-y-auto max-h-[90vh]">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="flex-1 min-w-0 pr-10">
                <h2 className="text-h2 font-heading font-semibold text-foreground mb-1">
                  {person.name}
                </h2>
                {analysis.jobTitle && (
                  <p className="text-body-sm text-muted-foreground mb-3">
                    Applied for {analysis.jobTitle}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm text-muted-foreground">
                  {person.location && person.location !== '—' && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" aria-hidden="true" />
                      {person.location}
                    </span>
                  )}
                  {person.email && (
                    <a
                      href={`mailto:${person.email}`}
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors no-underline"
                    >
                      <Mail className="w-4 h-4" aria-hidden="true" />
                      {person.email}
                    </a>
                  )}
                  {person.github && (
                    <a
                      href={person.github}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors no-underline"
                    >
                      <GithubIcon className="w-4 h-4" />
                      GitHub profile
                    </a>
                  )}
                  {person.linkedin && (
                    <a
                      href={person.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors no-underline"
                    >
                      <LinkIcon className="w-4 h-4" aria-hidden="true" />
                      LinkedIn
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {analysis.matchLevel && (
                    <Badge variant={scoreTone(analysis.credibilityScore)}>
                      {analysis.matchLevel}
                    </Badge>
                  )}
                  {analysis.evidenceLimited && <Badge variant="warning">Evidence-limited</Badge>}
                  {analysis.resumeFileName && (
                    <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                      <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                      {analysis.resumeFileName}
                    </span>
                  )}
                  {appliedAt && (
                    <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                      {appliedAt.toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center">
                <ScoreRing score={analysis.credibilityScore} />
                <span className="text-caption text-muted-foreground mt-2">Credibility score</span>
              </div>
            </div>
          </div>

          {/* Drill-down */}
          <div className="p-6">
            <ScoreBreakdown analysis={analysis} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default CandidateModal;
