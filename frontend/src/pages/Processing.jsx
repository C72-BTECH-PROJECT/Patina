import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const pipelineStages = [
  { id: 1, text: 'Uploading Resume' },
  { id: 2, text: 'Extracting Text' },
  { id: 3, text: 'Parsing Skills' },
  { id: 4, text: 'Matching Job Description' },
  { id: 5, text: 'Calculating Credibility Score' },
  { id: 6, text: 'Preparing Dashboard' },
];

function Processing() {
  const location = useLocation();
  const navigate = useNavigate();

  const { file, jobId } = location.state || {};

  const stages = useMemo(() => pipelineStages, []);

  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!file || !jobId) {
      setError('Missing resume file or job selection. Please go back and try again.');
      return;
    }

    let cancelled = false;

    setIsSubmitting(true);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) return prev;
        const inc = Math.random() * 10 + 5;
        return Math.min(98, prev + inc);
      });
    }, 350);

    const run = async () => {
      try {
        const formData = new FormData();
        formData.append('resume', file);
        formData.append('jobId', jobId);

        // Visual step schedule while request is running
        const stepSchedule = [
          { step: 0, atProgress: 8 },
          { step: 1, atProgress: 25 },
          { step: 2, atProgress: 45 },
          { step: 3, atProgress: 63 },
          { step: 4, atProgress: 80 },
          { step: 5, atProgress: 92 },
        ];

        for (const s of stepSchedule) {
          // eslint-disable-next-line no-await-in-loop
          while (!cancelled && progress < s.atProgress) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 100));
          }
          if (cancelled) return;
          setCurrentStep(s.step);
        }

        const resp = await fetch('http://localhost:5001/api/analyze', {
          method: 'POST',
          body: formData,
        });

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          throw new Error(`Analyze failed: ${resp.status} ${txt}`);
        }

        await resp.json().catch(() => null);

        if (cancelled) return;
        setProgress(100);
        setCurrentStep(stages.length - 1);
        navigate('/candidate/dashboard');
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || 'Resume analysis failed');
      } finally {
        clearInterval(interval);
        setIsSubmitting(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [file, jobId, navigate, stages, progress]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-lg w-full">
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Couldn’t start analysis</h1>
          <p className="text-slate-600">{error}</p>
          <button
            className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            onClick={() => navigate('/candidate/upload')}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200">
      <header className="flex justify-between items-center py-5 px-6 md:px-12 bg-white shadow-sm">
        <div className="flex items-center gap-2 text-xl font-bold text-indigo-500">
          <span className="w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-lg text-lg">✓</span>
          <span>SkillVerify</span>
        </div>
      </header>

      <main className="flex justify-center items-center min-h-[calc(100vh-80px)] py-12 px-6">
        <div className="max-w-xl w-full">
          <div className="bg-white/70 backdrop-blur rounded-2xl p-8 md:p-12 shadow-xl text-center">
            <div className="mb-8">
              <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">Analyzing your resume</h1>
            <p className="text-base text-slate-500 mb-8">
              We’re running a realistic recruitment pipeline and generating your job match dashboard.
            </p>

            <div className="flex items-center gap-4 mb-10">
              <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-lg font-semibold text-indigo-500 min-w-[50px]">{Math.round(progress)}%</span>
            </div>

            <div className="text-left flex flex-col gap-2">
              {stages.map((step, index) => {
                const isDone = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 py-3 px-4 rounded-lg transition-all duration-300 ${
                      isDone ? 'bg-emerald-50 text-emerald-600' : isCurrent ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 flex items-center justify-center text-sm rounded-full ${
                        isDone ? 'bg-emerald-100 text-emerald-600' : isCurrent ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                      } ${isCurrent && isSubmitting ? 'animate-spin' : ''}`}
                    >
                      {isDone ? '✓' : isCurrent ? '⟳' : '○'}
                    </span>
                    <span className="text-base font-medium">{step.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Processing;

