import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/candidate')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        setCandidate(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const getScoreColor = (score) => {
    if (score >= 75) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading candidate data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="error-container">
          <h2>Error: {error}</h2>
          <p>Make sure the backend server is running on port 5000</p>
          <Link to="/" className="btn btn-primary">Go Home</Link>
        </div>
      </div>
    );
  }

  if (!candidate) return null;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <Link to="/" className="back-button">
          <span>←</span> Back
        </Link>
        <div className="logo">
          <span className="logo-icon">✓</span>
          <span className="logo-text">SkillVerify</span>
        </div>
        <div className="header-spacer"></div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-container">
          <div className="dashboard-header-section">
            <div className="candidate-info">
              <h1>{candidate.name}</h1>
              <p className="candidate-location">{candidate.location}</p>
              <div className="candidate-badges">
                <span className="badge badge-blue">✓ Resume Parsed</span>
                <span className="badge badge-green">✓ GitHub Connected</span>
                <span className="badge badge-yellow">⏳ Background Check</span>
              </div>
            </div>
            <div className="credibility-score-card">
              <span className="score-label">Credibility Score</span>
              <span className="score-value" style={{ color: getScoreColor(candidate.credibilityScore) }}>
                {candidate.credibilityScore}
              </span>
              <span className="score-out-of">/ 100</span>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h3>Verified Skills</h3>
              <div className="skills-list">
                {candidate.skills.map((skill, index) => (
                  <div key={index} className="skill-item">
                    <span className="skill-name">{skill.name}</span>
                    <span className={`verification-badge ${skill.verified ? 'verified' : 'unverified'}`}>
                      {skill.verified ? '✓ Verified' : '✗ Unverified'}
                    </span>
                    <span className="skill-level">{skill.level}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-card">
              <h3>GitHub Metrics</h3>
              <div className="github-stats">
                <div className="stat-item">
                  <span className="stat-value">{candidate.github.commits}</span>
                  <span className="stat-label">Commits</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{candidate.github.repos}</span>
                  <span className="stat-label">Repositories</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{candidate.github.totalStars}</span>
                  <span className="stat-label">Stars</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{candidate.github.totalForks}</span>
                  <span className="stat-label">Forks</span>
                </div>
              </div>
              <div className="languages-section">
                <h4>Top Languages</h4>
                <div className="languages-list">
                  {candidate.github.languages.map((lang, index) => (
                    <span key={index} className="language-badge">{lang}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="dashboard-card">
              <h3>Assessment Results</h3>
              <div className="assessment-overview">
                <div className="assessment-score" style={{ color: getScoreColor(candidate.assessment.score) }}>
                  <span className="score-number">{candidate.assessment.score}</span>
                  <span className="score-text">/ 100</span>
                </div>
                <span className="assessment-difficulty">Difficulty: {candidate.assessment.difficulty}</span>
              </div>
              <div className="assessment-categories">
                {candidate.assessment.categories.map((cat, index) => (
                  <div key={index} className="category-bar">
                    <span className="category-name">{cat.name}</span>
                    <div className="category-progress">
                      <div className="category-fill" style={{ width: `${cat.score}%`, backgroundColor: getScoreColor(cat.score) }}></div>
                    </div>
                    <span className="category-score">{cat.score}%</span>
                  </div>
                ))}
              </div>
              <div className="assessment-details">
                <span>Questions: {candidate.assessment.questionsAnswered}</span>
                <span>Correct: {candidate.assessment.correctAnswers}</span>
              </div>
            </div>
          </div>

          {candidate.flaggedInconsistencies && candidate.flaggedInconsistencies.length > 0 && (
            <div className="dashboard-card flagged-card">
              <h3>⚠️ Flagged Inconsistencies</h3>
              <div className="inconsistencies-list">
                {candidate.flaggedInconsistencies.map((item) => (
                  <div key={item.id} className={`inconsistency-item ${item.severity}`}>
                    <span className="inconsistency-type">{item.type}</span>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;