import React from 'react';
import Badge from './Badge';

/**
 * ScoreBadge renders the `band` the backend sends with a composite score
 * ('high' | 'medium' | 'low', from backend/Services/explainability.js scoreBand).
 * The frontend never derives a band from the number: the thresholds live in the
 * backend only (REBUILD/DECISIONS.md §7), and they are uncalibrated presentation
 * labels.
 *
 *   <ScoreBadge band={score.band} />
 *
 * With no band (no composite) it renders nothing; the page decides how to show
 * "not scored". An unknown band value is shown as sent, in a neutral style.
 *
 * `bandTone(band)` gives the colour tone for other score visuals (rings, numbers):
 * 'success' | 'warning' | 'destructive', or 'neutral' when there is no known band.
 *
 * R-27 (DECISIONS.md §7.1) adds, beside the band:
 *   <VerificationBadge verification={score.verification} />   W3: how far the score is
 *       verified ('unverified' | 'partly_verified' | 'verified', emitted by core)
 *   weightsVersionLabel(explanation)   W5: the weight rule a stored score used
 *   partialScoreLabel(subscores)       W4: what a score awaiting the assessment is made of
 */

const BANDS = {
  high: { label: 'High', tone: 'success' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'destructive' },
};

export const bandTone = (band) => BANDS[band]?.tone || 'neutral';

function ScoreBadge({ band, size = 'sm', className = '' }) {
  if (band === null || band === undefined || band === '') return null;
  const known = BANDS[band];
  return (
    <Badge
      variant={known ? known.tone : 'outline'}
      size={size}
      className={className}
      title="Score band. Bands are uncalibrated presentation labels."
    >
      {known ? known.label : String(band)}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Verification (D§7.1 W3)
// ---------------------------------------------------------------------------

const VERIFICATION = {
  unverified: {
    label: 'Unverified',
    variant: 'outline',
    hint: 'Résumé claims only. Nothing has been verified yet: neither GitHub activity nor the assessment has answered.',
  },
  partly_verified: {
    label: 'Partly verified',
    variant: 'primary',
    hint: 'One independent source (GitHub activity or the assessment) verified this score.',
  },
  verified: {
    label: 'Verified',
    variant: 'success',
    hint: 'Both independent sources, GitHub activity and the assessment, verified this score.',
  },
};

/** { label, variant, hint } for a verification value; an unknown one is shown as sent. Null for none. */
export const verificationView = (verification) => {
  if (verification === null || verification === undefined || verification === '') return null;
  if (Object.prototype.hasOwnProperty.call(VERIFICATION, verification)) return VERIFICATION[verification];
  return { label: `Unknown verification: ${String(verification)}`, variant: 'outline', hint: 'The server sent a verification value this page does not know.' };
};

export function VerificationBadge({ verification, size = 'sm', className = '' }) {
  const view = verificationView(verification);
  if (!view) return null;
  return (
    <Badge
      variant={view.variant}
      size={size}
      className={className}
      title={`Verification: ${view.hint}`}
      data-testid="verification-badge"
      data-verification={String(verification)}
    >
      {view.label}
    </Badge>
  );
}

/**
 * R-38: whether to show the "Evidence-limited" badge beside a score. Only where no
 * verification state is shown (a row stored before R-27 has none): the verification
 * badge already says which sources stand behind the score, and both together read as
 * two contradictory verdicts ("Evidence-limited" beside "Partly verified").
 */
export const showEvidenceLimited = (evidenceLimited, verification) =>
  evidenceLimited === true && !verificationView(verification);

// ---------------------------------------------------------------------------
// Weights version (D§7.1 W5)
// ---------------------------------------------------------------------------

/** How a stored score with no weights version is labelled: the rule before R-27. */
export const LEGACY_WEIGHTS_LABEL = 'v1 (0.40 / 0.35 / 0.25)';

/**
 * The weights version of a stored score: `explanation.weights_version` as stored, or the
 * v1 label for a row written before versions were recorded. Accepts the explanation
 * object or the version string itself.
 */
export const weightsVersionLabel = (explanationOrVersion) => {
  const v = typeof explanationOrVersion === 'string'
    ? explanationOrVersion
    : explanationOrVersion?.weights_version;
  return typeof v === 'string' && v.trim() ? v.trim() : LEGACY_WEIGHTS_LABEL;
};

// ---------------------------------------------------------------------------
// Awaiting the assessment (D§7.1 W4)
// ---------------------------------------------------------------------------

export const AWAITING_ASSESSMENT = 'awaiting_assessment';

/**
 * The label of a score that is still awaiting the assessment, naming the sources it
 * is made of: "partial score, résumé" or "partial score, résumé and GitHub".
 * `subscores`: { <key>: { available } } as the list or the stored row carries them.
 */
export const partialScoreLabel = (subscores) => {
  const has = (key) => subscores?.[key]?.available === true;
  const parts = [];
  if (has('parsing_semantic_alignment')) parts.push('résumé');
  if (has('github_evidence')) parts.push('GitHub');
  return parts.length ? `partial score, ${parts.join(' and ')}` : 'partial score';
};

export default ScoreBadge;
