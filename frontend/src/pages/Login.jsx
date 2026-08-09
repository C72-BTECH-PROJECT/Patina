import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Building2, Zap, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Glow Orb Component
const GlowOrb = ({ className }) => (
  <div className={`absolute w-96 h-96 rounded-full filter blur-3xl opacity-20 ${className}`}>
    <div className={`w-full h-full rounded-full bg-gradient-to-br from-accent-purple/40 to-accent-pink/30 animate-glow-pulse`} />
  </div>
);

// Animated Input Component
const AnimatedInput = ({ icon: Icon, label, type = 'text', value, onChange, placeholder, required }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <motion.div
      className="relative group"
      whileFocusWithin={{ scale: 1.01 }}
    >
      <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4 text-accent-purple" />
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
          className="w-full px-5 py-4 pl-12 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20 transition-all [&::-webkit-autofill]:text-white [&::-webkit-autofill]::selection:text-white"
        />
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
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
  const { role } = useParams();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [verificationInfo, setVerificationInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login: loginWithSession, refreshUser, authFetch, user, loading: authLoading } = useAuth();

  const isRecruiter = role === 'recruiter';

  // Where to send someone once they're authenticated, regardless of
  // whether they arrived via local login, signup, or OAuth.
  const getDashboardPath = (userRole) =>
    userRole === 'RECRUITER' ? '/recruiter/dashboard' : '/candidate/dashboard';

  // Already logged in? Skip the form entirely instead of showing it again.
  useEffect(() => {
    if (!authLoading && user) {
      navigate(getDashboardPath(user.role), { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      const endpoint = isLogin ? 'login' : 'signup';
      const payload = { role, email, password };

      if (!isLogin) {
        payload.name = name;
        if (isRecruiter) {
          payload.companyName = companyName;
          payload.verificationInfo = verificationInfo;
        }
      }

      if (isLogin) {
        await loginWithSession(payload);
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

      await refreshUser();
      navigate(getDashboardPath(isRecruiter ? 'RECRUITER' : 'CANDIDATE'));
    } catch (err) {
      alert(err.message || 'Failed to connect to server');
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
    setIsLogin(!isLogin);
  };

  return (
    <div className="min-h-screen bg-background text-white relative overflow-hidden">
      {/* Noise Overlay */}
      <div className="noise-overlay" />

      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <GlowOrb className="top-[-10%] right-[-10%]" />
      <GlowOrb className="bottom-[-10%] left-[-10%]" />

      {/* Header */}
      <motion.header
        className="relative z-10 flex justify-between items-center py-6 px-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link to="/" className="flex items-center gap-3 no-underline group">
          <span className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-accent-purple to-accent-cyan rounded-xl group-hover:shadow-glow-purple transition-shadow">
            <Zap className="w-5 h-5 text-white" />
          </span>
          <span className="font-extrabold tracking-tight text-2xl">PATINA</span>
        </Link>

        <Link
          to="/select-role"
          className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-2"
        >
          ← Back
        </Link>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex justify-center items-center min-h-[calc(100vh-80px)] py-12 px-6">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Form Card */}
          <div className="glass-card p-8 md:p-10 relative">
            <div className="corner-decoration top-left" />
            <div className="corner-decoration bottom-right" />

            {/* Header */}
            <div className="text-center mb-8">
              <motion.h1
                className="text-3xl font-bold text-white mb-2"
                key={isLogin}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {isLogin ? 'Welcome Back' : 'Create an Account'}
              </motion.h1>
              <p className="text-white/50">
                {isLogin
                  ? `Sign in to your ${isRecruiter ? 'recruiter' : 'candidate'} account`
                  : `Sign up as a ${isRecruiter ? 'recruiter' : 'candidate'} to get started`}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence mode="wait">
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

              <AnimatedInput
                icon={Mail}
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />

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
                    className="pt-4 mt-2 space-y-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="border-t border-white/5 pt-4">
                      <h3 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-accent-purple" />
                        Verification Details (Optional)
                      </h3>

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
                className="w-full py-4 rounded-xl font-bold text-lg relative overflow-hidden bg-gradient-to-r from-accent-purple to-accent-cyan text-white disabled:opacity-50 cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <motion.div
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  ) : (
                    <>
                      {isLogin ? 'Sign In' : 'Create Account'}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </span>
              </motion.button>

              {!isLogin && isRecruiter && (
                <motion.button
                  type="button"
                  onClick={handleSkipVerification}
                  className="w-full py-3 rounded-xl font-medium bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Skip Verification & Continue
                </motion.button>
              )}
            </form>

            {/* Toggle Mode */}
            <div className="mt-8 text-center text-sm text-white/50">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={toggleMode}
                className="text-accent-purple font-semibold hover:text-accent-cyan transition-colors bg-transparent border-none cursor-pointer"
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
