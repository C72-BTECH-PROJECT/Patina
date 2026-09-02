import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, LayoutDashboard, Briefcase, Plus, Bell, Search, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function RecruiterLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const navItems = [
    { to: '/recruiter/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/recruiter/jobs', icon: Briefcase, label: 'Jobs' },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      alert(error.message || 'Could not sign out.');
    }
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

          <div className="flex items-center gap-3">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search candidates..."
                className="w-56 pl-9 pr-3 py-1.5 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button className="relative w-8 h-8 rounded-md bg-muted border border-border flex items-center justify-center hover:bg-muted/80 transition-all">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-destructive" />
            </button>

            <Link
              to="/recruiter/create-job"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors no-underline"
            >
              <Plus className="w-4 h-4" />
              Create Job
            </Link>

            <Link
              to="/recruiter/profile"
              className="w-8 h-8 rounded-md bg-muted flex items-center justify-center font-semibold text-xs text-foreground border border-border hover:bg-muted/80 transition-all"
            >
              AV
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
