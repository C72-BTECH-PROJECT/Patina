import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';

// The catch-all route (R-14): an unknown path says so instead of a blank page.
function NotFound() {
  const location = useLocation();

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="card p-10 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-5">
          <Compass className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-h2 text-foreground mb-2">Page not found</h1>
        <p className="text-body-sm text-muted-foreground mb-6 break-words">
          There is no page at <span className="text-foreground font-medium">{location.pathname}</span>.
        </p>
        <Link to="/" className="btn btn-primary">
          Go to the home page
        </Link>
      </div>
    </main>
  );
}

export default NotFound;
