import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, ArrowRight, ShieldAlert } from 'lucide-react';

function ResetPassword() {
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
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
      const res = await fetch('http://localhost:5000/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to update password.');
      } else {
        setMessage(data.message || 'Password updated successfully.');
      }
    } catch (err) {
      setError('Failed to connect to server.');
    } finally {
      setIsLoading(false);
    }
  };

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
              <h1 className="text-h2 text-foreground mb-1">Reset Password</h1>
              <p className="text-body-sm text-muted-foreground">
                Enter your username and new password to reset your account.
              </p>
            </div>

            {message && (
              <div className="mb-6 p-4 rounded-md bg-success/10 border border-border text-success text-sm">
                {message}
              </div>
            )}
            {error && (
              <div role="alert" className="mb-6 flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-left">
                <span className="mt-0.5 rounded-md bg-destructive/15 p-2 text-destructive"><ShieldAlert className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm font-semibold text-destructive">Error</p>
                  <p className="mt-1 text-sm leading-5 text-destructive/75">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-body-sm font-medium text-foreground mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="block text-body-sm font-medium text-foreground mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

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
                    Reset Password
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

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

export default ResetPassword;
