import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Briefcase, LayoutDashboard, LogOut, User, Bell, ListChecks, Trophy } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import PatinaMark from "../PatinaMark";

function CandidateLayout() {
  const { logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const navItems = [
    { to: "/candidate/dashboard", icon: LayoutDashboard, label: "My applications" },
    { to: "/candidate/jobs", icon: Briefcase, label: "Jobs" },
    { to: "/candidate/results", icon: Trophy, label: "Results" },
    { to: "/candidate/assessment", icon: ListChecks, label: "Assessment" },
    { to: "/candidate/profile", icon: User, label: "Profile" },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const data = await api.get('/api/notifications?unread=true');
        setUnreadCount(data?.unreadCount || 0);
      } catch (err) {
        console.error('Failed to fetch notifications:', err.message);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 left-0 right-0 z-50 h-[60px] px-6 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between">
          <Link to="/candidate/dashboard" className="flex items-center gap-2.5 no-underline">
            <PatinaMark size={28} />
            <span className="font-display font-bold text-[15px] tracking-[.14em] text-foreground">PATINA</span>
            <span className="font-mono text-[11px] uppercase tracking-[.06em] px-2 py-[5px] rounded-full border border-border bg-surface text-muted-foreground">
              Candidate
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  "relative flex items-center gap-2 h-[34px] px-3 rounded-md text-body-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors no-underline" +
                  (isActive ? " bg-surface text-foreground font-medium ring-1 ring-border after:content-[''] after:absolute after:left-3 after:right-3 after:-bottom-[13px] after:h-0.5 after:bg-primary" : "")
                }
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
            <Link
              to="/candidate/notifications"
              className="relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all no-underline"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
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
    </div>
  );
}

export default CandidateLayout;
