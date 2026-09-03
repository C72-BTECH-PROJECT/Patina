import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, ShieldAlert, MailCheck } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000';

// Pull the Supabase recovery credentials out of the URL that the reset email
// links to. Supabase either appends `#access_token=...&refresh_token=...&type=recovery`
// (redirect-hash flow) or `?token_hash=...&type=recovery` (OTP template).
const parseRecoveryParams = () => {
  const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  const hashParams = new URLSearchParams(rawHash);
  const queryParams = new URLSearchParams(window.location.search);

  const errorDescription =
    hashParams.get('error_description') || queryParams.get('error_description');
  if (errorDescription) return { error: errorDescription };

  const type = hashParams.get('type') || queryParams.get('type');
  const tokenHash = queryParams.get('token_hash') || hashParams.get('token_hash');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (type && type !== 'recovery') return null;
  if (tokenHash) return { tokenHash };
  if (accessToken && refreshToken) return { accessToken, refreshToken };
  return null;
};

function ResetPassword() {
  const [recovery, setRecovery] = useState(null);
  const [linkError, setLinkError] = useState('');

  const [identifier, setIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const parsed = parseRecoveryParams();
    if (parsed?.error) {
      setLinkError('This reset link is invalid or has expired. Request a new one below.');
    } else if (parsed) {
      setRecovery(parsed);
    }
    // Strip the tokens from the address bar / history once captured.
    if (window.location.hash || window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const inRecoveryMode = Boolean(recovery);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Could not send a reset link. Try again shortly.');
      } else {
        setMessage(
          data.message ||
            'If an account matches that information, a reset link is on its way. Check your inbox and spam folder.'
        );
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword,
          tokenHash: recovery.tokenHash,
          accessToken: recovery.accessToken,
          refreshToken: recovery.refreshToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Failed to update password.');
        if (res.status === 400) setRecovery(null);
      } else {
        setMessage(data.message || 'Password updated. You can now sign in.');
        setRecovery(null);
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <motion.header
        className="flex justify-between items-center py-4 px-6 border-b border-border"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 flex items-center justify-center bg-primary rounded-md">
            <Lock className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">PATINA</span>
        </Link>
        <Link to="/login" className="text-body-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Login
        </Link>
      </motion.header>

      <main className="flex-1 flex justify-center items-center py-8 px-6">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="card p-8">
            <div className="text-center mb-8">
              <h1 className="text-h2 text-foreground mb-1">
                {inRecoveryMode ? 'Choose a New Password' : 'Reset Password'}
              </h1>
              <p className="text-body-sm text-muted-foreground">
                {inRecoveryMode
                  ? 'Enter a new password for your account.'
                  : 'Enter your username or email and we will send a reset link to the email on file.'}
              </p>
            </div>

            {message && (
              <div className="mb-6 flex gap-3 rounded-md border border-border bg-success/10 p-4 text-left text-sm text-success">
                <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <p className="leading-5">{message}</p>
              </div>
            )}
            {(error || linkError) && (
              <div role="alert" className="mb-6 flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-left">
                <span className="mt-0.5 rounded-md bg-destructive/15 p-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    {linkError && !error ? 'Link problem' : 'Error'}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-destructive/75">{error || linkError}</p>
                </div>
              </div>
            )}

            {inRecoveryMode ? (
              <form onSubmit={handleSetNewPassword} className="space-y-4">
                <div>
                  <label className="block text-body-sm font-medium text-foreground mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-body-sm font-medium text-foreground mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </div>
                <SubmitButton isLoading={isLoading} label="Update Password" />
              </form>
            ) : message ? null : (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label className="block text-body-sm font-medium text-foreground mb-1.5">Username or Email</label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your username or email"
                    required
                    autoComplete="username"
                    className={inputClass}
                  />
                </div>
                <SubmitButton isLoading={isLoading} label="Send Reset Link" />
              </form>
            )}

            <div className="mt-6 text-center text-body-sm text-muted-foreground">
              Remember your password?{' '}
              <Link to="/login" className="text-foreground font-medium hover:text-foreground/80 transition-colors">
                Log in
              </Link>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function SubmitButton({ isLoading, label }) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-body-sm hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
    >
      {isLoading ? (
        <motion.div
          className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      ) : (
        <>
          {label}
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
}

export default ResetPassword;
