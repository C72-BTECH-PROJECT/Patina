import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-background" aria-label="Loading" />;
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
