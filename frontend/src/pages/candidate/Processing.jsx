import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Brain, Database, GitBranch, Sparkles, CheckCircle, AlertCircle, Zap, Cpu } from 'lucide-react';

const steps = [
  { id: 1, text: 'Parsing resume...', subtext: 'Extracting text and metadata', icon: FileText },
  { id: 2, text: 'Extracting skills...', subtext: 'Identifying technical competencies', icon: Database },
  { id: 3, text: 'Analyzing GitHub profile...', subtext: 'Verifying real-world activity', icon: GitBranch },
  { id: 4, text: 'Generating credibility score...', subtext: 'Computing semantic similarity', icon: Brain },
  { id: 5, text: 'Complete!', subtext: 'Analysis finished successfully', icon: Sparkles },
];

const CircularProgress = ({ progress, children }) => {
  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative w-80 h-80">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 300 300">
        <circle
          cx="150"
          cy="150"
          r="140"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="6"
        />
        <motion.circle
          cx="150"
          cy="150"
          r="140"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
};

const StepItem = ({ step, index, currentStep, progress }) => {
  const isCompleted = index < currentStep;
  const isActive = index === currentStep;
  const stepProgress = isCompleted ? 100 : isActive ? (progress % 20) * 5 : 0;

  return (
    <motion.div
      className={`relative flex items-start gap-4 p-4 rounded-xl transition-all duration-500 ${
        isActive ? 'bg-muted' : isCompleted ? 'bg-success/5' : 'bg-transparent'
      }`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      {index < steps.length - 1 && (
        <div className="absolute left-[1.625rem] top-14 w-0.5 h-12">
          <div className="w-full h-full bg-border rounded-full overflow-hidden">
            <motion.div
              className="w-full bg-foreground rounded-full"
              initial={{ height: 0 }}
              animate={{ height: isCompleted ? '100%' : isActive ? `${stepProgress}%` : '0%' }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      <motion.div
        className={`relative w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isCompleted
            ? 'bg-success/10'
            : isActive
            ? 'bg-muted'
            : 'bg-muted'
        }`}
        animate={isActive ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
      >
        {isCompleted ? (
          <CheckCircle className="w-5 h-5 text-success" />
        ) : isActive ? (
          <step.icon className="w-5 h-5 text-foreground" />
        ) : (
          <div className="w-3 h-3 rounded-full bg-border" />
        )}
      </motion.div>

      <div className="flex-1 min-w-0">
        <div className={`font-medium transition-colors ${
          isCompleted ? 'text-success' : isActive ? 'text-foreground' : 'text-muted-foreground'
        }`}>
          {step.text}
        </div>
        <div className={`text-sm mt-0.5 transition-colors ${
          isCompleted ? 'text-success/60' : isActive ? 'text-muted-foreground' : 'text-muted-foreground/60'
        }`}>
          {step.subtext}
        </div>

        {isActive && (
          <motion.div
            className="mt-2 h-1 w-full bg-border rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="h-full bg-foreground rounded-full"
              animate={{ width: [`${stepProgress}%`, `${(progress % 20) * 5}%`] }}
              transition={{ duration: 0.5 }}
            />
          </motion.div>
        )}
      </div>

      {isActive && (
        <motion.div
          className="px-3 py-1 rounded-full bg-muted border border-border"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span className="text-xs text-foreground font-medium flex items-center gap-1">
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

        const resp = await fetch('http://localhost:5000/api/analyze', {
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
        setTimeout(() => navigate('/candidate/dashboard'), 2000);
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
        <motion.div
          className="card p-10 max-w-md w-full text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-3">Processing Context Missing</h1>
          <p className="text-muted-foreground mb-8">Please go back and upload your resume again.</p>

          <motion.button
            onClick={() => navigate('/candidate/upload')}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-body-sm hover:bg-primary/90 transition-colors"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            Upload Resume
          </motion.button>

          {error && (
            <div className="mt-4 p-4 rounded-md bg-destructive/10 border border-border text-destructive text-sm text-left">
              {error}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="flex justify-center items-center min-h-screen py-12 px-6">
        <div className="max-w-4xl w-full grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="card p-8"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-foreground mb-8 flex items-center gap-3">
              <Cpu className="w-6 h-6" />
              AI Analysis Pipeline
            </h2>

            {error ? (
              <motion.div
                className="p-6 rounded-xl bg-destructive/5 border border-border"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                  <span className="font-semibold text-destructive">Processing Failed</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <motion.button
                  onClick={() => navigate('/candidate/upload')}
                  className="px-6 py-2 rounded-md bg-muted border border-border text-foreground font-medium text-body-sm hover:bg-muted/80 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
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
                    className="text-6xl font-bold text-foreground"
                    key={Math.floor(progress)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {Math.round(progress)}%
                  </motion.span>
                  <div className="text-sm text-muted-foreground mt-2 uppercase tracking-widest">Processing</div>
                </div>
              </CircularProgress>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default Processing;
