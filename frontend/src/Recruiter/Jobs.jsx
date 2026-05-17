import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, Users, ChevronRight, Sparkles, Plus } from 'lucide-react';
import { jobs, applications } from './data/mockData';

// Glow Orb Component
const GlowOrb = ({ className }) => (
  <div className={`absolute w-96 h-96 rounded-full filter blur-3xl opacity-10 ${className}`}>
    <div className={`w-full h-full rounded-full bg-gradient-to-br from-accent-purple/40 to-accent-cyan/30 animate-glow-pulse`} />
  </div>
);

// Job Card Component
const JobCard = ({ job, count, index }) => (
  <motion.div
    className="glass-card p-6 relative group cursor-pointer"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    whileHover={{ scale: 1.02, y: -4 }}
  >
    <div className="corner-decoration top-left" />
    <div className="corner-decoration bottom-right" />

    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xl font-bold text-white truncate">{job.title}</h2>
          {count > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-accent-emerald/20 border border-accent-emerald/30 text-accent-emerald text-xs font-bold">
              {count} New
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {job.requiredSkills.map((skill, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-start md:items-end gap-3">
        <span className="text-sm text-white/40">{count} Applications Total</span>
        <Link
          to={`/recruiter/jobs/${job._id}`}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white text-sm font-medium flex items-center gap-2 hover:shadow-glow-purple transition-all no-underline"
        >
          View Candidates
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  </motion.div>
);

// Main Jobs Component
function Jobs() {
  return (
    <div className="relative">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
      <GlowOrb className="top-[-10%] right-[-5%]" />

      <div className="relative z-10">
        {/* Header */}
        <motion.div
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-accent-purple" />
              Posted Jobs
            </h1>
            <p className="text-white/50">Manage your active job listings and candidates</p>
          </div>

          <Link
            to="/recruiter/create-job"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white text-sm font-medium flex items-center gap-2 hover:shadow-glow-purple transition-all no-underline"
          >
            <Plus className="w-4 h-4" />
            Create New Job
          </Link>
        </motion.div>

        {/* Jobs Grid */}
        <div className="grid grid-cols-1 gap-6">
          {jobs.map((job, index) => {
            const count = applications.filter(a => a.job === job._id).length;

            return (
              <JobCard key={job._id} job={job} count={count} index={index} />
            );
          })}
        </div>

        {jobs.length === 0 && (
          <motion.div
            className="glass-card p-12 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-accent-purple/20 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-accent-purple" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Jobs Yet</h3>
            <p className="text-white/50 mb-6">Create your first job listing to start receiving candidates.</p>
            <Link
              to="/recruiter/create-job"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Job
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default Jobs;