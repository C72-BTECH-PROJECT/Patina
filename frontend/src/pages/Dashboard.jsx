import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Shield, TrendingUp, CheckCircle, AlertCircle, Star, Award, ChevronRight, Activity, Target, Code, FolderOpen, MapPin, Briefcase } from 'lucide-react';

// Glow Orb Component
const GlowOrb = ({ className }) => (
  <div className={`absolute w-96 h-96 rounded-full filter blur-3xl opacity-20 ${className}`}>
    <div className={`w-full h-full rounded-full bg-gradient-to-br from-accent-purple/40 to-accent-cyan/30 animate-glow-pulse`} />
  </div>
);

// Animated Credibility Ring Component
const CredibilityRing = ({ score, size = 280 }) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 500);
    return () => clearTimeout(timer);
  }, [score]);

  const circumference = 2 * Math.PI * ((size / 2) - 20);
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  const getScoreColor = () => {
    if (animatedScore >= 75) return { from: '#10b981', to: '#06b6d4' };
    if (animatedScore >= 50) return { from: '#f59e0b', to: '#f43f5e' };
    return { from: '#ef4444', to: '#f43f5e' };
  };

  const colors = getScoreColor();

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer Glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: [
            `0 0 80px ${colors.from}40`,
            `0 0 120px ${colors.from}60`,
            `0 0 80px ${colors.from}40`,
          ],
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Rotating Gradient Border */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${colors.from}, ${colors.to}, ${colors.from})`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />

      {/* Inner Background */}
      <div className="absolute inset-[3px] rounded-full bg-background" />

      {/* Progress SVG */}
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size / 2) - 20}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="12"
        />
        {/* Progress Arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={(size / 2) - 20}
          fill="none"
          stroke={`url(#ringGradient-${score})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, delay: 0.3, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id={`ringGradient-${score}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.from} />
            <stop offset="100%" stopColor={colors.to} />
          </linearGradient>
        </defs>
      </svg>

      {/* Center Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.span
            className="text-7xl font-extrabold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {animatedScore}
          </motion.span>
          <div className="text-sm text-white/40 uppercase tracking-widest mt-2">Score</div>
        </motion.div>

        {/* Label */}
        <motion.div
          className="absolute bottom-12 px-4 py-1.5 rounded-full bg-white/5 border border-white/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <span className={`text-sm font-medium ${
            animatedScore >= 75 ? 'text-accent-emerald' :
            animatedScore >= 50 ? 'text-accent-amber' : 'text-accent-rose'
          }`}>
            {animatedScore >= 75 ? 'Highly Verified' : animatedScore >= 50 ? 'Partially Verified' : 'Needs Review'}
          </span>
        </motion.div>
      </div>

      {/* Pulsing Rings */}
      <motion.div
        className="absolute inset-8 rounded-full border border-white/5"
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </div>
  );
};

// Skill Card Component
const SkillCard = ({ skill, verified, index }) => (
  <motion.div
    className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-accent-purple/30 transition-all group"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    whileHover={{ scale: 1.02, x: 4 }}
  >
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        verified ? 'bg-accent-emerald/20' : 'bg-accent-amber/20'
      }`}>
        {verified ? (
          <CheckCircle className="w-5 h-5 text-accent-emerald" />
        ) : (
          <AlertCircle className="w-5 h-5 text-accent-amber" />
        )}
      </div>
      <span className="font-medium text-white">{skill}</span>
    </div>
    <span className={`text-xs px-3 py-1 rounded-full ${
      verified ? 'bg-accent-emerald/20 text-accent-emerald' : 'bg-accent-amber/20 text-accent-amber'
    }`}>
      {verified ? 'Verified' : 'Unverified'}
    </span>
  </motion.div>
);

// Project Card Component
const ProjectCard = ({ project, index }) => (
  <motion.div
    className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-accent-cyan/30 transition-all group"
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.1 }}
    whileHover={{ scale: 1.02 }}
  >
    <div className="flex items-center gap-3 mb-2">
      <FolderOpen className="w-5 h-5 text-accent-cyan" />
      <span className="font-medium text-white">{project}</span>
    </div>
    <div className="text-sm text-white/40">Repository analyzed</div>
  </motion.div>
);

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div
    className="glass-card p-6 relative overflow-hidden"
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <div className="corner-decoration top-left" />
    <div className="corner-decoration bottom-right" />

    <div className="relative z-10">
      <div className={`w-12 h-12 rounded-xl bg-${color || 'accent-purple'}/20 flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 text-${color || 'accent-purple'}`} />
      </div>
      <div className="text-3xl font-extrabold text-white mb-1">{value}</div>
      <div className="text-sm text-white/40">{label}</div>
    </div>

    {/* Background Glow */}
    <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-${color || 'accent-purple'}/10 filter blur-xl`} />
  </motion.div>
);

// Match Badge Component
const MatchBadge = ({ level, percentage }) => {
  const colors = {
    High: { bg: 'bg-accent-emerald/20', border: 'border-accent-emerald/30', text: 'text-accent-emerald' },
    Medium: { bg: 'bg-accent-amber/20', border: 'border-accent-amber/30', text: 'text-accent-amber' },
    Low: { bg: 'bg-accent-rose/20', border: 'border-accent-rose/30', text: 'text-accent-rose' },
  };

  const style = colors[level] || colors.Medium;

  return (
    <motion.div
      className={`px-6 py-3 rounded-2xl ${style.bg} border ${style.border} flex items-center gap-3`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <Target className={`w-5 h-5 ${style.text}`} />
      <div>
        <div className={`font-bold ${style.text}`}>{percentage}% Match</div>
        <div className="text-xs text-white/40">{level} Alignment</div>
      </div>
    </motion.div>
  );
};

// Loading Skeleton
const LoadingSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <motion.div
      className="flex flex-col items-center gap-4"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <div className="w-16 h-16 rounded-full border-4 border-accent-purple/20 border-t-accent-purple" />
      <p className="text-white/50">Loading your analysis...</p>
    </motion.div>
  </div>
);

// Main Dashboard Component
function Dashboard() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5001/api/candidate-analysis')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch candidate analysis');
        return res.json();
      })
      .then((data) => {
        setAnalysis(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Dashboard load failed');
        setLoading(false);
      });
  }, []);

  const matchColor = useMemo(() => ({
    High: '#10b981',
    Medium: '#f59e0b',
    Low: '#ef4444',
  }), []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <GlowOrb className="top-[-20%] left-[-10%]" />

        <motion.div
          className="glass-card p-10 max-w-md w-full text-center relative"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-accent-rose/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-accent-rose" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">Error Loading Analysis</h2>
          <p className="text-white/50 mb-8">{error}</p>

          <Link
            to="/candidate/upload"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold"
          >
            Upload Resume Again
          </Link>
        </motion.div>
      </div>
    );
  }

  if (!analysis) return null;

  const {
    candidate,
    matchPercentage,
    extractedSkills,
    projects,
    experienceLevel,
    match_level,
    verifiedSkills,
    credibilityScore,
  } = analysis;

  return (
    <div className="min-h-screen bg-background text-white relative overflow-hidden">
      {/* Noise Overlay */}
      <div className="noise-overlay" />

      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <GlowOrb className="top-[-10%] left-[-5%]" />
      <GlowOrb className="bottom-[-10%] right-[-5%]" />

      {/* Header */}
      <motion.header
        className="relative z-10 flex justify-between items-center py-6 px-8 border-b border-white/5"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link
          to="/candidate/upload"
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors no-underline group"
        >
          <motion.span
            animate={{ x: [0, -5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ←
          </motion.span>
          <span className="font-medium">Back</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-accent-purple to-accent-cyan rounded-xl">
            <Zap className="w-5 h-5 text-white" />
          </span>
          <span className="font-extrabold tracking-tight text-2xl">PATINA</span>
        </div>

        <div className="w-[60px]" />
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Top Section - Profile & Score */}
          <motion.div
            className="grid lg:grid-cols-2 gap-8 mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Profile Card */}
            <div className="glass-card p-8 relative">
              <div className="corner-decoration top-left" />
              <div className="corner-decoration bottom-right" />

              <div className="flex items-start gap-4 mb-6">
                {/* Avatar */}
                <motion.div
                  className="relative"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">
                      {candidate?.name?.charAt(0) || 'C'}
                    </span>
                  </div>
                  <motion.div
                    className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-accent-emerald flex items-center justify-center border-2 border-background"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <CheckCircle className="w-4 h-4 text-white" />
                  </motion.div>
                </motion.div>

                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white mb-2">{candidate?.name || 'Candidate'}</h1>
                  <div className="flex items-center gap-2 text-white/50 mb-3">
                    <MapPin className="w-4 h-4" />
                    <span>{candidate?.location || '—'}</span>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full bg-accent-emerald/20 border border-accent-emerald/30 text-accent-emerald text-xs font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Resume Parsed
                    </span>
                    <span className="px-3 py-1 rounded-full bg-accent-purple/20 border border-accent-purple/30 text-accent-purple text-xs font-medium flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Job Matched
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-medium flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Pipeline Complete
                    </span>
                  </div>
                </div>
              </div>

              {/* Experience */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <Briefcase className="w-5 h-5 text-accent-cyan" />
                <span className="text-sm text-white/70">Experience:</span>
                <span className="text-sm font-medium text-white bg-white/5 px-3 py-1 rounded-full">
                  {experienceLevel || '—'}
                </span>
              </div>
            </div>

            {/* Credibility Score Card */}
            <div className="glass-card p-8 flex flex-col items-center justify-center relative">
              <div className="corner-decoration top-left" />
              <div className="corner-decoration bottom-right" />

              <div className="mb-4">
                <h2 className="text-lg font-semibold text-white/70 text-center">Credibility Score</h2>
              </div>

              <CredibilityRing score={credibilityScore || 0} />

              <div className="mt-6">
                <MatchBadge level={match_level || 'Medium'} percentage={matchPercentage || 0} />
              </div>
            </div>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <StatCard icon={Code} label="Skills Found" value={extractedSkills?.length || 0} color="accent-purple" delay={0.4} />
            <StatCard icon={CheckCircle} label="Verified Skills" value={verifiedSkills?.length || 0} color="accent-emerald" delay={0.5} />
            <StatCard icon={FolderOpen} label="Projects Analyzed" value={projects?.length || 0} color="accent-cyan" delay={0.6} />
            <StatCard icon={TrendingUp} label="Match Score" value={`${matchPercentage || 0}%`} color="accent-pink" delay={0.7} />
          </motion.div>

          {/* Skills & Projects Grid */}
          <motion.div
            className="grid lg:grid-cols-2 gap-8 mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {/* Extracted Skills */}
            <div className="glass-card p-6 relative">
              <div className="corner-decoration top-left" />
              <div className="corner-decoration bottom-right" />

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Code className="w-5 h-5 text-accent-purple" />
                  Extracted Skills
                </h3>
                <span className="text-sm text-white/40">{extractedSkills?.length || 0} found</span>
              </div>

              <div className="space-y-2">
                <AnimatePresence>
                  {(extractedSkills || []).map((skill, idx) => {
                    const verified = (verifiedSkills || []).some((vs) => vs.name === skill);
                    return (
                      <SkillCard key={idx} skill={skill} verified={verified} index={idx} />
                    );
                  })}
                </AnimatePresence>

                {(!extractedSkills || extractedSkills.length === 0) && (
                  <div className="text-center text-white/40 py-8">
                    No skills extracted from resume
                  </div>
                )}
              </div>
            </div>

            {/* Projects */}
            <div className="glass-card p-6 relative">
              <div className="corner-decoration top-left" />
              <div className="corner-decoration bottom-right" />

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-accent-cyan" />
                  Projects
                </h3>
                <span className="text-sm text-white/40">{projects?.length || 0} analyzed</span>
              </div>

              <div className="grid gap-3">
                <AnimatePresence>
                  {(projects || []).map((project, idx) => (
                    <ProjectCard key={idx} project={project} index={idx} />
                  ))}
                </AnimatePresence>

                {(!projects || projects.length === 0) && (
                  <div className="text-center text-white/40 py-8">
                    No projects found in resume
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Verified Skills Deep Dive */}
          {verifiedSkills && verifiedSkills.length > 0 && (
            <motion.div
              className="glass-card p-6 relative"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="corner-decoration top-left" />
              <div className="corner-decoration bottom-right" />

              <div className="flex items-center gap-2 mb-6">
                <Award className="w-5 h-5 text-accent-emerald" />
                <h3 className="text-xl font-bold text-white">Verified Skills Detail</h3>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {verifiedSkills.map((vs, idx) => (
                  <motion.div
                    key={idx}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/5"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white">{vs.name}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-accent-emerald/20 text-accent-emerald">
                        {vs.level}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-accent-emerald to-accent-cyan rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.random() * 40 + 60}%` }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Summary */}
          <motion.div
            className="mt-8 glass-card p-6 relative overflow-hidden"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="corner-decoration top-left" />
            <div className="corner-decoration bottom-right" />

            <div className="flex items-center gap-3 mb-4">
              <div className={`w-3 h-3 rounded-full ${
                match_level === 'High' ? 'bg-accent-emerald' :
                match_level === 'Medium' ? 'bg-accent-amber' : 'bg-accent-rose'
              }`} />
              <h3 className="text-xl font-bold text-white">AI Summary</h3>
            </div>

            <div className="space-y-4">
              {/* Evaluation Breakdown */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <h4 className="text-sm font-semibold text-accent-cyan mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  How Your Score Was Calculated
                </h4>
                <ul className="space-y-2 text-sm text-white/60">
                  <li className="flex items-start gap-2">
                    <span className="text-accent-emerald mt-1">•</span>
                    <span><strong className="text-white">Semantic Match (40%):</strong> AI compared your resume skills against job requirements using NLP embeddings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent-emerald mt-1">•</span>
                    <span><strong className="text-white">Skill Verification (30%):</strong> Cross-referenced with GitHub activity, projects, and commits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent-emerald mt-1">•</span>
                    <span><strong className="text-white">Project Depth (20%):</strong> Analyzed repository quality and contribution patterns</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent-emerald mt-1">•</span>
                    <span><strong className="text-white">Completeness (10%):</strong> Profile info, contact details, and documentation</span>
                  </li>
                </ul>
              </div>

              {/* Strengths */}
              <div className="p-4 rounded-xl bg-accent-emerald/5 border border-accent-emerald/20">
                <h4 className="text-sm font-semibold text-accent-emerald mb-2">Your Strengths</h4>
                <ul className="space-y-1 text-sm text-white/70">
                  {(verifiedSkills || []).length > 0 && (
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-accent-emerald" />
                      <span>{verifiedSkills.length} skills verified through GitHub and project evidence</span>
                    </li>
                  )}
                  {(projects || []).length > 0 && (
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-accent-emerald" />
                      <span>{projects.length} project{(projects || []).length !== 1 ? 's' : ''} successfully analyzed</span>
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-accent-emerald" />
                    <span>Resume parsed with {extractedSkills?.length || 0} technical skills detected</span>
                  </li>
                </ul>
              </div>

              {/* Improvements Needed */}
              {match_level !== 'High' && (
                <div className="p-4 rounded-xl bg-accent-amber/5 border border-accent-amber/20">
                  <h4 className="text-sm font-semibold text-accent-amber mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Areas to Improve
                  </h4>
                  <ul className="space-y-1 text-sm text-white/70">
                    {matchPercentage < 70 && (
                      <li className="flex items-start gap-2">
                        <span className="text-accent-amber mt-1">→</span>
                        <span>Add more skills matching the job requirements — your match score is {matchPercentage}%</span>
                      </li>
                    )}
                    {(verifiedSkills || []).length < (extractedSkills?.length || 0) && (
                      <li className="flex items-start gap-2">
                        <span className="text-accent-amber mt-1">→</span>
                        <span>Get more skills verified by linking GitHub repositories with actual implementations</span>
                      </li>
                    )}
                    {(projects || []).length < 3 && (
                      <li className="flex items-start gap-2">
                        <span className="text-accent-amber mt-1">→</span>
                        <span>Add more documented projects — showing {3 - (projects?.length || 0)} more would strengthen your profile</span>
                      </li>
                    )}
                    <li className="flex items-start gap-2">
                      <span className="text-accent-amber mt-1">→</span>
                      <span>Include action verbs and quantifiable achievements in your project descriptions</span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              <div className="p-4 rounded-xl bg-accent-purple/5 border border-accent-purple/20">
                <h4 className="text-sm font-semibold text-accent-purple mb-2">Recommended Next Steps</h4>
                <ol className="space-y-2 text-sm text-white/70">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <span>Add more projects or update existing repositories to match job tech stack</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <span>Ensure GitHub profile showcases diverse commits and meaningful contributions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center text-xs font-bold shrink-0">3</span>
                    <span>Tailor your resume with keywords from the job description before applying</span>
                  </li>
                </ol>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <Link
                to="/candidate/upload"
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-accent-purple/30 text-white font-medium transition-all flex items-center gap-2"
              >
                Upload Another Resume
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;