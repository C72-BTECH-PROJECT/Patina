import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileUp, LogOut, Mail, User, AtSign } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

// R-15 (F24): the account has no location field, so the permanent "Location not
// set" row is gone. Only fields the backend sends (auth.controller.js formatProfile)
// are shown.
function CandidateProfile() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    // AuthContext.logout never throws; it clears the user whatever the server says.
    await logout();
    navigate('/', { replace: true });
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading profile...</div>;
  }

  if (!user) {
    return <div className="text-muted-foreground">Please sign in to view your profile.</div>;
  }

  return (
    <div className="card p-8">
      <h1 className="text-h1 text-foreground mb-6">My Profile</h1>

      <div className="space-y-4 mb-8">
        <div className="flex items-center gap-3 text-foreground">
          <User className="w-5 h-5" aria-hidden="true" />
          <span>{user.name || <span className="text-muted-foreground">No name on this account</span>}</span>
        </div>
        <div className="flex items-center gap-3 text-foreground">
          <AtSign className="w-5 h-5" aria-hidden="true" />
          <span>{user.username}</span>
        </div>
        <div className="flex items-center gap-3 text-foreground">
          <Mail className="w-5 h-5" aria-hidden="true" />
          <span>{user.email}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/candidate/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-body-sm hover:bg-primary-hover active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus transition-colors no-underline"
        >
          <FileUp className="w-4 h-4" />
          Upload / Update Resume
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-foreground font-medium text-body-sm hover:bg-muted transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default CandidateProfile;
