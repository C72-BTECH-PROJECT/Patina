import React from 'react';
import { Link } from 'react-router-dom';

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200">
      <header className="flex justify-between items-center py-5 px-6 md:px-12 bg-white shadow-sm">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-indigo-500 no-underline">
          <span className="w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-lg text-lg">✓</span>
          <span>SkillVerify</span>
        </Link>
        <nav className="flex gap-4 md:gap-8">
          <Link to="/login/candidate" className="no-underline text-slate-500 font-medium transition-colors hover:text-indigo-500">For Candidates</Link>
          <Link to="/login/recruiter" className="no-underline text-slate-500 font-medium transition-colors hover:text-indigo-500">For Recruiters</Link>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center py-20 min-h-[70vh]">
          <div className="max-w-xl text-center md:text-left animate-fadeIn">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-slate-800 mb-6">
              Verify Skills with
              <span className="bg-clip-text text-transparent bg-gradient-to-br from-indigo-500 to-violet-500"> AI-Powered</span>
              <br />Credibility Assessment
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed mb-10">
              The smartest way to validate candidate skills. Connect GitHub,
              upload your resume, and get instant credibility scores based on
              real-world activity and assessment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link to="/select-role" className="group bg-indigo-600 hover:bg-indigo-700 text-white py-4 px-8 rounded-lg font-medium text-lg flex items-center justify-center transition-colors no-underline">
                Get Started
                <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <Link to="/candidate/dashboard" className="bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 py-4 px-8 rounded-lg font-medium text-lg flex items-center justify-center transition-colors no-underline">
                View Demo
              </Link>
            </div>
          </div>

          <div className="flex justify-center items-center animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            <div className="bg-white rounded-2xl p-10 shadow-2xl text-center w-80">
              <div className="mb-6">
                <span className="block text-7xl font-extrabold text-emerald-500 leading-none">82</span>
                <span className="block text-sm text-slate-500 mt-2">Credibility Score</span>
              </div>
              <div className="flex gap-2 justify-center flex-wrap mb-6">
                <span className="py-1.5 px-3 bg-indigo-50 text-indigo-500 rounded-full text-sm font-medium">Python</span>
                <span className="py-1.5 px-3 bg-indigo-50 text-indigo-500 rounded-full text-sm font-medium">React</span>
                <span className="py-1.5 px-3 bg-indigo-50 text-indigo-500 rounded-full text-sm font-medium">Node.js</span>
              </div>
              <div className="inline-flex items-center gap-1.5 py-2 px-4 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800">
                <span>✓</span> Verified
              </div>
            </div>
          </div>
        </div>

        <div className="py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 text-center shadow hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
              <div className="text-5xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Upload Resume</h3>
              <p className="text-slate-500 leading-relaxed">Submit your resume and let our AI extract your skills and experience.</p>
            </div>
            <div className="bg-white rounded-2xl p-8 text-center shadow hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fadeIn" style={{ animationDelay: '0.4s' }}>
              <div className="text-5xl mb-4">🔗</div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Connect GitHub</h3>
              <p className="text-slate-500 leading-relaxed">Link your GitHub profile to verify real-world coding activity.</p>
            </div>
            <div className="bg-white rounded-2xl p-8 text-center shadow hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fadeIn" style={{ animationDelay: '0.5s' }}>
              <div className="text-5xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Get Credibility Score</h3>
              <p className="text-slate-500 leading-relaxed">Receive a comprehensive score based on skills, activity, and assessment.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-16">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl p-8 text-center text-white">
            <span className="block text-5xl font-extrabold mb-1">10K+</span>
            <span className="block text-base opacity-90">Candidates Verified</span>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl p-8 text-center text-white">
            <span className="block text-5xl font-extrabold mb-1">500+</span>
            <span className="block text-base opacity-90">Companies Using</span>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl p-8 text-center text-white">
            <span className="block text-5xl font-extrabold mb-1">95%</span>
            <span className="block text-base opacity-90">Accuracy Rate</span>
          </div>
        </div>
      </main>

      <footer className="p-8 text-center text-slate-500 border-t border-slate-200">
        <p>&copy; 2024 SkillVerify. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default Landing;