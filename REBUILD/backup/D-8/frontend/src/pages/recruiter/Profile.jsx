import React from 'react';
import { Briefcase, LogOut, Mail, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// R-15: roles arrive uppercase from /api/auth/me (auth.controller.js formatProfile),
// so the guard compares against 'RECRUITER' (it compared lowercase and always said
// "unavailable"). The hardcoded "5 Jobs Posted" / "2 Candidates Hired", the
// Verified badge (the backend sends no such field) and the handler-less
// "Edit Profile" button are removed. Only fields the backend sends are shown.

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

function RecruiterProfileCard() {
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

  if (!user || user.role !== 'RECRUITER') {
    return <div className="text-muted-foreground">Recruiter profile is unavailable.</div>;
  }

  const initials = user.name ? initialsOf(user.name) : '';

  return (
    <div className="card p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        {initials && (
          <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center font-bold text-xl text-foreground">
            {initials}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">{user.name || user.username}</h1>
          <p className="text-muted-foreground">Recruiter</p>
        </div>
      </div>

      <dl className="space-y-4 mb-8">
        <div className="flex items-center gap-3">
          <dt className="flex items-center gap-2 w-28 text-sm text-muted-foreground">
            <User className="w-4 h-4" /> Username
          </dt>
          <dd className="text-foreground">{user.username}</dd>
        </div>
        <div className="flex items-center gap-3">
          <dt className="flex items-center gap-2 w-28 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" /> Email
          </dt>
          <dd className="text-foreground">{user.email}</dd>
        </div>
        <div className="flex items-center gap-3">
          <dt className="flex items-center gap-2 w-28 text-sm text-muted-foreground">
            <Briefcase className="w-4 h-4" /> Company
          </dt>
          <dd className={user.companyName ? 'text-foreground' : 'text-muted-foreground'}>
            {user.companyName || 'Not provided'}
          </dd>
        </div>
      </dl>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 rounded-md border border-input bg-background text-foreground text-sm font-medium flex items-center gap-2 hover:bg-muted transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default RecruiterProfileCard;
