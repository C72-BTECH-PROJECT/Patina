import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';

function EmailConfirmed() {
  return (
    <main className="min-h-screen auth-bg bg-background text-foreground flex items-center justify-center px-6">
      <section className="w-full max-w-md card p-8 shadow-pop anim-rise text-center">
        <CheckCircle2 className="mx-auto mb-5 h-14 w-14 text-success" />
        <h1 className="text-2xl font-bold text-foreground">Email confirmed</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your Patina account is verified. You can now sign in with your username and password.
        </p>
        <Link
          to="/login"
          className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground font-medium text-body-sm shadow-xs hover:bg-primary-hover transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus no-underline"
        >
          <Mail className="h-4 w-4" />
          Go to sign in
        </Link>
      </section>
    </main>
  );
}

export default EmailConfirmed;
