import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileUp, LogOut, Mail, MapPin, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function CandidateProfile() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      alert(error.message || 'Could not sign out.');
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading profile...</div>;
  }

  if (!user) {
    return <div className="text-muted-foreground">Please sign in to view your profile.</div>;
  }

  return (
    <div className="card p-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">My Profile</h1>

      <div className="space-y-4 mb-8">
        <div className="flex items-center gap-3 text-foreground">
          <User className="w-5 h-5" />
          <span>{user.name || "Unnamed Candidate"}</span>
        </div>
        <div className="flex items-center gap-3 text-foreground">
          <Mail className="w-5 h-5" />
          <span>{user.email}</span>
        </div>
        <div className="flex items-center gap-3 text-foreground">
          <MapPin className="w-5 h-5" />
          <span>{user.location || "Location not set"}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/candidate/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-body-sm hover:bg-primary/90 transition-colors no-underline"
        >
          <FileUp className="w-4 h-4" />
          Upload / Update Resume
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-foreground font-medium text-body-sm hover:bg-accent transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default CandidateProfile;
