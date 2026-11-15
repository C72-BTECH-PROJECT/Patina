import React, { useEffect, useState } from 'react';
import { bandTone } from './ScoreBadge';
import useCountUp from '../lib/useCountUp';

// The composite ring (DESIGN_SPEC §9). Moved out of pages/candidate/Results.jsx
// (D-9) so the landing page can use it without importing the Results page; Results.jsx
// still exports it. Tone comes from the backend band only (ScoreBadge.bandTone).
// Literal class strings so Tailwind emits them.
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

const TONE_VAR = {
  success: '--success',
  warning: '--warning',
  destructive: '--destructive',
  neutral: '--foreground',
};

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const finalOffsetOf = (value) =>
  RING_CIRCUMFERENCE - (Math.min(100, Math.max(0, value)) / 100) * RING_CIRCUMFERENCE;

// The drawn ring. `animate` keeps the stroke transition of the Results page; the
// static ring has none. `testId` / `testState` land on the sr-only value span.
function RingFace({ value, band, offset, text, animate, testId, testState }) {
  const tone = bandTone(band);
  return (
    <div className="relative w-40 h-40 flex-shrink-0">
      <div
        className="absolute inset-[18px] rounded-full"
        style={{ background: `radial-gradient(circle, hsl(var(${TONE_VAR[tone]}) / .07), transparent 70%)` }}
        aria-hidden="true"
      />
      <svg className="relative w-full h-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={RING_RADIUS} fill="none" stroke="hsl(var(--track))" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={animate ? { transition: 'stroke-dashoffset var(--dur-signature) var(--ease-emph)' } : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="sr-only" data-testid={testId} data-state={testState}>
          {String(value)}
        </span>
        <span
          aria-hidden="true"
          className={`font-display text-[44px] font-bold tracking-[-.03em] tabular-nums ${TONE_TEXT[tone]}`}
        >
          {text}
        </span>
        <span className="text-caption text-muted-foreground" aria-hidden="true">/100</span>
      </div>
    </div>
  );
}

// Results page behaviour: the arc sweeps in and the number counts up.
function AnimatedScoreRing({ value, band }) {
  const finalOffset = finalOffsetOf(value);
  const [offset, setOffset] = useState(RING_CIRCUMFERENCE);
  const displayed = useCountUp(value);

  useEffect(() => {
    const timer = setTimeout(() => setOffset(finalOffset), 120);
    return () => clearTimeout(timer);
  }, [finalOffset]);

  return (
    <RingFace
      value={value}
      band={band}
      offset={offset}
      text={displayed}
      animate
      testId="application-score"
      testState="scored"
    />
  );
}

/**
 * `static`: the final value and arc at once, no count-up and no stroke transition
 * (the landing page's sample card). Without it the ring behaves as it always did on
 * the Results page; the e2e spine reads its sr-only `application-score` span.
 */
function ScoreRing({ value, band, static: isStatic = false }) {
  if (isStatic) {
    return (
      <RingFace
        value={value}
        band={band}
        offset={finalOffsetOf(value)}
        text={String(value)}
        animate={false}
        testId="landing-sample-score"
        testState="static"
      />
    );
  }
  return <AnimatedScoreRing value={value} band={band} />;
}

export default ScoreRing;
export { ScoreRing };
