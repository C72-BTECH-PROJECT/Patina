import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, LayoutDashboard, Briefcase, Plus, Bell, Search, User } from 'lucide-react';

function RecruiterLayout() {
  const navItems = [
    { to: '/recruiter/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/recruiter/jobs', icon: Briefcase, label: 'Jobs' },
  ];

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Noise Overlay */}
      <div className="noise-overlay" />

      {/* Background Grid */}
      <div className="fixed inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

      {/* Navigation */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-background/80"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link to="/recruiter/dashboard" className="flex items-center gap-3 no-underline group">
            <span className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-accent-purple to-accent-cyan rounded-xl group-hover:shadow-glow-purple transition-shadow">
              <Zap className="w-5 h-5 text-white" />
            </span>
            <span className="font-extrabold text-xl tracking-tight text-white">PATINA</span>
            <span className="text-xs text-white/40 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
              Recruiter
            </span>
          </Link>

          {/* Nav Items */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all no-underline"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search candidates..."
                className="w-64 pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent-purple/50 transition-all"
              />
            </div>

            {/* Notifications */}
            <motion.button
              className="relative w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Bell className="w-5 h-5 text-white/70" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-rose" />
            </motion.button>

            {/* Create Job Button */}
            <Link
              to="/recruiter/create-job"
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white text-sm font-medium hover:shadow-glow-purple transition-all no-underline"
            >
              <Plus className="w-4 h-4" />
              Create Job
            </Link>

            {/* Profile */}
            <Link
              to="/recruiter/profile"
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple/30 to-accent-cyan/30 flex items-center justify-center font-bold text-sm hover:border-accent-purple/50 border border-white/10 transition-all"
            >
              AV
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Create Job FAB */}
      <motion.div
        className="fixed bottom-6 right-6 md:hidden z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Link
          to="/recruiter/create-job"
          className="w-14 h-14 rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan flex items-center justify-center shadow-glow-purple"
        >
          <Plus className="w-6 h-6 text-white" />
        </Link>
      </motion.div>
    </div>
  );
}

export default RecruiterLayout;