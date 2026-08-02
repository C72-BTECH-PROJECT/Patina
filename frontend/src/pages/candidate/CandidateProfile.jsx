import React from "react";
import { Link } from "react-router-dom";
import { FileUp, Mail, MapPin, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function CandidateProfile() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-white/60">Loading profile...</div>;
  }

  if (!user) {
    return <div className="text-white/60">Please sign in to view your profile.</div>;
  }

  return (
    <div className="glass-card p-8 relative overflow-hidden">
      <div className="corner-decoration top-left" />
      <div className="corner-decoration bottom-right" />

      <h1 className="text-2xl font-bold text-white mb-6">My Profile</h1>

      <div className="space-y-4 mb-8">
        <div className="flex items-center gap-3 text-white/80">
          <User className="w-5 h-5 text-accent-purple" />
          <span>{user.name || "Unnamed Candidate"}</span>
        </div>
        <div className="flex items-center gap-3 text-white/80">
          <Mail className="w-5 h-5 text-accent-cyan" />
          <span>{user.email}</span>
        </div>
        <div className="flex items-center gap-3 text-white/80">
          <MapPin className="w-5 h-5 text-accent-emerald" />
          <span>{user.location || "Location not set"}</span>
        </div>
      </div>

      <Link
        to="/candidate/upload"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold no-underline hover:shadow-glow-purple transition-all"
      >
        <FileUp className="w-5 h-5" />
        Upload / Update Resume
      </Link>
    </div>
  );
}

export default CandidateProfile;
