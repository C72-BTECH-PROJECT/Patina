import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Zap, Shield, TrendingUp, Users, Brain, Sparkles, ArrowRight, ChevronDown, Star, Hexagon } from 'lucide-react';

// Floating Particle Component
const FloatingParticle = ({ delay = 0, x = 0, y = 0 }) => (
  <motion.div
    className="absolute w-1 h-1 bg-accent-purple rounded-full opacity-60"
    style={{
      left: `${x}%`,
      top: `${y}%`,
      boxShadow: '0 0 10px rgba(139, 92, 246, 0.8)',
    }}
    animate={{
      y: [0, -100, 0],
      opacity: [0.2, 0.8, 0.2],
      scale: [0.5, 1, 0.5],
    }}
    transition={{
      duration: 8 + Math.random() * 4,
      delay,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  />
);

// Glow Orb Component
const GlowOrb = ({ className, size = 'lg' }) => {
  const sizeClasses = {
    sm: 'w-64 h-64',
    md: 'w-96 h-96',
    lg: 'w-[500px] h-[500px]',
  };

  return (
    <div className={`absolute ${sizeClasses[size]} ${className}`}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent-purple/40 via-accent-cyan/20 to-accent-pink/30 animate-glow-pulse" />
      <div className="absolute inset-8 rounded-full bg-gradient-to-br from-accent-cyan/30 to-transparent animate-float" />
    </div>
  );
};

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
    className={`glass-card ${hover ? 'card-lift' : ''} ${className}`}
    whileHover={hover ? { y: -8, scale: 1.02 } : {}}
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
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.5 }}
    >
      {/* Outer Glow Ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: [
            '0 0 60px rgba(139, 92, 246, 0.3)',
            '0 0 100px rgba(139, 92, 246, 0.5)',
            '0 0 60px rgba(139, 92, 246, 0.3)',
          ],
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Main Circle SVG */}
      <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
        {/* Background Circle */}
        <circle
          cx="130"
          cy="130"
          r="120"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
        />
        {/* Progress Circle */}
        <motion.circle
          cx="130"
          cy="130"
          r="120"
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 2, delay: 0.5, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-7xl font-extrabold bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-pink bg-clip-text text-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {score}
        </motion.span>
        <span className="text-sm text-white/60 mt-2 uppercase tracking-widest">Credibility Score</span>
        <div className="flex gap-2 mt-4">
          {['Python', 'React', 'Node'].map((skill, i) => (
            <motion.span
              key={skill}
              className="px-3 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-white/80"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 + i * 0.1 }}
            >
              {skill}
            </motion.span>
          ))}
        </div>
        <motion.div
          className="mt-4 px-4 py-1.5 rounded-full bg-accent-emerald/20 border border-accent-emerald/30 text-accent-emerald text-sm font-medium"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5 }}
        >
          ✓ Verified
        </motion.div>
      </div>

      {/* Floating Elements */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-accent-cyan rounded-full"
          style={{
            top: `${20 + i * 12}%`,
            right: i % 2 === 0 ? '-5%' : undefined,
            left: i % 2 === 0 ? undefined : '-5%',
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.3,
          }}
        />
      ))}
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
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.15, duration: 0.6 }}
        >
          <GlassCard className="p-8 text-center relative overflow-hidden">
            <div className="corner-decoration top-left" />
            <div className="corner-decoration bottom-right" />

            <stat.icon className="w-8 h-8 mx-auto mb-4 text-accent-purple" />

            <div className="text-5xl font-extrabold bg-gradient-to-r from-accent-purple to-accent-cyan bg-clip-text text-transparent mb-2">
              <AnimatedCounter end={stat.value} suffix={stat.suffix} />
            </div>
            <div className="text-sm text-white/50 uppercase tracking-wider">{stat.label}</div>

            {/* Animated Border */}
            <motion.div
              className="absolute inset-0 opacity-0"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: index * 0.5 }}
            >
              <div className="absolute inset-0 border-2 border-accent-purple/30 rounded-3xl" />
            </motion.div>
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
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.15, duration: 0.6 }}
  >
    <GlassCard className="p-8 h-full relative group cursor-pointer">
      {/* Corner Decorations */}
      <div className="corner-decoration top-left" />
      <div className="corner-decoration bottom-right" />

      {/* Glow Effect on Hover */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.1), transparent 70%)',
        }}
      />

      {/* Icon */}
      <motion.div
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 flex items-center justify-center mb-6 relative"
        whileHover={{ scale: 1.1, rotate: 5 }}
      >
        <Icon className="w-7 h-7 text-accent-purple" />
        <div className="absolute inset-0 rounded-2xl border border-accent-purple/30 group-hover:border-accent-purple/50 transition-colors" />
      </motion.div>

      {/* Content */}
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-white/50 leading-relaxed">{description}</p>

      {/* Bottom Accent Line */}
      <motion.div
        className="absolute bottom-0 left-8 right-8 h-0.5 bg-gradient-to-r from-accent-purple via-accent-cyan to-transparent"
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.3 }}
      />
    </GlassCard>
  </motion.div>
);

// Hero Section Component
const HeroSection = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <motion.section className="relative min-h-screen flex items-center justify-center pt-20 pb-32 overflow-hidden" style={{ y }}>
      {/* Background Effects */}
      <div className="absolute inset-0 bg-background" />

      {/* Animated Grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-100" />

      {/* Glow Orbs */}
      <GlowOrb className="top-[-20%] left-[-10%] -translate-x-1/2" size="lg" />
      <GlowOrb className="top-[10%] right-[-20%] translate-x-1/2" size="md" />
      <GlowOrb className="bottom-[-30%] left-[30%]" size="sm" />

      {/* Floating Particles */}
      {[...Array(20)].map((_, i) => (
        <FloatingParticle
          key={i}
          delay={i * 0.2}
          x={Math.random() * 100}
          y={Math.random() * 100}
        />
      ))}

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left Content */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center lg:text-left"
        >
          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Sparkles className="w-4 h-4 text-accent-purple" />
            <span className="text-sm text-white/70">AI-Powered Skill Validation</span>
          </motion.div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
            <span className="text-white">Verify Skills with</span>
            <br />
            <span className="gradient-text">AI-Powered</span>
            <br />
            <span className="text-white">Credibility</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-white/50 leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0">
            The smartest way to validate candidate skills. Connect GitHub, upload your resume, and get instant credibility scores based on real-world activity.
          </p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Link to="/select-role" className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold overflow-hidden magnetic-btn">
              {/* Button Background */}
              <span className="absolute inset-0 bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-purple bg-[length:200%_100%] animate-gradient-shift" />
              <span className="absolute inset-[2px] bg-background rounded-lg" />
              <span className="relative z-10 flex items-center gap-2 text-white">
                Get Started
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.span>
              </span>
            </Link>

            <Link
              to="/candidate/dashboard"
              className="relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold bg-white/5 border border-white/10 hover:border-white/20 transition-all group"
            >
              <Star className="w-5 h-5 text-accent-amber" />
              <span className="text-white">View Demo</span>
            </Link>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            className="mt-12 flex items-center gap-8 justify-center lg:justify-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div className="flex -space-x-2">
              {['https://i.pravatar.cc/40?img=1', 'https://i.pravatar.cc/40?img=2', 'https://i.pravatar.cc/40?img=3', 'https://i.pravatar.cc/40?img=4'].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="w-10 h-10 rounded-full border-2 border-background"
                />
              ))}
            </div>
            <div className="text-left">
              <div className="text-sm text-white font-medium">Trusted by 500+ companies</div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-accent-amber text-accent-amber" />
                ))}
                <span className="text-xs text-white/50 ml-1">4.9/5</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Content - Credibility Score Demo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative"
        >
          <CredibilityDemo />

          {/* Decorative Hexagons */}
          <motion.div
            className="absolute -top-10 -right-10 opacity-20"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <Hexagon className="w-24 h-24 text-accent-purple" />
          </motion.div>
          <motion.div
            className="absolute -bottom-10 -left-10 opacity-20"
            animate={{ rotate: -360 }}
            transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          >
            <Hexagon className="w-16 h-16 text-accent-cyan" />
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ opacity }}
      >
        <ChevronDown className="w-8 h-8 text-white/30" />
      </motion.div>
    </motion.section>
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
    <section className="py-32 relative">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent-purple/5 to-transparent" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-accent-purple text-sm font-semibold uppercase tracking-widest">How It Works</span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mt-4">Three Steps to Verification</h2>
          <p className="text-white/50 mt-4 max-w-2xl mx-auto">Our AI-powered platform analyzes multiple data points to generate accurate credibility scores.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
  <footer className="py-12 border-t border-white/5">
    <div className="max-w-6xl mx-auto px-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-accent-purple to-accent-cyan rounded-xl">
            <Zap className="w-5 h-5 text-white" />
          </span>
          <span className="font-bold text-xl text-white tracking-tight">PATINA</span>
        </div>
        <div className="text-sm text-white/30">
          © 2026 PATINA. All rights reserved.
        </div>
      </div>
    </div>
  </footer>
);

// Main Landing Page Component
function Landing() {
  return (
    <div className="min-h-screen bg-background text-white overflow-x-hidden">
      {/* Noise Overlay */}
      <div className="noise-overlay" />

      {/* Navigation */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <span className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-accent-purple to-accent-cyan rounded-xl group-hover:shadow-glow-purple transition-shadow">
              <Zap className="w-5 h-5 text-white" />
            </span>
            <span className="font-extrabold text-2xl tracking-tight text-white">PATINA</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link to="/login/candidate" className="text-sm text-white/70 hover:text-white transition-colors animated-underline">For Candidates</Link>
            <Link to="/login/recruiter" className="text-sm text-white/70 hover:text-white transition-colors animated-underline">For Recruiters</Link>
          </nav>

          <Link
            to="/select-role"
            className="px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-white hover:bg-white/10 transition-all"
          >
            Get Started
          </Link>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <HeroSection />

      {/* Stats Section */}
      <section className="py-24 relative">
        <StatsSection />
      </section>

      {/* How It Works */}
      <HowItWorksSection />

      {/* CTA Section */}
      <section className="py-32 relative">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
              Ready to Transform Your
              <br />
              <span className="gradient-text">Hiring Process?</span>
            </h2>
            <p className="text-white/50 mb-10 max-w-xl mx-auto">
              Join thousands of companies using AI-powered skill validation to build stronger teams.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/select-role" className="btn-primary inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold magnetic-btn">
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/login/recruiter" className="px-8 py-4 rounded-xl font-semibold bg-white/5 border border-white/10 hover:border-white/20 text-white transition-all">
                Contact Sales
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Landing;