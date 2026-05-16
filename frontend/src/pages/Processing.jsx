import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const steps = [
  { id: 1, text: 'Parsing resume...' },
  { id: 2, text: 'Extracting skills...' },
  { id: 3, text: 'Analyzing semantic similarity...' },
  { id: 4, text: 'Generating credibility score...' },
  { id: 5, text: 'Complete!' }
];

function Processing() {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { file, jd } = location.state || {};

    if (!file || !jd) {
      navigate('/upload');
      return;
    }

    const callApi = async () => {
      try {
        setProgress(10);
        setCurrentStep(0);

        const formData = new FormData();
        formData.append('resume', file);
        formData.append('jd', jd);

        setProgress(30);
        setCurrentStep(1);

        const response = await fetch('http://localhost:5001/api/parse', {
          method: 'POST',
          body: formData,
        });

        setProgress(60);
        setCurrentStep(2);

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Server error');
        }

        const result = await response.json();

        setProgress(85);
        setCurrentStep(3);

        await new Promise(resolve => setTimeout(resolve, 600));

        setProgress(100);
        setCurrentStep(4);

        await new Promise(resolve => setTimeout(resolve, 800));

        navigate('/dashboard', { state: { result } });

      } catch (err) {
        setError(err.message || 'Something went wrong. Please try again.');
        setProgress(0);
      }
    };

    callApi();
  }, []);

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

            {error ? (
              <div>
                <div className="text-5xl mb-4">❌</div>
                <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
                <p className="text-slate-500 mb-6">{error}</p>
                <button
                  onClick={() => navigate('/upload')}
                  className="py-3 px-6 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  {progress < 100 ? (
                    <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                  ) : (
                    <div className="w-16 h-16 flex items-center justify-center bg-emerald-100 rounded-full mx-auto text-3xl">✓</div>
                  )}
                </div>

                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">
                  {progress < 100 ? 'Analyzing Your Resume' : 'Analysis Complete!'}
                </h1>
                <p className="text-base text-slate-500 mb-8">
                  {progress < 100
                    ? 'Please wait while we verify your skills and generate your credibility score'
                    : 'Redirecting to your results...'}
                </p>

                <div className="flex items-center gap-4 mb-10">
                  <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
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
                      <span className={`w-6 h-6 flex items-center justify-center text-sm ${index === currentStep && progress < 100 ? 'animate-spin' : ''}`}>
                        {index < currentStep ? '✓' : index === currentStep ? '⟳' : '○'}
                      </span>
                      <span className="text-base font-medium">{step.text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Processing;