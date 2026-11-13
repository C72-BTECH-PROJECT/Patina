import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../Button';

function RequireRole({ role, children }) {
  const { user, loading, unreachable, retrySession } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-background" aria-label="Loading" />;
  }

  // The session check got no answer (server down, gateway 503): not signed out, so no redirect.
  if (!user && unreachable) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" data-testid="session-unreachable">
        <div className="card p-6 max-w-sm text-center">
          <p className="text-body font-medium text-foreground mb-2">Could not reach the server</p>
          <p className="text-body-sm text-muted-foreground mb-4">Your sign-in could not be checked. Check your connection and try again.</p>
          <Button onClick={retrySession}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.role !== role) {
    const destination = user.role === 'ADMIN'
      ? '/admin/dashboard'
      : user.role === 'RECRUITER'
        ? '/recruiter/dashboard'
        : '/candidate/dashboard';
    return <Navigate to={destination} replace />;
  }

  return children;
}

export default RequireRole;
