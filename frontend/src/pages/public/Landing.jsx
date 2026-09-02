import React, { useEffect, useState} from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform} from 'framer-motion';
import { Zap, TrendingUp, Users, Brain, Sparkles, ArrowRight, ChevronDown, Star } from 'lucide-react';

// Animated Counter Component
const AnimatedCounter = ({ end, suffix = '', duration = 2 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span>{count}{suffix}</span>;
};

// Glass Card Component
const GlassCard = ({ children, className = '', hover = true }) => (
  <motion.div
    className={`card ${hover ? 'card-lift' : ''} ${className}`}
    whileHover={hover ? { y: -2, scale: 1.01 } : {}}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
  >
    {children}
  </motion.div>
);

// Building Icon (simplified)
const Building = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M9 22V18h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
  </svg>
);

// Credential Score Demo Component
const CredibilityDemo = () => {
  const [score, setScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setScore(82), 500);
    return () => clearTimeout(timer);
  }, []);

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <motion.div
      className="relative w-80 h-80 mx-auto"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      {/* Main Circle SVG */}
      <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
        {/* Background Circle */}
        <circle
          cx="130"
          cy="130"
          r="120"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="8"
        />
        {/* Progress Circle */}
        {score > 0 && (
          <motion.circle
            cx="130"
            cy="130"
            r="120"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
          />
        )}
      </svg>

      {/* Center Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {score === 0 ? (
          <div className="relative flex items-center justify-center">
            <div className="w-20 h-20 border-2 border-border border-t-primary rounded-full animate-spin" />
            <span className="absolute text-xs text-muted-foreground uppercase tracking-widest">Loading</span>
          </div>
        ) : (
          <>
            <motion.span
              className="text-6xl font-bold text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {score}
            </motion.span>
            <span className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">Credibility Score</span>
            <div className="flex gap-2 mt-3">
              {['Python', 'React', 'Node'].map((skill, i) => (
                <motion.span
                  key={skill}
                  className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                >
                  {skill}
                </motion.span>
              ))}
            </div>
            <motion.div
              className="mt-3 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-medium"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 }}
            >
          ✓ Verified
        </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
};

// Stats Section Component
const StatsSection = () => {
  const stats = [
    { value: 10000, suffix: '+', label: 'Candidates Verified', icon: Users },
    { value: 500, suffix: '+', label: 'Companies Using', icon: Building },
    { value: 95, suffix: '%', label: 'Accuracy Rate', icon: TrendingUp },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1, duration: 0.4 }}
        >
          <GlassCard className="p-6 text-center">
            <stat.icon className="w-6 h-6 mx-auto mb-3 text-foreground" />
            <div className="text-4xl font-bold text-foreground mb-1">
              <AnimatedCounter end={stat.value} suffix={stat.suffix} />
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</div>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
};

// Upload Icon
const Upload = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
  </svg>
);

// Link Icon
const LinkIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
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
            The smartest way to validate candidate skills. Connect GitHub, upload your resume, and get instant credibility scores based on real-world activity.
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
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-input bg-background text-foreground font-medium text-body-sm hover:bg-accent transition-colors no-underline"
            >
              Log In
            </Link>
          </motion.div>

          <motion.div
            className="mt-10 flex items-center gap-6 justify-center lg:justify-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex -space-x-2">
              {['https://i.pravatar.cc/40?img=1', 'https://i.pravatar.cc/40?img=2', 'https://i.pravatar.cc/40?img=3', 'https://i.pravatar.cc/40?img=4'].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="w-8 h-8 rounded-full border-2 border-background"
                />
              ))}
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-foreground">Trusted by 500+ companies</div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-foreground text-foreground" />
                ))}
                <span className="text-xs text-muted-foreground ml-1">4.9/5</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative"
        >
          <CredibilityDemo />
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
      description: 'Submit your resume and let our AI extract your skills, experience, and project history with precision.',
    },
    {
      icon: LinkIcon,
      title: 'Connect GitHub',
      description: 'Link your GitHub profile to verify real-world coding activity, contributions, and repository quality.',
    },
    {
      icon: Brain,
      title: 'Get AI Insights',
      description: 'Receive a comprehensive credibility score based on skills, activity, projects, and assessment results.',
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
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3">Three Steps to Verification</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Our AI-powered platform analyzes multiple data points to generate accurate credibility scores.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} index={index} />
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
          <div className="w-7 h-7 flex items-center justify-center bg-primary rounded-md">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">PATINA</span>
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
            <div className="w-7 h-7 flex items-center justify-center bg-primary rounded-md">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight text-foreground">PATINA</span>
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

      {/* Stats Section */}
      <section className="py-20">
        <StatsSection />
      </section>

      {/* How It Works */}
      <HowItWorksSection />

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Landing;
