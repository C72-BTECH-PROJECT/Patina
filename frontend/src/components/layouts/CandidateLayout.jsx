import React, { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, LayoutDashboard, LogOut, User, Zap, Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function CandidateLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const navItems = [
    { to: "/candidate/dashboard", icon: LayoutDashboard, label: "About" },
    { to: "/candidate/jobs", icon: Briefcase, label: "Jobs" },
    { to: "/candidate/profile", icon: User, label: "Profile" },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/notifications?unread=true`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 px-6 py-3 border-b border-border bg-background/80 backdrop-blur-md"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/candidate/dashboard" className="flex items-center gap-2.5 no-underline">
            <div className="w-7 h-7 flex items-center justify-center bg-primary rounded-md">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight text-foreground">PATINA</span>
            <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
              Candidate
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all no-underline"
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
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
      </motion.nav>

      <main className="pt-20 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default CandidateLayout;
