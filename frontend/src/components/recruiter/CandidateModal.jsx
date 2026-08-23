import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, MapPin, CheckCircle, AlertCircle, Star, GitCommit, Folder, Trophy, FileText, Clock, Zap } from 'lucide-react';

// GitHub Icon SVG Component
const GithubIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

// Glow Orb Component
const GlowOrb = ({ className }) => (
  <div className={`absolute w-96 h-96 rounded-full filter blur-3xl opacity-20 ${className}`}>
    <div className={`w-full h-full rounded-full bg-gradient-to-br from-accent-purple/40 to-accent-pink/30 animate-glow-pulse`} />
  </div>
);

// Score Circle Component
const ScoreCircle = ({ score }) => {
  const circumference = 2 * Math.PI * 50;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = () => {
    if (score >= 80) return { from: '#10b981', to: '#06b6d4' };
    if (score >= 60) return { from: '#f59e0b', to: '#f43f5e' };
    return { from: '#ef4444', to: '#f43f5e' };
  };

  const colors = getScoreColor();

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={`url(#modalGradient-${score})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
        <defs>
          <linearGradient id={`modalGradient-${score}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.from} />
            <stop offset="100%" stopColor={colors.to} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-3xl font-extrabold ${
          score >= 80 ? 'text-accent-emerald' : score >= 60 ? 'text-accent-amber' : 'text-accent-rose'
        }`}>
          {score}
        </span>
      </div>
    </div>
  );
};

// Main Modal Component
function CandidateModal({ candidate, onClose }) {
  if (!candidate) return null;

  const scoreColor = candidate.credibilityScore >= 80 ? 'accent-emerald' : candidate.credibilityScore >= 60 ? 'accent-amber' : 'accent-rose';

  return (
    <motion.div
      className="fixed inset-0 bg-background/80 backdrop-blur-xl z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <GlowOrb className="top-[-10%] left-[20%]" />
        <GlowOrb className="bottom-[-10%] right-[20%]" />
      </div>

      {/* Modal Content */}
      <motion.div
        className="bg-background rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden relative border border-white/10"
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Close Button */}
        <motion.button
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all z-10"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[90vh]">
          {/* Header */}
          <div className="p-8 pb-0">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-6">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center font-bold text-2xl text-white">
                  {candidate.name?.charAt(0) || '?'}
                </div>

                <div>
                  <h2 className="text-3xl font-extrabold text-white mb-2">{candidate.name}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/50">
                    {candidate.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {candidate.location}
                      </span>
                    )}
                    {candidate.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {candidate.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <ScoreCircle score={candidate.credibilityScore} />
                <span className="text-sm text-white/40 mt-2">Credibility Score</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 border-t border-white/5 pt-6 pb-8">
              <motion.button
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Zap className="w-4 h-4" />
                Send Offer
              </motion.button>
              <motion.button
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold flex items-center gap-2"
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
                whileTap={{ scale: 0.98 }}
              >
                <Mail className="w-4 h-4" />
                Contact
              </motion.button>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-8 pt-0 grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Skills */}
              <motion.div
                className="glass-card p-6 relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="corner-decoration top-left" />
                <div className="corner-decoration bottom-right" />

                <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-accent-emerald" />
                  Verified Skills
                </h3>

                <div className="space-y-3">
                  {candidate.skills?.map((skill, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 rounded-xl bg-white/[0.03] border border-white/5"
                    >
                      <span className="font-medium text-white">{skill.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-lg">
                          {skill.level}
                        </span>
                        {skill.verified ? (
                          <CheckCircle className="w-4 h-4 text-accent-emerald" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-accent-amber" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* GitHub */}
              <motion.div
                className="glass-card p-6 relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="corner-decoration top-left" />
                <div className="corner-decoration bottom-right" />

                <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                  <GithubIcon className="w-5 h-5 text-accent-cyan" />
                  GitHub Analysis
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <GitCommit className="w-4 h-4 text-accent-purple" />
                    </div>
                    <span className="block text-2xl font-extrabold text-white">
                      {candidate.github?.commits || 0}
                    </span>
                    <span className="text-xs text-white/40 uppercase tracking-wider">Commits</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Folder className="w-4 h-4 text-accent-cyan" />
                    </div>
                    <span className="block text-2xl font-extrabold text-white">
                      {candidate.github?.repos || 0}
                    </span>
                    <span className="text-xs text-white/40 uppercase tracking-wider">Repos</span>
                  </div>
                </div>

                <p className="text-sm text-white/40 mb-2">Top Languages:</p>
                <div className="flex flex-wrap gap-2">
                  {candidate.github?.languages?.map((l, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-lg bg-accent-purple/20 border border-accent-purple/30 text-accent-purple text-xs font-medium"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Assessment */}
            {candidate.assessment && (
              <motion.div
                className="glass-card p-6 relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="corner-decoration top-left" />
                <div className="corner-decoration bottom-right" />

                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-accent-amber" />
                    AI Assessment
                  </h3>
                  <span className="px-3 py-1 rounded-full bg-accent-emerald/20 border border-accent-emerald/30 text-accent-emerald text-sm font-bold">
                    {candidate.assessment.score}/100
                  </span>
                </div>

                <div className="space-y-4">
                  {candidate.assessment.categories?.map((cat, index) => (
                    <div key={index} className="flex flex-col">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-white/70">{cat.name}</span>
                        <span className="text-sm font-bold text-white">{cat.score}%</span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan"
                          initial={{ width: 0 }}
                          animate={{ width: `${cat.score}%` }}
                          transition={{ delay: 0.5 + index * 0.1, duration: 0.8 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Flags */}
            {candidate.flaggedInconsistencies && candidate.flaggedInconsistencies.length > 0 && (
              <motion.div
                className="p-6 rounded-xl bg-accent-amber/10 border border-accent-amber/20"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h3 className="font-bold text-accent-amber text-lg mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  AI Flagged Inconsistencies
                </h3>

                <div className="space-y-3">
                  {candidate.flaggedInconsistencies.map((flag, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-xl bg-background border border-white/10"
                    >
                      <p className="text-sm text-white/70 font-medium">{flag.description}</p>
                      <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${
                        flag.severity === 'high' ? 'bg-accent-rose/20 text-accent-rose' :
                        flag.severity === 'medium' ? 'bg-accent-amber/20 text-accent-amber' :
                        'bg-white/5 text-white/40'
                      }`}>
                        {flag.severity} severity
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default CandidateModal;