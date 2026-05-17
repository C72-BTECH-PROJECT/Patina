import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Brain, Database, GitBranch, Sparkles, CheckCircle, Loader, AlertCircle, Zap, Cpu } from 'lucide-react';

// Pipeline Steps Configuration
const steps = [
  { id: 1, text: 'Parsing resume...', subtext: 'Extracting text and metadata', icon: FileText, color: 'accent-purple' },
  { id: 2, text: 'Extracting skills...', subtext: 'Identifying technical competencies', icon: Database, color: 'accent-cyan' },
  { id: 3, text: 'Analyzing GitHub profile...', subtext: 'Verifying real-world activity', icon: GitBranch, color: 'accent-pink' },
  { id: 4, text: 'Generating credibility score...', subtext: 'Computing semantic similarity', icon: Brain, color: 'accent-emerald' },
  { id: 5, text: 'Complete!', subtext: 'Analysis finished successfully', icon: Sparkles, color: 'accent-amber' },
];

// Glow Orb Component
const GlowOrb = ({ className, colorClass = 'from-accent-purple/50 to-accent-purple/20' }) => (
  <div className={`absolute w-96 h-96 rounded-full filter blur-3xl opacity-20 ${className}`}>
    <div className={`w-full h-full rounded-full bg-gradient-to-br ${colorClass} animate-glow-pulse`} />
  </div>
);

// Circular Progress Component
const CircularProgress = ({ progress, children }) => {
  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative w-80 h-80">
      {/* Outer Glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: [
            `0 0 60px rgba(139, 92, 246, ${progress / 200})`,
            `0 0 100px rgba(139, 92, 246, ${progress / 150})`,
            `0 0 60px rgba(139, 92, 246, ${progress / 200})`,
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Rotating Border */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent ${progress}%, rgba(139, 92, 246, 0.3) ${progress}%)`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />

      {/* Main SVG */}
      <svg className="w-full h-full -rotate-90" viewBox="0 0 300 300">
        <circle
          cx="150"
          cy="150"
          r="140"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="6"
        />
        <motion.circle
          cx="150"
          cy="150"
          r="140"
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>

      {/* Pulsing Rings */}
      <motion.div
        className="absolute inset-8 rounded-full border border-accent-purple/20"
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div
        className="absolute inset-16 rounded-full border border-accent-cyan/15"
        animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
      />
    </div>
  );
};

// Step Item Component
const StepItem = ({ step, index, currentStep, progress }) => {
  const isCompleted = index < currentStep;
  const isActive = index === currentStep;

  const stepProgress = isCompleted ? 100 : isActive ? (progress % 20) * 5 : 0;

  return (
    <motion.div
      className={`relative flex items-start gap-4 p-4 rounded-2xl transition-all duration-500 ${
        isActive ? 'bg-white/[0.05]' : isCompleted ? 'bg-accent-emerald/[0.05]' : 'bg-transparent'
      }`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      {/* Connector Line */}
      {index < steps.length - 1 && (
        <div className="absolute left-[1.625rem] top-14 w-0.5 h-12">
          <div className="w-full h-full bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="w-full bg-gradient-to-b from-accent-purple to-accent-cyan rounded-full"
              initial={{ height: 0 }}
              animate={{ height: isCompleted ? '100%' : isActive ? `${stepProgress}%` : '0%' }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Step Icon */}
      <motion.div
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isCompleted
            ? 'bg-accent-emerald/20'
            : isActive
            ? 'bg-accent-purple/20'
            : 'bg-white/5'
        }`}
        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
      >
        {isCompleted ? (
          <CheckCircle className="w-5 h-5 text-accent-emerald" />
        ) : isActive ? (
          <step.icon className="w-5 h-5 text-accent-purple" />
        ) : (
          <div className="w-3 h-3 rounded-full bg-white/20" />
        )}

        {isActive && (
          <div className="absolute inset-0 rounded-xl bg-accent-purple/20 filter blur-md" />
        )}
      </motion.div>

      {/* Step Content */}
      <div className="flex-1 min-w-0">
        <div className={`font-medium transition-colors ${
          isCompleted ? 'text-accent-emerald' : isActive ? 'text-white' : 'text-white/40'
        }`}>
          {step.text}
        </div>
        <div className={`text-sm mt-0.5 transition-colors ${
          isCompleted ? 'text-accent-emerald/60' : isActive ? 'text-white/50' : 'text-white/30'
        }`}>
          {step.subtext}
        </div>

        {isActive && (
          <motion.div
            className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-accent-purple to-accent-cyan rounded-full"
              animate={{ width: [`${stepProgress}%`, `${(progress % 20) * 5}%`] }}
              transition={{ duration: 0.5 }}
            />
          </motion.div>
        )}
      </div>

      {isActive && (
        <motion.div
          className="px-3 py-1 rounded-full bg-accent-purple/20 border border-accent-purple/30"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span className="text-xs text-accent-purple font-medium flex items-center gap-1">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ●
            </motion.span>
            Processing
          </span>
        </motion.div>
      )}
    </motion.div>
  );
};

// Matrix Rain Effect
const MatrixRain = () => (
  <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
    {Array.from({ length: 20 }, (_, i) => (
      <motion.div
        key={i}
        className="absolute bottom-0 w-1 bg-accent-purple"
        style={{ left: `${i * 5}%` }}
        animate={{
          height: [0, '100%'],
          opacity: [0, 1, 0],
        }}
        transition={{
          duration: 2 + Math.random() * 2,
          repeat: Infinity,
          delay: i * 0.2,
          ease: 'linear',
        }}
      />
    ))}
  </div>
);

// Main Processing Component
function Processing() {
  const location = useLocation();
  const navigate = useNavigate();

  const { file, jobId } = location.state || {};
  const hasContext = Boolean(file && jobId);

  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState('');

  const doneRef = useRef(false);

  useEffect(() => {
    const stepIndex = Math.min(Math.floor(progress / 20), steps.length - 1);
    setCurrentStep(stepIndex);
  }, [progress]);

  useEffect(() => {
    if (!hasContext) return;

    doneRef.current = false;

    let isCancelled = false;
    let animId = null;

    const run = async () => {
      try {
        setError('');
        setProgress(0);

        setProgress(5);
        animId = setInterval(() => {
          setProgress((prev) => {
            if (doneRef.current) return 100;
            const next = Math.min(99, prev + Math.random() * 8);
            return next;
          });
        }, 250);

        const form = new FormData();
        form.append('resume', file);
        form.append('jobId', String(jobId));

        const resp = await fetch('http://localhost:5001/api/analyze', {
          method: 'POST',
          body: form,
        });

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          throw new Error(`NLP parsing failed (${resp.status}) ${txt}`);
        }

        await resp.json();

        if (isCancelled) return;

        doneRef.current = true;

        if (animId) clearInterval(animId);
        setProgress(100);

        setTimeout(() => {
          navigate('/candidate/dashboard');
        }, 2000);
      } catch (e) {
        if (isCancelled) return;

        if (animId) clearInterval(animId);
        doneRef.current = true;
        setError(e?.message || 'Failed to process resume');
      }
    };

    run();

    return () => {
      isCancelled = true;
      doneRef.current = true;
      if (animId) clearInterval(animId);
    };
  }, [hasContext, file, jobId, navigate]);

  useEffect(() => {
    if (!error) return;
    setProgress(0);
  }, [error]);

  if (!hasContext) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <GlowOrb className="top-[-10%] left-[20%]" colorClass="from-accent-purple/50 to-accent-purple/20" />

        <motion.div
          className="glass-card p-10 max-w-md w-full text-center relative"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="corner-decoration top-left" />
          <div className="corner-decoration bottom-right" />

          <div className="w-16 h-16 rounded-2xl bg-accent-rose/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-accent-rose" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">Processing Context Missing</h1>
          <p className="text-white/50 mb-8">Please go back and upload your resume again.</p>

          <motion.button
            onClick={() => navigate('/candidate/upload')}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Upload Resume
          </motion.button>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-accent-rose/10 border border-accent-rose/30 text-accent-rose text-sm text-left">
              {error}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white relative overflow-hidden">
      {/* Noise Overlay */}
      <div className="noise-overlay" />

      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      <MatrixRain />

      {/* Glow Orbs */}
      <GlowOrb className="top-[-20%] left-[-10%]" colorClass="from-accent-purple/50 to-accent-purple/20" />
      <GlowOrb className="bottom-[-20%] right-[-10%]" colorClass="from-accent-cyan/50 to-accent-cyan/20" />

      {/* Header */}
      <motion.header
        className="relative z-10 flex justify-between items-center py-6 px-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div />

        <div className="flex items-center gap-3">
          <span className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-accent-purple to-accent-cyan rounded-xl">
            <Zap className="w-5 h-5 text-white" />
          </span>
          <span className="font-extrabold tracking-tight text-2xl">PATINA</span>
        </div>

        <div className="w-[60px]" />
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 flex justify-center items-center min-h-[calc(100vh-80px)] py-12 px-6">
        <div className="max-w-4xl w-full grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Steps */}
          <motion.div
            className="glass-card p-8 relative"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="corner-decoration top-left" />
            <div className="corner-decoration bottom-right" />

            <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
              <Cpu className="w-6 h-6 text-accent-purple" />
              AI Analysis Pipeline
            </h2>

            {error ? (
              <motion.div
                className="p-6 rounded-2xl bg-accent-rose/10 border border-accent-rose/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-accent-rose" />
                  <span className="font-semibold text-accent-rose">Processing Failed</span>
                </div>
                <p className="text-sm text-white/60 mb-4">{error}</p>
                <motion.button
                  onClick={() => navigate('/candidate/upload')}
                  className="px-6 py-3 rounded-xl bg-accent-purple/20 border border-accent-purple/30 text-accent-purple font-medium"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Upload Again
                </motion.button>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <StepItem
                    key={step.id}
                    step={step}
                    index={index}
                    currentStep={currentStep}
                    progress={progress}
                  />
                ))}
              </div>
            )}
          </motion.div>

          {/* Right - Progress Visualization */}
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative">
              <CircularProgress progress={progress}>
                <div className="text-center">
                  <motion.span
                    className="text-6xl font-extrabold bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-pink bg-clip-text text-transparent"
                    key={Math.floor(progress)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {Math.round(progress)}%
                  </motion.span>
                  <div className="text-sm text-white/40 mt-2 uppercase tracking-widest">Processing</div>
                </div>
              </CircularProgress>

              {/* Floating Icons */}
              {[FileText, Database, GitBranch, Brain, Sparkles].map((Icon, i) => (
                <motion.div
                  key={i}
                  className="absolute w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
                  style={{
                    top: `${15 + i * 18}%`,
                    right: i % 2 === 0 ? '-15%' : undefined,
                    left: i % 2 !== 0 ? '-15%' : undefined,
                  }}
                  animate={{
                    y: [0, -10, 0],
                    opacity: progress > (i + 1) * 15 ? [0.3, 0.7, 0.3] : 0.3,
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                >
                  <Icon className={`w-5 h-5 ${progress > (i + 1) * 15 ? 'text-accent-purple' : 'text-white/30'}`} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      {/* File Info Banner */}
      {file && (
        <motion.div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10 px-6 py-3 rounded-2xl glass-card flex items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <FileText className="w-5 h-5 text-accent-cyan" />
          <span className="text-sm text-white/70">{file.name}</span>
          <span className="text-xs text-white/30">{(file.size / 1024).toFixed(1)} KB</span>
        </motion.div>
      )}
    </div>
  );
}

export default Processing;