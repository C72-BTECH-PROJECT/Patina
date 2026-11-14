import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Brain, Sparkles, ArrowRight, ChevronDown, FileText, GitBranch, ListChecks, Scale } from 'lucide-react';
import PatinaMark from '../../components/PatinaMark';

// R-15 (D§8.2): this page describes what the system does and nothing else. The
// demo score, the visitor statistics, the stock avatars, the rating and the
// "Connect GitHub" claim were invented and are gone; nothing here is a number
// the system did not produce.

// Card wrapper with a small hover lift.
const GlassCard = ({ children, className = '', hover = true }) => (
  <motion.div
    className={`card ${hover ? 'card-lift' : ''} ${className}`}
    whileHover={hover ? { y: -2, scale: 1.01 } : {}}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
  >
    {children}
  </motion.div>
);

// The inputs a credibility score is built from, in the order the pipeline uses them.
const SCORE_INPUTS = [
  { icon: FileText, title: 'Resume', text: 'Skills and contact details parsed from the PDF or DOCX you upload.' },
  { icon: GitBranch, title: 'GitHub (optional)', text: 'If your resume links a public GitHub account, its public activity is checked against the skills you claim.' },
  { icon: ListChecks, title: 'Assessment', text: 'A short timed assessment generated for the job you applied to.' },
  { icon: Scale, title: 'Explained score', text: 'One score per application, with the evidence it used and anything that was unavailable.' },
];

// Static explanation of how a score is put together (replaces the old animated demo score).
const ScoreInputsPanel = () => (
  <motion.div
    className="card p-6"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5, delay: 0.3 }}
  >
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
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
  </motion.div>
);

// Upload Icon
const Upload = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
  </svg>
);

// Feature Card Component
const FeatureCard = ({ icon: Icon, title, description, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1, duration: 0.4 }}
  >
    <GlassCard className="p-6 h-full">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-body-sm text-muted-foreground leading-relaxed">{description}</p>
    </GlassCard>
  </motion.div>
);

// Hero Section Component
const HeroSection = () => {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-32">
      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center lg:text-left"
        >
          <motion.div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border mb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Sparkles className="w-3.5 h-3.5 text-foreground" />
            <span className="text-xs font-medium text-foreground">AI-Powered Skill Validation</span>
          </motion.div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-foreground">
            Verify Skills with
            <br />
            <span className="text-foreground">AI-Powered</span>
            <br />
            Credibility
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
            Upload your resume and apply to a job. Your claimed skills are checked against your resume,
            any public GitHub account it links to, and a short assessment, and the score you get comes
            with an explanation of the evidence behind it.
          </p>

          <motion.div
            className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium text-body-sm hover:bg-primary/90 transition-colors no-underline"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-input bg-background text-foreground font-medium text-body-sm hover:bg-muted transition-colors no-underline"
            >
              Log In
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative"
        >
          <ScoreInputsPanel />
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ opacity }}
      >
        <ChevronDown className="w-6 h-6 text-muted-foreground" />
      </motion.div>
    </section>
  );
};

// How It Works Section
const HowItWorksSection = () => {
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
    <section className="py-24 relative">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-foreground text-xs font-semibold uppercase tracking-widest">How It Works</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3">Three Steps to a Score</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Every score shows the evidence behind it, so a recruiter can see why it is what it is.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} index={index} />
          ))}
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
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-5xl mx-auto flex justify-between items-center px-6 py-3">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <PatinaMark size={28} />
            <span className="font-display font-bold text-[15px] tracking-[.14em] text-foreground">PATINA</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-body-sm text-muted-foreground hover:text-foreground transition-colors">
              Log In
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-body-sm font-medium hover:bg-primary/90 transition-colors no-underline"
            >
              Get Started
            </Link>
          </div>
        </div>
      </motion.nav>

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
