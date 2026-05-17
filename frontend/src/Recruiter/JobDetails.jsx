import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Briefcase, MapPin, Filter, Users, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react';
import { jobs, applications, candidates } from './data/mockData';
import CandidateModal from './components/CandidateModal';

// Glow Orb Component
const GlowOrb = ({ className }) => (
  <div className={`absolute w-96 h-96 rounded-full filter blur-3xl opacity-10 ${className}`}>
    <div className={`w-full h-full rounded-full bg-gradient-to-br from-accent-purple/40 to-accent-cyan/30 animate-glow-pulse`} />
  </div>
);

// Tab Button Component
const TabButton = ({ label, active, onClick, count }) => (
  <motion.button
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
      active
        ? 'bg-gradient-to-r from-accent-purple to-accent-cyan text-white'
        : 'bg-white/5 text-white/50 hover:bg-white/10'
    }`}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    {label} {count !== undefined && <span className="ml-1 opacity-60">({count})</span>}
  </motion.button>
);

// Score Range Slider Component
const ScoreSlider = ({ value, onChange }) => (
  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
    <div className="flex items-center justify-between mb-2">
      <label className="text-sm font-medium text-white/70 flex items-center gap-2">
        <Filter className="w-4 h-4 text-accent-purple" />
        Minimum Score: <span className="text-accent-purple font-bold">{value}+</span>
      </label>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-accent-purple [&::-webkit-slider-thumb]:to-accent-cyan"
    />
  </div>
);

// Candidate Row Component
const CandidateRow = ({ app, candidate, onClick, index }) => {
  const scoreColor =
    app.credibilityScore >= 80 ? 'accent-emerald' :
    app.credibilityScore >= 60 ? 'accent-amber' : 'accent-rose';

  const statusIcon = {
    shortlisted: <CheckCircle className="w-4 h-4 text-accent-emerald" />,
    rejected: <XCircle className="w-4 h-4 text-accent-rose" />,
    applied: <Clock className="w-4 h-4 text-accent-amber" />,
  };

  const statusColor = {
    shortlisted: 'bg-accent-emerald/20 border-accent-emerald/30 text-accent-emerald',
    rejected: 'bg-accent-rose/20 border-accent-rose/30 text-accent-rose',
    applied: 'bg-accent-amber/20 border-accent-amber/30 text-accent-amber',
  };

  return (
    <motion.div
      className="glass-card p-5 relative group cursor-pointer"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.01, x: 4 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-purple/30 to-accent-cyan/30 flex items-center justify-center font-bold text-white">
            {candidate?.name?.charAt(0) || '?'}
          </div>

          {/* Info */}
          <div>
            <h3 className="font-bold text-white mb-1">{candidate?.name || 'Unknown'}</h3>
            <div className="flex items-center gap-3 text-sm">
              <span className={`font-bold text-${scoreColor}`}>
                Score: {app.credibilityScore}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1 ${statusColor[app.status]}`}>
                {statusIcon[app.status]}
                {app.status}
              </span>
            </div>
          </div>
        </div>

        {/* View Button */}
        <motion.button
          onClick={onClick}
          className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-accent-purple/20 hover:border-accent-purple/30 transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          View Profile
        </motion.button>
      </div>
    </motion.div>
  );
};

// Main JobDetails Component
function JobDetails() {
  const { id } = useParams();
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [filterScore, setFilterScore] = useState(0);
  const [activeTab, setActiveTab] = useState('all');

  const job = jobs.find((j) => j._id === id);
  const apps = applications.filter((a) => a.job === id);

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="glass-card p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Job Not Found</h2>
          <Link to="/recruiter/jobs" className="text-accent-purple hover:text-accent-cyan">
            ← Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  // Filter + Sort Logic
  const filteredApps = apps
    .filter((app) => {
      if (filterScore > 0 && app.credibilityScore < filterScore) return false;
      if (activeTab !== 'all' && app.status !== activeTab) return false;
      return true;
    })
    .sort((a, b) => b.credibilityScore - a.credibilityScore);

  const statusCounts = {
    all: apps.length,
    applied: apps.filter((a) => a.status === 'applied').length,
    shortlisted: apps.filter((a) => a.status === 'shortlisted').length,
    rejected: apps.filter((a) => a.status === 'rejected').length,
  };

  return (
    <div className="relative">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
      <GlowOrb className="top-[-10%] left-[-10%]" />

      <div className="relative z-10">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link
            to="/recruiter/jobs"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors no-underline group"
          >
            <motion.span
              animate={{ x: [0, -5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ←
            </motion.span>
            <span>Back to Jobs</span>
          </Link>
        </motion.div>

        {/* Job Info Card */}
        <motion.div
          className="glass-card p-8 mt-6 relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="corner-decoration top-left" />
          <div className="corner-decoration bottom-right" />

          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-3">{job.title}</h1>
              <p className="text-white/50 mb-4 max-w-2xl">{job.description}</p>

              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm font-medium flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {job.experienceLevel}
                </span>

                {job.requiredSkills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-lg bg-accent-purple/20 border border-accent-purple/30 text-accent-purple text-sm font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-3xl font-extrabold text-accent-purple">{apps.length}</div>
                <div className="text-sm text-white/40">Total Candidates</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters & Tabs */}
        <motion.div
          className="glass-card p-6 mt-6 relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="corner-decoration top-left" />
          <div className="corner-decoration bottom-right" />

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {['all', 'applied', 'shortlisted', 'rejected'].map((tab) => (
              <TabButton
                key={tab}
                label={tab.charAt(0).toUpperCase() + tab.slice(1)}
                active={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                count={statusCounts[tab]}
              />
            ))}
          </div>

          {/* Score Filter */}
          <ScoreSlider value={filterScore} onChange={setFilterScore} />
        </motion.div>

        {/* Results */}
        <motion.div
          className="mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-cyan" />
            Showing {filteredApps.length} Candidates
          </h2>

          <div className="grid gap-4">
            <AnimatePresence>
              {filteredApps.map((app, index) => {
                const candidate = candidates.find((c) => c._id === app.candidate);
                return (
                  <CandidateRow
                    key={app._id}
                    app={app}
                    candidate={candidate}
                    index={index}
                    onClick={() =>
                      setSelectedCandidate({
                        ...app,
                        ...candidate,
                      })
                    }
                  />
                );
              })}
            </AnimatePresence>

            {/* Empty State */}
            {filteredApps.length === 0 && (
              <motion.div
                className="glass-card p-12 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-white/30" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Candidates Found</h3>
                <p className="text-white/50">
                  Try adjusting your filters or check back later.
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedCandidate && (
          <CandidateModal
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default JobDetails;