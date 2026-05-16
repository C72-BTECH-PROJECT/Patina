import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const steps = [
  { id: 1, text: 'Parsing resume...', status: 'processing' },
  { id: 2, text: 'Extracting skills...', status: 'pending' },
  { id: 3, text: 'Analyzing GitHub profile...', status: 'pending' },
  { id: 4, text: 'Generating credibility score...', status: 'pending' },
  { id: 5, text: 'Complete!', status: 'pending' }
];

function Processing() {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + Math.random() * 15;
        if (newProgress >= 100) {
          clearInterval(interval);
          return 100;
        }
        return newProgress;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const stepIndex = Math.min(Math.floor(progress / 20), steps.length - 1);
    setCurrentStep(stepIndex);
  }, [progress]);

  useEffect(() => {
    if (progress >= 100) {
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    }
  }, [progress, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200">
      <header className="flex justify-between items-center py-5 px-6 md:px-12 bg-white shadow-sm">
        <div className="flex items-center gap-2 text-xl font-bold text-indigo-500">
          <span className="w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-lg text-lg">✓</span>
<span className="font-extrabold tracking-tight text-2xl">PATINA</span>
        </div>
      </header>

      <main className="flex justify-center items-center min-h-[calc(100vh-80px)] py-12 px-6">
        <div className="max-w-xl w-full">
          <div className="bg-white rounded-2xl p-8 md:p-12 shadow-xl text-center">
            <div className="mb-8">
              <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">Analyzing Your Resume</h1>
            <p className="text-base text-slate-500 mb-8">
              Please wait while we verify your skills and generate your credibility score
            </p>

            <div className="flex items-center gap-4 mb-10">
              <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                ></div>
              </div>
              <span className="text-lg font-semibold text-indigo-500 min-w-[50px]">{Math.round(progress)}%</span>
            </div>

            <div className="text-left flex flex-col gap-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 py-3 px-4 rounded-lg transition-all duration-300 ${
                    index < currentStep ? 'bg-emerald-50 text-emerald-500' :
                    index === currentStep ? 'bg-indigo-50 text-indigo-500' :
                    'text-slate-400'
                  }`}
                >
                  <span className={`w-6 h-6 flex items-center justify-center text-sm ${index === currentStep ? 'animate-spin' : ''}`}>
                    {index < currentStep ? '✓' : index === currentStep ? '⟳' : '○'}
                  </span>
                  <span className="text-base font-medium">{step.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center mt-6 text-sm text-slate-500">
            Redirecting to dashboard in {Math.max(0, Math.ceil((100 - progress) / 33))} seconds...
          </p>
        </div>
      </main>
    </div>
  );
}

export default Processing;