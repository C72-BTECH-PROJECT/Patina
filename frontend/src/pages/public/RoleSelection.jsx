import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Building2, ArrowRight, Zap } from 'lucide-react';

const RoleCard = ({ to, icon: Icon, title, description, delay, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <Link
      to={to}
      className="group relative block card p-8 text-center no-underline hover:border-foreground/20 transition-colors"
    >
      <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center bg-muted group-hover:bg-foreground/10 transition-colors">
        <Icon className="w-7 h-7 text-foreground" />
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-2">
        {title}
      </h2>

      <p className="text-body-sm text-muted-foreground leading-relaxed mb-5">
        {description}
      </p>

      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground group-hover:gap-2.5 transition-all">
        Get Started
        <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  </motion.div>
);

function RoleSelection() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <motion.header
        className="flex justify-between items-center py-4 px-6 border-b border-border"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 flex items-center justify-center bg-primary rounded-md">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">PATINA</span>
        </Link>

        <Link
          to="/"
          className="text-body-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Home
        </Link>
      </motion.header>

      <main className="flex-1 flex justify-center items-center min-h-[calc(100vh-73px)] py-12 px-6">
        <div className="max-w-3xl w-full text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-12"
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
              How would you like to use <span className="text-foreground">PATINA</span>?
            </h1>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Choose your role to get started with the most advanced AI-powered skill verification platform.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RoleCard
              to="/signup"
              icon={User}
              title="I'm a Candidate"
              description="Connect your GitHub, upload your resume, and verify your skills to stand out to top employers with AI-powered credibility scores."
              delay={0.1}
              color="#0a0a0a"
            />

            <RoleCard
              to="/signup"
              icon={Building2}
              title="I'm a Recruiter"
              description="Review verified candidate profiles, credibility scores, and make data-driven hiring decisions with real-time analytics."
              delay={0.2}
              color="#0a0a0a"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default RoleSelection;
