import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Processing.css';

function Processing() {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const steps = [
    { id: 1, text: 'Parsing resume...', status: 'processing' },
    { id: 2, text: 'Extracting skills...', status: 'pending' },
    { id: 3, text: 'Analyzing GitHub profile...', status: 'pending' },
    { id: 4, text: 'Generating credibility score...', status: 'pending' },
    { id: 5, text: 'Complete!', status: 'pending' }
  ];

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
    <div className="processing-page">
      <header className="processing-header">
        <div className="logo">
          <span className="logo-icon">✓</span>
          <span className="logo-text">SkillVerify</span>
        </div>
      </header>

      <main className="processing-main">
        <div className="processing-container">
          <div className="processing-card card">
            <div className="spinner-container">
              <div className="spinner"></div>
            </div>

            <h1 className="processing-title">Analyzing Your Resume</h1>
            <p className="processing-subtitle">
              Please wait while we verify your skills and generate your credibility score
            </p>

            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                ></div>
              </div>
              <span className="progress-percentage">{Math.round(progress)}%</span>
            </div>

            <div className="steps-list">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`step-item ${index <= currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                >
                  <span className="step-icon">
                    {index < currentStep ? '✓' : index === currentStep ? '⟳' : '○'}
                  </span>
                  <span className="step-text">{step.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="redirect-notice">
            Redirecting to dashboard in {Math.max(0, Math.ceil((100 - progress) / 33))} seconds...
          </p>
        </div>
      </main>
    </div>
  );
}

export default Processing;