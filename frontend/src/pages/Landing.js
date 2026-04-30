import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

function Landing() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="logo">
          <span className="logo-icon">✓</span>
          <span className="logo-text">SkillVerify</span>
        </div>
        <nav className="nav-links">
          <Link to="/upload" className="nav-link">For Candidates</Link>
          <Link to="/dashboard" className="nav-link">For Recruiters</Link>
        </nav>
      </header>

      <main className="landing-main">
        <div className="hero-section">
          <div className="hero-content animate-fadeIn">
            <h1 className="hero-title">
              Verify Skills with
              <span className="highlight"> AI-Powered</span>
              <br />Credibility Assessment
            </h1>
            <p className="hero-subtitle">
              The smartest way to validate candidate skills. Connect GitHub,
              upload your resume, and get instant credibility scores based on
              real-world activity and assessment.
            </p>
            <div className="hero-buttons">
              <Link to="/upload" className="btn btn-primary btn-large">
                Get Started
                <span className="btn-arrow">→</span>
              </Link>
              <Link to="/dashboard" className="btn btn-secondary btn-large">
                View Demo
              </Link>
            </div>
          </div>

          <div className="hero-visual animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            <div className="demo-card">
              <div className="demo-score">
                <span className="score-number">82</span>
                <span className="score-label">Credibility Score</span>
              </div>
              <div className="demo-skills">
                <span className="skill-badge">Python</span>
                <span className="skill-badge">React</span>
                <span className="skill-badge">Node.js</span>
              </div>
              <div className="demo-badge verified">
                <span>✓</span> Verified
              </div>
            </div>
          </div>
        </div>

        <div className="features-section">
          <h2 className="section-title">How It Works</h2>
          <div className="features-grid">
            <div className="feature-card animate-fadeIn" style={{ animationDelay: '0.3s' }}>
              <div className="feature-icon">📄</div>
              <h3>Upload Resume</h3>
              <p>Submit your resume and let our AI extract your skills and experience.</p>
            </div>
            <div className="feature-card animate-fadeIn" style={{ animationDelay: '0.4s' }}>
              <div className="feature-icon">🔗</div>
              <h3>Connect GitHub</h3>
              <p>Link your GitHub profile to verify real-world coding activity.</p>
            </div>
            <div className="feature-card animate-fadeIn" style={{ animationDelay: '0.5s' }}>
              <div className="feature-icon">📊</div>
              <h3>Get Credibility Score</h3>
              <p>Receive a comprehensive score based on skills, activity, and assessment.</p>
            </div>
          </div>
        </div>

        <div className="stats-section">
          <div className="stat-card">
            <span className="stat-number">10K+</span>
            <span className="stat-label">Candidates Verified</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">500+</span>
            <span className="stat-label">Companies Using</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">95%</span>
            <span className="stat-label">Accuracy Rate</span>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <p>&copy; 2024 SkillVerify. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default Landing;