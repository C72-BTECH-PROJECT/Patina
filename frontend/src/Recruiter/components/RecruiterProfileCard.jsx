import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Briefcase, Users, Zap, Edit2 } from 'lucide-react';

function RecruiterProfileCard({ recruiter }) {
  if (!recruiter) return null;

  return (
    <div className="glass-card p-8 relative overflow-hidden">
      <div className="corner-decoration top-left" />
      <div className="corner-decoration bottom-right" />

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <motion.div
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center font-bold text-2xl text-white"
            whileHover={{ scale: 1.05 }}
          >
            {recruiter.name?.split(' ').map(n => n[0]).join('') || 'R'}
          </motion.div>

          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {recruiter.name}
            </h1>
            <p className="text-white/50">{recruiter.email}</p>
          </div>
        </div>

        {/* Status Badge */}
        <motion.div
          className={`px-4 py-2 rounded-full flex items-center gap-2 ${
            recruiter.isVerified
              ? 'bg-accent-emerald/20 border border-accent-emerald/30'
              : 'bg-accent-amber/20 border border-accent-amber/30'
          }`}
          whileHover={{ scale: 1.05 }}
        >
          {recruiter.isVerified ? (
            <>
              <CheckCircle className="w-4 h-4 text-accent-emerald" />
              <span className="text-sm font-semibold text-accent-emerald">Verified</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-accent-amber" />
              <span className="text-sm font-semibold text-accent-amber">Not Verified</span>
            </>
          )}
        </motion.div>
      </div>

      {/* Company Info */}
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Briefcase className="w-4 h-4 text-accent-purple" />
          <span className="text-sm text-white/40">Company</span>
        </div>
        <p className="text-lg font-semibold text-white">
          {recruiter.companyName}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <motion.div
          className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center"
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Briefcase className="w-4 h-4 text-accent-purple" />
          </div>
          <p className="text-2xl font-bold text-white">5</p>
          <p className="text-xs text-white/40">Jobs Posted</p>
        </motion.div>

        <motion.div
          className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center"
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="w-4 h-4 text-accent-emerald" />
          </div>
          <p className="text-2xl font-bold text-accent-emerald">2</p>
          <p className="text-xs text-white/40">Candidates Hired</p>
        </motion.div>
      </div>

      {/* Warning Banner */}
      {!recruiter.isVerified && (
        <motion.div
          className="p-4 rounded-xl bg-accent-amber/10 border border-accent-amber/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-accent-amber flex-shrink-0" />
            <p className="text-sm text-accent-amber">
              Your account is not verified. Some features may be limited.
            </p>
          </div>
        </motion.div>
      )}

      {/* Edit Profile Button */}
      <motion.div className="mt-6 flex justify-end">
        <motion.button
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium flex items-center gap-2 hover:bg-white/10 transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Edit2 className="w-4 h-4" />
          Edit Profile
        </motion.button>
      </motion.div>
    </div>
  );
}

export default RecruiterProfileCard;