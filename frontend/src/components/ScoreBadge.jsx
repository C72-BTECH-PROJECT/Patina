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

export default ScoreBadge;
