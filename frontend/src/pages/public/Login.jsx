import React, { useState, useEffect, useId } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, ShieldAlert, MailCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import PatinaMark from '../../components/PatinaMark';

// Where to send someone once they're authenticated. Roles arrive uppercase from
// /api/auth/me and /api/auth/login (auth.controller.js formatProfile).
const getDashboardPath = (userRole) =>
  userRole === 'ADMIN'
    ? '/admin/dashboard'
    : userRole === 'RECRUITER'
      ? '/recruiter/dashboard'
      : '/candidate/dashboard';

// R-15: the login error is one of three kinds, each with its own title, so a
// suspended account, an unconfirmed email and a wrong password never share a box.
const classifyLoginError = (err) => {
  if (err?.body?.code === 'ACCOUNT_SUSPENDED') return 'suspended';
  // auth.controller.js answers 403 (without the suspension code) only for an
  // account whose email has not been confirmed.
  if (err?.status === 403) return 'unconfirmed';
  return 'error';
};

// R-31: the sign-up body. The same five fields for every role: the form asks for no company
// or verification details (the profile columns stay; nothing writes them from here).
export const buildSignupPayload = ({ email, password, username, role, name }) => ({ email, password, username, role, name });

// R-31: the post-sign-up page's heading already says "Account created", so the server's message
// (auth.controller.js signup: "Account created. Check your email ...") is shown without that
// opening sentence. Nothing else in the message is changed.
export const signupFollowUp = (message) =>
  String(message || '').replace(/^\s*Account created(?: successfully)?\.\s*/i, '').trim();

const ERROR_TITLES = {
  suspended: 'Account access paused',
  unconfirmed: 'Email not confirmed',
  error: 'Could not sign in',
  signup: 'Could not create the account',
};

// Labelled input: the label is tied to the input by id, and `testId` lands on the input.
const AnimatedInput = ({ icon: Icon, label, type = 'text', value, onChange, placeholder, required, testId, autoComplete }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputId = useId();

  return (
    <div className="relative group">
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          data-testid={testId}
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete || (isPassword ? 'current-password' : type === 'email' ? 'email' : 'off')}
          className={`w-full bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all ${isPassword ? 'px-5 py-4 pr-12' : 'px-5 py-4 pl-12'}`}
        />
        {!isPassword && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        )}

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
};

// Sends POST /api/auth/resend-confirmation with the email the person typed (or the
// one they just signed up with). Reports the server's answer, success or failure.
const ResendConfirmation = ({ initialEmail = '' }) => {
  const [resendEmail, setResendEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok, message }
  const inputId = useId();

  const send = async (e) => {
    e.preventDefault();
    const target = resendEmail.trim();
    if (!target) {
      setResult({ ok: false, message: 'Enter the email address you signed up with.' });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const data = await api.post('/api/auth/resend-confirmation', { email: target });
      setResult({ ok: true, message: data?.message || 'Confirmation email sent.' });
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={send} className="space-y-2 text-left">
      <label htmlFor={inputId} className="block text-xs font-medium text-foreground">
        Resend the confirmation email to
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="email"
          value={resendEmail}
          onChange={(e) => setResendEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        <button
          type="submit"
          disabled={sending}
          className="h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {sending ? 'Sending...' : 'Resend'}
        </button>
      </div>
      {result && (
        <p role="status" className={`text-xs ${result.ok ? 'text-success' : 'text-destructive'}`}>
          {result.message}
        </p>
      )}
    </form>
  );
};

// Main Login Component
function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSignupPage = location.pathname === '/signup';
  const [isLogin, setIsLogin] = useState(!isSignupPage);
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '');
  const [authError, setAuthError] = useState(null); // { kind, message }
  const [showResend, setShowResend] = useState(false);
  const [signupDone, setSignupDone] = useState(null); // { email, message }

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [signupRole, setSignupRole] = useState('candidate');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login: loginWithSession, refreshUser, user, loading: authLoading } = useAuth();
  const roleSelectId = useId();

  const isRecruiter = signupRole === 'recruiter';

  useEffect(() => {
    setIsLogin(!isSignupPage);
    setSuccessMessage(location.state?.message || '');
    setAuthError(null);
    setShowResend(false);
    setSignupDone(null);
  }, [isSignupPage, location.state]);

  // Already logged in? Skip the form entirely instead of showing it again.
  useEffect(() => {
    if (!authLoading && user) {
      navigate(getDashboardPath(user.role), { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMessage('');
    setIsSubmitting(true);

    if (isLogin) {
      try {
        const loginResult = await loginWithSession({ username, password });
        await refreshUser();
        navigate(getDashboardPath(loginResult?.user?.role));
      } catch (err) {
        const kind = classifyLoginError(err);
        setAuthError({ kind, message: err.message });
        if (kind === 'unconfirmed') setShowResend(true);
        setIsSubmitting(false);
      }
      return;
    }

    const payload = buildSignupPayload({ email, password, username, role: signupRole, name });

    try {
      const data = await api.post('/api/auth/signup', payload);
      // Signup does not create a session (auth.controller.js signup). Show the
      // server's own message: with email confirmation on, it asks the person to
      // confirm before signing in.
      setSignupDone({ email: email.trim(), message: signupFollowUp(data?.message) });
    } catch (err) {
      setAuthError({ kind: 'signup', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    navigate(isLogin ? '/signup' : '/login');
  };

  const header = (
    <motion.header
      className="flex justify-between items-center py-4 px-6 border-b border-border"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <PatinaMark size={28} />
        <span className="font-display font-bold text-[15px] tracking-[.14em] text-foreground">PATINA</span>
      </Link>

      <Link
        to="/select-role"
        className="text-body-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back
      </Link>
    </motion.header>
  );

  if (signupDone) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {header}
        <main className="flex-1 flex justify-center items-center py-8 px-6">
          <div className="w-full max-w-md card p-8 text-center" data-testid="signup-confirm-email">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MailCheck className="h-6 w-6 text-foreground" />
            </div>
            <h1 className="text-h2 text-foreground mb-2">Account created</h1>
            {signupDone.message && <p className="text-body-sm text-foreground">{signupDone.message}</p>}
            {signupDone.email && (
              <p className="mt-2 text-body-sm text-muted-foreground">
                Email address: <span className="font-medium text-foreground">{signupDone.email}</span>
              </p>
            )}
            <div className="mt-6 border-t border-border pt-4">
              <ResendConfirmation initialEmail={signupDone.email} />
            </div>
            <Link
              to="/login"
              className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground font-medium text-body-sm hover:bg-primary/90 transition-colors no-underline"
            >
              Go to sign in
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {header}

      <main className="flex-1 flex justify-center items-center py-8 px-6">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="card p-8">
            <div className="text-center mb-8">
              <motion.h1
                className="text-h2 text-foreground mb-1"
                key={isLogin}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {isLogin ? 'Welcome Back' : 'Create an Account'}
              </motion.h1>
              <p className="text-body-sm text-muted-foreground">
                {isLogin
                  ? 'Sign in to your account'
                  : `Sign up as a ${isRecruiter ? 'recruiter' : 'candidate'} to get started`}
              </p>
              {successMessage && (
                <p className="mt-4 rounded-md bg-success/10 border border-success/20 px-3 py-2 text-body-sm text-success">
                  {successMessage}
                </p>
              )}
              {authError && (
                <div role="alert" data-testid="login-error" className="mt-4 flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-left">
                  <span className="mt-0.5 h-fit rounded-md bg-destructive/15 p-2 text-destructive"><ShieldAlert className="h-5 w-5" /></span>
                  <div>
                    <p className="text-sm font-semibold text-destructive">{ERROR_TITLES[authError.kind]}</p>
                    <p className="mt-1 text-sm leading-5 text-destructive">{authError.message}</p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label htmlFor={roleSelectId} className="block text-body-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Account type
                  </label>
                  <select
                    id={roleSelectId}
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-body-sm text-foreground appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="candidate">Candidate</option>
                    <option value="recruiter">Recruiter</option>
                  </select>
                </div>
              )}

              <AnimatedInput
                icon={User}
                label="Username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="johndoe"
                autoComplete="username"
                testId={isLogin ? 'login-username' : undefined}
                required
              />

              <AnimatePresence>
                {!isLogin && (
                  <motion.div
                    key="nameField"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <AnimatedInput
                      icon={User}
                      label="Full Name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      autoComplete="name"
                      required={!isLogin}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {!isLogin && (
                <AnimatedInput
                  icon={Mail}
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              )}

              <AnimatedInput
                icon={Lock}
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                testId={isLogin ? 'login-password' : undefined}
                required
              />

              {/* Submit Button: the only one, for every role (R-31) */}
              <motion.button
                type="submit"
                name="submit"
                disabled={isSubmitting}
                data-testid={isLogin ? 'login-submit' : 'signup-submit'}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-body-sm hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {isSubmitting ? (
                  <motion.div
                    className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            {isLogin && (
              <div className="mt-4 space-y-3 text-center">
                <Link to="/reset-password" className="block text-body-sm text-foreground font-medium hover:text-foreground/80 transition-colors">
                  Forgot password?
                </Link>
                <button
                  type="button"
                  onClick={() => setShowResend((open) => !open)}
                  aria-expanded={showResend}
                  className="text-body-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
                >
                  Didn't get the confirmation email?
                </button>
                {showResend && (
                  <div className="rounded-md border border-border p-3">
                    <ResendConfirmation />
                  </div>
                )}
              </div>
            )}

            {/* Toggle Mode */}
            <div className="mt-6 text-center text-body-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-foreground font-medium hover:text-foreground/80 transition-colors bg-transparent border-none cursor-pointer"
              >
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default Login;
