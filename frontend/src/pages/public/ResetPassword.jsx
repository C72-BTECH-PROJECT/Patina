import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldAlert, MailCheck } from 'lucide-react';
import { api, isNetworkError } from '../../lib/api';
import PatinaMark from '../../components/PatinaMark';

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
      const data = await api.post('/api/auth/request-password-reset', { username: identifier });
      setMessage(
        data?.message ||
          'If an account matches that information, a reset link is on its way. Check your inbox and spam folder.'
      );
    } catch (err) {
      setError(isNetworkError(err)
        ? 'Failed to connect to the server.'
        : err.message || 'Could not send a reset link. Try again shortly.');
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
      const data = await api.post('/api/auth/reset-password', {
        newPassword,
        tokenHash: recovery.tokenHash,
        accessToken: recovery.accessToken,
        refreshToken: recovery.refreshToken,
      });
      setMessage(data?.message || 'Password updated. You can now sign in.');
      setRecovery(null);
    } catch (err) {
      if (isNetworkError(err)) {
        setError('Failed to connect to the server.');
      } else {
        setError(err.message || 'Failed to update password.');
        if (err.status === 400) setRecovery(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'flex h-11 w-full rounded-md border border-input bg-surface px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground hover:border-foreground focus:outline-none focus:border-primary focus:shadow-focus transition-[border-color,box-shadow] duration-150';

  return (
    <div className="min-h-screen auth-bg bg-background text-foreground flex flex-col">
      <header className="flex justify-between items-center py-4 px-6 border-b border-border">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <PatinaMark size={28} />
          <span className="font-display font-bold text-[15px] tracking-[.14em] text-foreground">PATINA</span>
        </Link>
        <Link to="/login" className="text-body-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Login
        </Link>
      </header>

      <main className="flex-1 flex justify-center items-center py-8 px-6">
        <div className="w-full max-w-md">
          <div className="card p-8 shadow-pop anim-rise">
            <div className="text-center mb-8">
              <h1 className="text-h1 text-foreground mb-1">
                {inRecoveryMode ? 'Choose a New Password' : 'Reset Password'}
              </h1>
              <p className="text-body-sm text-muted-foreground">
                {inRecoveryMode
                  ? 'Enter a new password for your account.'
                  : 'Enter your username or email and we will send a reset link to the email on file.'}
              </p>
            </div>

            {message && (
              <div className="mb-6 flex gap-3 rounded-lg border border-primary/20 bg-primary-soft p-3.5 text-left text-sm text-primary">
                <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <p className="leading-5">{message}</p>
              </div>
            )}
            {(error || linkError) && (
              <div role="alert" className="mb-6 flex gap-3 rounded-lg border border-destructive/25 bg-destructive/10 p-3.5 text-left">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive/[.12] text-destructive">
                  <ShieldAlert className="h-[18px] w-[18px]" />
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

            <div className="mt-6 border-t border-border pt-5 text-center text-body-sm text-muted-foreground">
              Remember your password?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline underline-offset-[3px]">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SubmitButton({ isLoading, label }) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium text-body-sm shadow-xs hover:bg-primary-hover transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
    >
      {isLoading ? (
        <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
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
