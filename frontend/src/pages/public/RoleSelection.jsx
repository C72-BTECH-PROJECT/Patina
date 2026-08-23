import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Building2, ArrowRight, Zap } from 'lucide-react';

// Glow Orb Component
const GlowOrb = ({ className }) => (
  <div className={`absolute w-96 h-96 rounded-full filter blur-3xl opacity-20 ${className}`}>
    <div className={`w-full h-full rounded-full bg-gradient-to-br from-accent-purple/40 to-accent-cyan/30 animate-glow-pulse`} />
  </div>
);

// Role Card Component
const RoleCard = ({ to, icon: Icon, title, description, delay, color, emoji }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <Link
      to={to}
      className="group relative block glass-card p-10 text-center no-underline overflow-hidden border border-white/50 hover:border-white/80 transition-colors"
    >
      {/* Corner Decorations */}
      <div className="corner-decoration top-left" />
      <div className="corner-decoration bottom-right" />

      {/* Hover Glow Effect */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${color}20, transparent 70%)`,
        }}
      />

      {/* Animated Border */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.3), transparent 50%, rgba(255,255,255,0.3))`,
        }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      />

      {/* Icon */}
      <motion.div
        className="relative w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
        whileHover={{ scale: 1.1, rotate: 5 }}
      >
        <Icon className="w-10 h-10" style={{ color }} />
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            boxShadow: `0 0 30px ${color}40`,
          }}
        />
      </motion.div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-white transition-colors">
        {title}
      </h2>

      {/* Description */}
      <p className="text-white/50 leading-relaxed mb-6">
        {description}
      </p>

      {/* CTA */}
      <motion.div
        className="inline-flex items-center gap-2 text-sm font-medium"
        style={{ color }}
        animate={{ x: [0, 5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        Get Started
        <ArrowRight className="w-4 h-4" />
      </motion.div>

      {/* Bottom Accent Line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.3 }}
      />
    </Link>
  </motion.div>
);

// Main RoleSelection Component
function RoleSelection() {
  return (
    <div className="min-h-screen bg-background text-white relative overflow-hidden">
      {/* Noise Overlay */}
      <div className="noise-overlay" />

      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <GlowOrb className="top-[-10%] left-[-10%]" />
      <GlowOrb className="bottom-[-10%] right-[-10%]" />

      {/* Floating Particles */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-accent-purple rounded-full opacity-30"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
          }}
          animate={{
            y: [0, -60, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 5 + Math.random() * 3,
            delay: i * 0.2,
            repeat: Infinity,
          }}
        />
      ))}

      {/* Header */}
      <motion.header
        className="relative z-10 flex justify-between items-center py-6 px-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link to="/" className="flex items-center gap-3 no-underline group">
          <span className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-accent-purple to-accent-cyan rounded-xl group-hover:shadow-glow-purple transition-shadow">
            <Zap className="w-5 h-5 text-white" />
          </span>
          <span className="font-extrabold tracking-tight text-2xl">PATINA</span>
        </Link>

        <Link
          to="/"
          className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-2"
        >
          ← Back to Home
        </Link>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex justify-center items-center min-h-[calc(100vh-80px)] py-12 px-6">
        <div className="max-w-4xl w-full text-center">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
              How would you like to use <span className="gradient-text">PATINA</span>?
            </h1>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Choose your role to get started with the most advanced AI-powered skill verification platform.
            </p>
          </motion.div>

          {/* Role Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <RoleCard
              to="/login/candidate"
              icon={User}
              title="I'm a Candidate"
              description="Connect your GitHub, upload your resume, and verify your skills to stand out to top employers with AI-powered credibility scores."
              delay={0.2}
              color="#8b5cf6"
            />

            <RoleCard
              to="/login/recruiter"
              icon={Building2}
              title="I'm a Recruiter"
              description="Review verified candidate profiles, credibility scores, and make data-driven hiring decisions with real-time analytics."
              delay={0.4}
              color="#06b6d4"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default RoleSelection;