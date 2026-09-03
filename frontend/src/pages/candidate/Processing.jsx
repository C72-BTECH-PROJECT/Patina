import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, ScanText, CheckCircle, AlertCircle, Cpu } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// The two phases the analyze request genuinely goes through, from the browser's
// point of view. "Uploading" is measured from real XHR upload progress.
// "Analyzing" covers everything the server does inside the single /api/analyze
// response — text extraction, skill NER, semantic matching, then normalising the
// evidence and writing the score explanation — none of which is streamed, so it
// shows as an indeterminate working state rather than a fabricated percentage.
//
// There is deliberately no "Analyzing GitHub profile" or assessment step here:
// those services are not part of the pipeline, so claiming they run would be a
// lie on the progress screen.
const PHASES = [
  {
    key: 'uploading',
    text: 'Uploading résumé',
    subtext: 'Sending your file to the analysis service',
    icon: FileText,
  },
  {
    key: 'analyzing',
    text: 'Analyzing résumé',
    subtext: 'Extracting skills, matching them against the job description, and scoring',
    icon: ScanText,
  },
];

const PHASE_INDEX = { uploading: 0, analyzing: 1, done: 2 };

function CircularProgress({ percent, indeterminate, centerLabel, centerSub }) {
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const offset = indeterminate
    ? circumference * 0.72
    : circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <motion.div
      className="relative w-72 h-72"
      animate={indeterminate ? { rotate: 360 } : { rotate: 0 }}
      transition={
        indeterminate
          ? { duration: 1.1, repeat: Infinity, ease: 'linear' }
          : { duration: 0.3 }
      }
    >
      <svg className="w-full h-full -rotate-90" viewBox="0 0 300 300">
        <circle
          cx="150"
          cy="150"
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="6"
        />
        <motion.circle
          cx="150"
          cy="150"
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </svg>

      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        animate={indeterminate ? { rotate: -360 } : { rotate: 0 }}
        transition={
          indeterminate
            ? { duration: 1.1, repeat: Infinity, ease: 'linear' }
            : { duration: 0.3 }
        }
      >
        <span className="text-5xl font-bold text-foreground tabular-nums">{centerLabel}</span>
        <span className="text-sm text-muted-foreground mt-2 uppercase tracking-widest">
          {centerSub}
        </span>
      </motion.div>
    </motion.div>
  );
}

function StepItem({ step, index, activeIndex }) {
  const isCompleted = index < activeIndex;
  const isActive = index === activeIndex;

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl transition-colors duration-300 ${
        isActive ? 'bg-muted' : isCompleted ? 'bg-success/5' : 'bg-transparent'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isCompleted ? 'bg-success/10' : 'bg-muted'
        }`}
      >
        {isCompleted ? (
          <CheckCircle className="w-5 h-5 text-success" />
        ) : (
          <motion.span
            animate={isActive ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 1.2, repeat: isActive ? Infinity : 0 }}
          >
            <step.icon
              className={`w-5 h-5 ${isActive ? 'text-foreground' : 'text-muted-foreground/50'}`}
            />
          </motion.span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className={`font-medium ${
            isCompleted ? 'text-success' : isActive ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {step.text}
        </div>
        <div
          className={`text-sm mt-0.5 ${
            isActive ? 'text-muted-foreground' : 'text-muted-foreground/60'
          }`}
        >
          {step.subtext}
        </div>
      </div>

      {isActive && (
        <span className="px-3 py-1 rounded-full bg-muted border border-border text-xs text-foreground font-medium flex items-center gap-1.5 flex-shrink-0">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ●
          </motion.span>
          Working
        </span>
      )}
    </div>
  );
}

function Processing() {
  const location = useLocation();
  const navigate = useNavigate();
  const { file, jobId } = location.state || {};
  const hasContext = Boolean(file && jobId);

  const [phase, setPhase] = useState('uploading'); // uploading | analyzing | done
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState('');
  const xhrRef = useRef(null);

  useEffect(() => {
    if (!hasContext) return undefined;

    setError('');
    setPhase('uploading');
    setUploadPercent(0);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', `${API_BASE_URL}/api/analyze`);
    // The analyze endpoint is session-guarded (requireRole CANDIDATE); XHR
    // bypasses the app-wide fetch wrapper, so opt into cookies explicitly.
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadPercent(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.upload.onload = () => {
      setUploadPercent(100);
      setPhase('analyzing');
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let analysis = null;
        try {
          analysis = JSON.parse(xhr.responseText);
        } catch {
          setError('The analysis service returned a response we could not read.');
          return;
        }
        setPhase('done');
        setTimeout(() => {
          navigate('/candidate/results', { state: { analysis }, replace: true });
        }, 900);
      } else {
        let message = `Analysis failed (${xhr.status}).`;
        try {
          const body = JSON.parse(xhr.responseText);
          message = body.message || body.error || message;
        } catch {
          /* keep the status-code message */
        }
        setError(message);
      }
    };

    xhr.onerror = () => {
      setError('Could not reach the analysis service. Check your connection and try again.');
    };

    const form = new FormData();
    form.append('resume', file);
    form.append('jobId', String(jobId));
    xhr.send(form);

    return () => {
      xhr.upload.onprogress = null;
      xhr.upload.onload = null;
      xhr.onload = null;
      xhr.onerror = null;
      xhr.abort();
    };
  }, [hasContext, file, jobId, navigate]);

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
          <h1 className="text-2xl font-bold text-foreground mb-3">Processing context missing</h1>
          <p className="text-muted-foreground mb-8">
            Please go back and upload your résumé again.
          </p>
          <button
            type="button"
            onClick={() => navigate('/candidate/upload')}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-body-sm hover:bg-primary/90 transition-colors"
          >
            Upload résumé
          </button>
        </motion.div>
      </div>
    );
  }

  const activeIndex = PHASE_INDEX[phase];
  const indeterminate = phase === 'analyzing';
  const centerLabel = phase === 'done' ? '100%' : phase === 'analyzing' ? '···' : `${uploadPercent}%`;
  const centerSub =
    phase === 'done' ? 'Done' : phase === 'analyzing' ? 'Analyzing' : 'Uploading';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="flex justify-center items-center min-h-screen py-12 px-6">
        <div className="max-w-4xl w-full grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="card p-8"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-bold text-foreground mb-8 flex items-center gap-3">
              <Cpu className="w-6 h-6" />
              Analyzing your résumé
            </h2>

            {error ? (
              <motion.div
                className="p-6 rounded-xl bg-destructive/5 border border-border"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                  <span className="font-semibold text-destructive">Processing failed</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <button
                  type="button"
                  onClick={() => navigate('/candidate/upload')}
                  className="px-6 py-2 rounded-md bg-muted border border-border text-foreground font-medium text-body-sm hover:bg-muted/80 transition-colors"
                >
                  Upload again
                </button>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {PHASES.map((step, index) => (
                  <StepItem key={step.key} step={step} index={index} activeIndex={activeIndex} />
                ))}
                {phase === 'done' && (
                  <div className="flex items-center gap-3 p-4 text-success font-medium">
                    <CheckCircle className="w-5 h-5" />
                    Analysis complete — opening your results
                  </div>
                )}
              </div>
            )}
          </motion.div>

          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {error ? (
              <div className="w-72 h-72 rounded-full border-4 border-destructive/20 flex items-center justify-center">
                <AlertCircle className="w-16 h-16 text-destructive/60" />
              </div>
            ) : (
              <CircularProgress
                percent={phase === 'done' ? 100 : uploadPercent}
                indeterminate={indeterminate}
                centerLabel={centerLabel}
                centerSub={centerSub}
              />
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default Processing;
