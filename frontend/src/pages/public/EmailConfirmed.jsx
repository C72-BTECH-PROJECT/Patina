import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';

function EmailConfirmed() {
  return (
    <main className="min-h-screen bg-background text-white flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-2xl">
        <CheckCircle2 className="mx-auto mb-5 h-14 w-14 text-accent-emerald" />
        <h1 className="text-2xl font-bold">Email confirmed</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Your Patina account is verified. You can now sign in with your username and password.
        </p>
        <Link
          to="/login"
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-purple px-5 py-3 font-semibold text-white transition hover:brightness-110"
        >
          <Mail className="h-4 w-4" />
          Go to sign in
        </Link>
      </section>
    </main>
  );
}

export default EmailConfirmed;
