import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, LayoutDashboard, Briefcase, Plus, LogOut, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function RecruiterLayout() {
  const { user, logout } = useAuth();
  const navItems = [
    { to: '/recruiter/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/recruiter/applications', icon: Users, label: 'Applications' },
    { to: '/recruiter/jobs', icon: Briefcase, label: 'Jobs' },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 px-6 py-3 border-b border-border bg-background/80 backdrop-blur-md"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/recruiter/dashboard" className="flex items-center gap-2.5 no-underline">
            <div className="w-7 h-7 flex items-center justify-center bg-primary rounded-md">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight text-foreground">PATINA</span>
            <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
              Recruiter
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all no-underline"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>

          {/* R-15: the search box (no state, no handler) and the bell (no handler,
              permanent unread dot; recruiters receive no notifications) are removed. */}
          <div className="flex items-center gap-3">
            <Link
              to="/recruiter/create-job"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors no-underline"
            >
              <Plus className="w-4 h-4" />
              Create Job
            </Link>

            <Link
              to="/recruiter/profile"
              aria-label="Your profile"
              className="w-8 h-8 rounded-md bg-muted flex items-center justify-center font-semibold text-xs text-foreground border border-border hover:bg-muted/80 transition-all"
            >
              {(() => {
                const fullName = user?.name || user?.email || '';
                const parts = fullName.split(' ').filter(Boolean);
                const initials = parts.length >= 2
                  ? `${parts[0][0]}${parts[1][0]}`
                  : fullName.slice(0, 2);
                return initials.toUpperCase();
              })()}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </motion.nav>

      <main className="pt-20 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>

      <div className="fixed bottom-6 right-6 md:hidden z-50">
        <Link
          to="/recruiter/create-job"
          className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-md"
        >
          <Plus className="w-5 h-5 text-primary-foreground" />
        </Link>
      </div>
    </div>
  );
}

export default RecruiterLayout;
