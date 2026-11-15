import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Brain, Circle, FileText, GitBranch, ListChecks, Minus, Scale,
} from 'lucide-react';
import Badge from '../../components/Badge';
import PatinaMark from '../../components/PatinaMark';
import ScoreBadge, { VerificationBadge } from '../../components/ScoreBadge';
import ScoreRing from '../../components/ScoreRing';
import { skillStatusView } from '../../components/recruiter/ScoreBreakdown';
import { loadLandingSample, sampleCaption } from '../../data/loadLandingSample';

// R-15 (D§8.2): this page describes what the system does and nothing else. The
// demo score, the visitor statistics, the stock avatars, the rating and the
// "Connect GitHub" claim were invented and are gone; nothing here is a number
// the system did not produce.
//
// D-9 (DESIGN_SPEC §8): framer-motion is gone (entrances are the `anim-*` classes of
// index.css). The hero's right column is the real-score sample card when
// `src/data/landingSample.json` exists and is valid (data/loadLandingSample.js), and
// otherwise the static ScoreInputsPanel below. Nothing is shown in place of a missing
// sample.

// The inputs a credibility score is built from, in the order the pipeline uses them.
const SCORE_INPUTS = [
  { icon: FileText, title: 'Resume', text: 'Skills and contact details parsed from the PDF or DOCX you upload.' },
  { icon: GitBranch, title: 'GitHub (optional)', text: 'If your resume links a public GitHub account, its public activity is checked against the skills you claim.' },
  { icon: ListChecks, title: 'Assessment', text: 'A short timed assessment generated for the job you applied to.' },
  { icon: Scale, title: 'Explained score', text: 'One score per application, with the evidence it used and anything that was unavailable.' },
];

// Static explanation of how a score is put together (replaces the old animated demo score).
const ScoreInputsPanel = () => (
  <div className="card p-6 shadow-pop anim-rise" data-testid="score-inputs-panel">
    <p className="eyebrow text-muted-foreground mb-4">
      What a credibility score is built from
    </p>
    <ol className="space-y-4">
      {SCORE_INPUTS.map(({ icon: Icon, title, text }, i) => (
        <li key={title} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="h-4 w-4 text-foreground" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{i + 1}. {title}</p>
            <p className="text-body-sm text-muted-foreground leading-relaxed">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  </div>
);

// The factor rows of the sample card: the same stripe, direction wording and figures as
// the app's ScoreBreakdown factor card, in a compact form.
const STRIPE_BEFORE = "relative overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']";
const STRIPE_COLOR = {
  raises: 'before:bg-success',
  lowers: 'before:bg-destructive',
  sole: 'before:bg-primary',
  neutral: 'before:bg-muted-foreground',
};
const DIRECTION_STYLES = {
  raises: { icon: ArrowUpRight, className: 'text-success', label: 'Raises the score' },
  lowers: { icon: ArrowDownRight, className: 'text-destructive', label: 'Lowers the score' },
  neutral: { icon: Minus, className: 'text-muted-foreground', label: 'In line with the score' },
  sole: { icon: Circle, className: 'text-primary', label: 'Sole contributor' },
  unavailable: { icon: Minus, className: 'text-muted-foreground', label: 'No evidence' },
};

function SampleFactor({ factor }) {
  const direction = DIRECTION_STYLES[factor.direction] || DIRECTION_STYLES.neutral;
  const DirectionIcon = direction.icon;
  const stripe = factor.direction === 'unavailable' ? '' : (STRIPE_COLOR[factor.direction] || STRIPE_COLOR.neutral);
  const figure = (text) => (factor.available ? text : '—');
  return (
    <li
      className={`rounded-lg border border-border bg-surface py-3 pl-[19px] pr-3 ${STRIPE_BEFORE} ${stripe}`}
      data-testid="landing-sample-factor"
      data-direction={factor.direction}
    >
      {factor.direction === 'unavailable' && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: 'repeating-linear-gradient(hsl(var(--input)) 0 6px, transparent 6px 10px)' }}
        />
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <DirectionIcon className={`w-4 h-4 ${direction.className}`} aria-hidden="true" />
            <span className="text-body-sm font-semibold text-foreground">{factor.label}</span>
          </div>
          <p className={`text-caption mt-0.5 ${direction.className}`}>{direction.label}</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-body-sm font-semibold text-foreground tabular-nums">{figure(`${factor.value}/100`)}</div>
            <div className="text-[11px] text-muted-foreground">Sub-score</div>
          </div>
          <div>
            <div className="text-body-sm font-semibold text-foreground tabular-nums">{figure(`${factor.weight} (${factor.weight_pct}%)`)}</div>
            <div className="text-[11px] text-muted-foreground">Weight used</div>
          </div>
          <div>
            <div className="text-body-sm font-semibold text-foreground tabular-nums">{figure(`${factor.contribution}`)}</div>
            <div className="text-[11px] text-muted-foreground">Points</div>
          </div>
        </div>
      </div>
    </li>
  );
}

// The real stored score, captured from a scoring run (scripts/capture-landing-sample.mjs).
// Every figure is read from `sample`; the only text written here is labels.
function ScoreSampleCard({ sample }) {
  const skills = sample.skills.slice(0, 6);
  return (
    <div data-testid="landing-sample">
      <div className="card p-6 shadow-pop anim-rise">
        <p className="eyebrow text-muted-foreground mb-4">A real stored score</p>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing value={sample.composite} band={sample.band} static />
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <ScoreBadge band={sample.band} />
            <VerificationBadge verification={sample.verification} />
          </div>
        </div>

        <ul className="mt-5 space-y-2" data-testid="landing-sample-factors">
          {sample.factors.map((factor) => <SampleFactor key={factor.key} factor={factor} />)}
        </ul>

        {skills.length > 0 && (
          <ul className="mt-5 divide-y divide-border border-t border-border" data-testid="landing-sample-skills">
            {skills.map((row, i) => {
              const status = skillStatusView(row.status);
              return (
                <li key={`${row.skill}-${i}`} className="flex items-center justify-between gap-3 py-2" data-testid="landing-sample-skill">
                  <span className="text-body-sm text-foreground">{row.skill}</span>
                  <Badge variant={status.variant} icon={status.icon} title={status.hint}>{status.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-3 text-caption text-muted-foreground" data-testid="landing-sample-caption">
        {sampleCaption(sample)}
      </p>
    </div>
  );
}

// Upload Icon
const Upload = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
  </svg>
);

// Feature Card Component
const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className="card card-lift p-6 h-full">
    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
      <Icon className="w-5 h-5 text-foreground" />
    </div>
    <h3 className="text-h3 text-foreground mb-2">{title}</h3>
    <p className="text-body-sm text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

const ctaPrimary = 'inline-flex h-11 items-center justify-center gap-2 px-6 rounded-md bg-primary text-primary-foreground font-medium text-body-sm shadow-xs hover:bg-primary-hover transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus no-underline';

// Hero Section Component
const HeroSection = () => {
  // Read once per mount: the file cannot appear while the page is open.
  const sample = useMemo(() => loadLandingSample(), []);
  return (
  <section className="relative flex items-center justify-center pt-28 pb-24 lg:min-h-screen">
    <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center w-full">
      <div className="text-center lg:text-left anim-stagger">
        <div className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1.5 mb-6">
          <span className="eyebrow text-foreground">AI-Powered Skill Validation</span>
        </div>

        <h1 className="font-display text-[40px] md:text-[56px] leading-[1.1] md:leading-[1.05] font-bold tracking-[-.03em] mb-6 text-foreground">
          Verify Skills with
          <br />
          <span className="text-primary">AI-Powered</span>
          <br />
          Credibility
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
          Upload your resume and apply to a job. Your claimed skills are checked against your resume,
          any public GitHub account it links to, and a short assessment, and the score you get comes
          with an explanation of the evidence behind it.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
          <Link to="/signup" className={ctaPrimary}>
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="inline-flex h-11 items-center justify-center gap-2 px-6 rounded-md border border-border bg-surface text-foreground font-medium text-body-sm hover:bg-muted transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus no-underline"
          >
            Log In
          </Link>
        </div>
      </div>

      <div className="relative">
        {sample ? <ScoreSampleCard sample={sample} /> : <ScoreInputsPanel />}
      </div>
    </div>
  </section>
  );
};

// True when the user asked for reduced motion (or matchMedia is missing).
const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// One IntersectionObserver, threshold 0.3: when the section is in view, `inView` turns
// true once. With no IntersectionObserver (old browsers, jest) or reduced motion it is
// true from the start, so nothing waits for a scroll that cannot be observed.
function useInViewOnce(ref) {
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === 'undefined' || prefersReducedMotion(),
  );
  useEffect(() => {
    if (inView || !ref.current) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [inView, ref]);
  return inView;
}

// The line behind the three cards (md and above): a 1.5px line with a 6px primary dot at
// each card's centre. It draws by stroke-dashoffset over 900ms (--ease-out) once the
// section is in view; under reduced motion it is drawn at once (the global
// prefers-reduced-motion rule in index.css also cuts the transition to .01ms).
const ConnectingLine = ({ inView }) => (
  <svg
    className="hidden md:block w-full h-6 mb-4"
    aria-hidden="true"
    focusable="false"
    data-testid="how-it-works-line"
  >
    <line
      x1="16.667%" y1="12" x2="83.333%" y2="12"
      pathLength="1"
      stroke="hsl(var(--input))"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="1"
      strokeDashoffset={inView ? 0 : 1}
      style={{ transition: 'stroke-dashoffset 900ms var(--ease-out)' }}
    />
    {['16.667%', '50%', '83.333%'].map((cx) => (
      <circle
        key={cx}
        cx={cx}
        cy="12"
        r="3"
        fill="hsl(var(--primary))"
        style={{ opacity: inView ? 1 : 0, transition: 'opacity 220ms var(--ease-out) 700ms' }}
      />
    ))}
  </svg>
);

// How It Works Section
const HowItWorksSection = () => {
  const sectionRef = useRef(null);
  const inView = useInViewOnce(sectionRef);
  const features = [
    {
      icon: Upload,
      title: 'Upload Resume',
      description: 'Upload a PDF or DOCX resume. You see the skills that were extracted, or a clear message if the file could not be read.',
    },
    {
      icon: ListChecks,
      title: 'Apply and Take the Assessment',
      description: 'Apply to a job and take its short timed assessment. GitHub evidence is used only if your resume links a public account; it is never required.',
    },
    {
      icon: Brain,
      title: 'Get an Explained Score',
      description: 'Each application gets a credibility score that lists the evidence it used and marks anything that was unavailable.',
    },
  ];

  return (
    <section ref={sectionRef} data-inview={inView ? 'true' : 'false'} className="py-24 relative">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="eyebrow text-foreground">How It Works</span>
          <h2 className="text-h1 text-foreground mt-3">Three Steps to a Score</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Every score shows the evidence behind it, so a recruiter can see why it is what it is.</p>
        </div>

        <ConnectingLine inView={inView} />
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${inView ? 'anim-stagger' : '[&>*]:opacity-0'}`}>
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link to="/signup" className={ctaPrimary} data-testid="landing-mid-cta">
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

// Footer Component
const Footer = () => (
  <footer className="py-8 border-t border-border">
    <div className="max-w-5xl mx-auto px-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2.5">
          <PatinaMark size={24} />
          <span className="font-display font-bold text-[15px] tracking-[.14em] text-foreground">PATINA</span>
        </div>
        <div className="text-xs text-muted-foreground">
          © 2026 PATINA. All rights reserved.
        </div>
      </div>
    </div>
  </footer>
);

// Main Landing Page Component
function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto flex justify-between items-center px-6 py-3">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <PatinaMark size={28} />
            <span className="font-display font-bold text-[15px] tracking-[.14em] text-foreground">PATINA</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex h-9 items-center justify-center px-3.5 rounded-md text-body-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors no-underline"
            >
              Log In
            </Link>
            <Link
              to="/signup"
              className="inline-flex h-9 items-center justify-center px-4 rounded-md bg-primary text-primary-foreground text-body-sm font-medium shadow-xs hover:bg-primary-hover transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus no-underline"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <HeroSection />

      {/* How It Works */}
      <HowItWorksSection />

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Landing;
