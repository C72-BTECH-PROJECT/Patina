import React from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, LayoutDashboard, LogOut, User, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function CandidateLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const navItems = [
    { to: "/candidate/dashboard", icon: LayoutDashboard, label: "About" },
    { to: "/candidate/jobs", icon: Briefcase, label: "Jobs" },
    { to: "/candidate/profile", icon: User, label: "Profile" },
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
    <div className="min-h-screen bg-background text-white">
      <div className="noise-overlay" />
      <div className="fixed inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-background/80"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/candidate/dashboard" className="flex items-center gap-3 no-underline group">
            <span className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-accent-purple to-accent-cyan rounded-xl group-hover:shadow-glow-purple transition-shadow">
              <Zap className="w-5 h-5 text-white" />
            </span>
            <span className="font-extrabold text-xl tracking-tight text-white">PATINA</span>
            <span className="text-xs text-white/40 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
              Candidate
            </span>
          </Link>

          <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </motion.nav>

      <main className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default CandidateLayout;
