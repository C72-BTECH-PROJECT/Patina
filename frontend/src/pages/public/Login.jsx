import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Building2, Zap, Eye, EyeOff, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Animated Input Component
const AnimatedInput = ({ icon: Icon, label, type = 'text', value, onChange, placeholder, required }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <motion.div
      className="relative group"
      whileFocusWithin={{ scale: 1.01 }}
    >
      <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {label}
      </label>
      <div className="relative">
        <input
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'off'}
          className="w-full px-5 py-4 pl-12 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
        />
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
    </motion.div>
  );
};

// Main Login Component
function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSignupPage = location.pathname === '/signup';
  const [isLogin, setIsLogin] = useState(!isSignupPage);
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '');
  const [authError, setAuthError] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [verificationInfo, setVerificationInfo] = useState('');
  const [signupRole, setSignupRole] = useState('candidate');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const { login: loginWithSession, refreshUser, authFetch, user, loading: authLoading } = useAuth();

  const isRecruiter = signupRole === 'recruiter';

  useEffect(() => {
    setIsLogin(!isSignupPage);
    setSuccessMessage(location.state?.message || '');
  }, [isSignupPage, location.state]);

  // Where to send someone once they're authenticated, regardless of
  // whether they arrived via local login, signup, or OAuth.
  const getDashboardPath = (userRole) =>
    userRole === 'ADMIN'
      ? '/admin/dashboard'
      : userRole === 'RECRUITER'
        ? '/recruiter/dashboard'
        : '/candidate/dashboard';

  // Already logged in? Skip the form entirely instead of showing it again.
  useEffect(() => {
    if (!authLoading && user) {
      navigate(getDashboardPath(user.role), { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setAuthError('');
    setIsSubmitting(true);

    try {
      const endpoint = isLogin ? 'login' : 'signup';
      const payload = { email, password, username };

      if (!isLogin) {
        payload.role = signupRole;
        payload.name = name;
        if (isRecruiter) {
          payload.companyName = companyName;
          payload.verificationInfo = verificationInfo;
        }
      }

      if (isLogin) {
        const loginResult = await loginWithSession(payload);
        await refreshUser();
        navigate(getDashboardPath(loginResult.user?.role));
        return;
      } else {
        const res = await authFetch(`${API_BASE_URL}/api/auth/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.message || 'Error occurred');
          setIsSubmitting(false);
          return;
        }
      }

      if (!isLogin) {
        // Signup creates a session on the API, but this flow deliberately
        // returns new users to sign in with their newly created account.
        await authFetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
        navigate('/login', {
          replace: true,
          state: { message: 'Account created successfully. Please sign in to continue.' },
        });
        return;
      }

    } catch (err) {
      if (err.code === 'ACCOUNT_SUSPENDED') {
        setAuthError(err.message);
      } else {
        alert(err.message || 'Failed to connect to server');
      }
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const handleSkipVerification = async (e) => {
    e.preventDefault();
    if (!email || !password || !name) {
      alert('Please fill in your name, email, and password to continue.');
      return;
    }

    setCompanyName('');
    setVerificationInfo('');

    const syntheticEvent = { preventDefault: () => {} };
    await handleSubmit(syntheticEvent);
  };

  const toggleMode = () => {
    navigate(isLogin ? '/signup' : '/login');
  };

  const handleResendConfirmation = async () => {
    setResendingConfirmation(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/auth/resend-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.message || 'Failed to resend confirmation email.');
      } else {
        setAuthError('Confirmation email sent. Check your inbox and spam folder.');
      }
    } catch (err) {
      setAuthError('Failed to resend confirmation email.');
    } finally {
      setResendingConfirmation(false);
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
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">PATINA</span>
        </Link>

        <Link
          to="/select-role"
          className="text-body-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
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
                <div role="alert" className="mt-4 flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-left">
                  <span className="mt-0.5 rounded-md bg-destructive/15 p-2 text-destructive"><ShieldAlert className="h-5 w-5" /></span>
                  <div>
                    <p className="text-sm font-semibold text-destructive">Account access paused</p>
                    <p className="mt-1 text-sm leading-5 text-destructive/75">{authError}</p>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resendingConfirmation}
                        className="mt-2 text-xs font-medium text-destructive underline underline-offset-2 disabled:opacity-60"
                      >
                        {resendingConfirmation ? 'Sending...' : 'Resend confirmation email'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-body-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Account type
                  </label>
                  <select
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
                required
              />

              {/* Recruiter Extra Fields */}
              <AnimatePresence>
                {!isLogin && isRecruiter && (
                  <motion.div
                    className="pt-2 space-y-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="border-t border-border pt-4">
                      <p className="text-body-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Verification Details (Optional)
                      </p>

                      <div className="space-y-4">
                        <AnimatedInput
                          icon={Building2}
                          label="Company Name"
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Acme Corp"
                        />

                        <AnimatedInput
                          icon={Mail}
                          label="LinkedIn / Company Website"
                          type="text"
                          value={verificationInfo}
                          onChange={(e) => setVerificationInfo(e.target.value)}
                          placeholder="https://"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={isSubmitting}
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

              {!isLogin && isRecruiter && (
                <motion.button
                  type="button"
                  onClick={handleSkipVerification}
                  className="w-full h-10 rounded-md border border-input bg-background text-muted-foreground font-medium text-body-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Skip Verification & Continue
                </motion.button>
              )}
            </form>

            {isLogin && (
              <div className="mt-4 text-center">
                <Link to="/reset-password" className="text-body-sm text-foreground font-medium hover:text-foreground/80 transition-colors">
                  Forgot password?
                </Link>
              </div>
            )}

            {/* Toggle Mode */}
            <div className="mt-6 text-center text-body-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
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
