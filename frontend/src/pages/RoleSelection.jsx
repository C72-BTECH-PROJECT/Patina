import React from 'react';
import { Link } from 'react-router-dom';

function RoleSelection() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex flex-col">
      <header className="flex justify-between items-center py-5 px-6 md:px-12 bg-white shadow-sm shrink-0">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-indigo-500 no-underline">
          <span className="w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-lg text-lg">✓</span>
          <span>SkillVerify</span>
        </Link>
        <Link to="/" className="text-slate-500 hover:text-indigo-500 font-medium">← Back to Home</Link>
      </header>

      <main className="flex-1 flex justify-center items-center py-12 px-6">
        <div className="max-w-3xl w-full text-center">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">How would you like to use SkillVerify?</h1>
          <p className="text-lg text-slate-500 mb-12">Choose your role to get started with the platform.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Link to="/login/candidate" className="bg-white hover:border-indigo-500 hover:shadow-xl border-2 border-transparent rounded-2xl p-10 text-center transition-all duration-300 group no-underline">
              <div className="text-6xl mb-6 group-hover:scale-110 transition-transform">💻</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-indigo-600 transition-colors">I'm a Candidate</h2>
              <p className="text-slate-500 leading-relaxed">
                Connect your GitHub, upload your resume, and verify your skills to stand out to top employers.
              </p>
            </Link>

            <Link to="/login/recruiter" className="bg-white hover:border-indigo-500 hover:shadow-xl border-2 border-transparent rounded-2xl p-10 text-center transition-all duration-300 group no-underline">
              <div className="text-6xl mb-6 group-hover:scale-110 transition-transform">🏢</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-indigo-600 transition-colors">I'm a Recruiter</h2>
              <p className="text-slate-500 leading-relaxed">
                Review verified candidate profiles, credibility scores, and make data-driven hiring decisions.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default RoleSelection;