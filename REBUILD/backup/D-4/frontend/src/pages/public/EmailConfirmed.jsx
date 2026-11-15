import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';

function EmailConfirmed() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-xl border border-border bg-background p-8 text-center">
        <CheckCircle2 className="mx-auto mb-5 h-14 w-14 text-success" />
        <h1 className="text-2xl font-bold text-foreground">Email confirmed</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your Patina account is verified. You can now sign in with your username and password.
        </p>
        <Link
          to="/login"
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground font-medium text-body-sm hover:bg-primary/90 transition-colors no-underline"
        >
          <Mail className="h-4 w-4" />
          Go to sign in
        </Link>
      </section>
    </main>
  );
}

export default EmailConfirmed;
