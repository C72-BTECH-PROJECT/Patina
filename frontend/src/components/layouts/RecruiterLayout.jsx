import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Plus, LogOut, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PatinaMark from '../PatinaMark';

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
      <nav className="fixed top-0 left-0 right-0 z-50 h-[60px] px-6 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between">
          <Link to="/recruiter/dashboard" className="flex items-center gap-2.5 no-underline">
            <PatinaMark size={28} />
            <span className="font-display font-bold text-[15px] tracking-[.14em] text-foreground">PATINA</span>
            <span className="font-mono text-[11px] uppercase tracking-[.06em] px-2 py-[5px] rounded-full border border-border bg-surface text-muted-foreground">
              Recruiter
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  'relative flex items-center gap-2 h-[34px] px-3 rounded-md text-body-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors no-underline' +
                  (isActive ? " bg-surface text-foreground font-medium ring-1 ring-border after:content-[''] after:absolute after:left-3 after:right-3 after:-bottom-[13px] after:h-0.5 after:bg-primary" : '')
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
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
      </nav>

      <main className="pt-20 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="route-root">
            <Outlet />
          </div>
        </div>
      </main>

      <div className="fixed bottom-6 right-6 md:hidden z-50">
        <Link
          to="/recruiter/create-job"
          className="w-12 h-12 rounded-full bg-primary hover:bg-primary-hover flex items-center justify-center shadow-pop"
        >
          <Plus className="w-5 h-5 text-primary-foreground" />
        </Link>
      </div>
    </div>
  );
}

export default RecruiterLayout;
