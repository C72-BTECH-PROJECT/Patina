import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Dashboard() {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5001/api/candidate')
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
    if (score >= 75) return '#10b981'; // emerald-500
    if (score >= 50) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
          <p>Loading candidate data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-4">
          <h2>Error: {error}</h2>
          <p>Make sure the backend server is running on port 5001</p>
          <Link to="/" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">Go Home</Link>
        </div>
      </div>
    );
  }

  if (!candidate) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex justify-between items-center py-5 px-6 md:px-12 bg-white shadow-sm">
        <Link to="/" className="flex flex-row items-center gap-2 no-underline text-slate-500 font-medium transition-colors hover:text-indigo-500">
          <span>←</span> Back
        </Link>
        <div className="flex items-center gap-2 text-xl font-bold text-indigo-500">
          <span className="w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-lg text-lg">✓</span>
          <span>SkillVerify</span>
        </div>
        <div className="w-[100px]"></div>
      </header>

      <main className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6 md:gap-0">
            <div className="flex flex-col">
              <h1 className="text-4xl font-bold text-slate-800 mb-2">{candidate.name}</h1>
              <p className="text-slate-500 mb-4">{candidate.location}</p>
              <div className="flex gap-3 flex-wrap">
                <span className="py-1.5 px-3 rounded-full text-sm font-medium bg-blue-100 text-blue-800">✓ Resume Parsed</span>
                <span className="py-1.5 px-3 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">✓ GitHub Connected</span>
                <span className="py-1.5 px-3 rounded-full text-sm font-medium bg-amber-100 text-amber-800">⏳ Background Check</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl py-6 px-8 shadow text-center w-full md:w-auto">
              <span className="block text-sm text-slate-500 mb-2">Credibility Score</span>
              <span className="text-6xl font-extrabold" style={{ color: getScoreColor(candidate.credibilityScore) }}>
                {candidate.credibilityScore}
              </span>
              <span className="text-2xl text-slate-400">/ 100</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow">
              <h3 className="text-lg font-semibold text-slate-800 mb-5 pb-3 border-b border-slate-200">Verified Skills</h3>
              <div className="flex flex-col gap-3">
                {candidate.skills.map((skill, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <span className="font-semibold text-slate-800">{skill.name}</span>
                    <span className={`text-xs py-1 px-2 rounded-full ${skill.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {skill.verified ? '✓ Verified' : '✗ Unverified'}
                    </span>
                    <span className="ml-auto text-sm text-slate-500">{skill.level}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow">
              <h3 className="text-lg font-semibold text-slate-800 mb-5 pb-3 border-b border-slate-200">GitHub Metrics</h3>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="text-center p-4 bg-slate-50 rounded-lg text-slate-800">
                  <span className="block text-3xl font-bold text-slate-800">{candidate.github.commits}</span>
                  <span className="block text-sm text-slate-600 font-medium">Commits</span>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg text-slate-800">
                  <span className="block text-3xl font-bold text-slate-800">{candidate.github.repos}</span>
                  <span className="block text-sm text-slate-600 font-medium">Repositories</span>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg text-slate-800">
                  <span className="block text-3xl font-bold text-slate-800">{candidate.github.totalStars}</span>
                  <span className="block text-sm text-slate-600 font-medium">Stars</span>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg text-slate-800">
                  <span className="block text-3xl font-bold text-slate-800">{candidate.github.totalForks}</span>
                  <span className="block text-sm text-slate-600 font-medium">Forks</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm text-slate-500 mb-3">Top Languages</h4>
                <div className="flex gap-2 flex-wrap">
                  {candidate.github.languages.map((lang, index) => (
                    <span key={index} className="py-1.5 px-3 bg-indigo-50 text-indigo-500 rounded-full text-sm font-medium">{lang}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow">
              <h3 className="text-lg font-semibold text-slate-800 mb-5 pb-3 border-b border-slate-200">Assessment Results</h3>
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1" style={{ color: getScoreColor(candidate.assessment.score) }}>
                  <span className="text-5xl font-extrabold">{candidate.assessment.score}</span>
                  <span className="text-xl text-slate-400">/ 100</span>
                </div>
                <span className="block text-sm text-slate-500 mt-2">Difficulty: {candidate.assessment.difficulty}</span>
              </div>
              <div className="flex flex-col gap-3">
                {candidate.assessment.categories.map((cat, index) => (
                  <div key={index} className="flex flex-row items-center gap-3">
                    <span className="text-sm text-slate-500 min-w-[100px]">{cat.name}</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${cat.score}%`, backgroundColor: getScoreColor(cat.score) }}></div>
                    </div>
                    <span className="text-sm font-semibold min-w-[40px]">{cat.score}%</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-around mt-5 pt-4 border-t border-slate-200 text-sm text-slate-500">
                <span>Questions: {candidate.assessment.questionsAnswered}</span>
                <span>Correct: {candidate.assessment.correctAnswers}</span>
              </div>
            </div>
          </div>

          {candidate.flaggedInconsistencies && candidate.flaggedInconsistencies.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow border-l-4 border-amber-500">
              <h3 className="text-lg font-semibold text-slate-800 mb-5 pb-3 border-b border-slate-200">⚠️ Flagged Inconsistencies</h3>
              <div className="flex flex-col gap-3">
                {candidate.flaggedInconsistencies.map((item) => (
                  <div key={item.id} className={`p-4 rounded-lg ${item.severity === 'medium' ? 'bg-yellow-50' : 'bg-teal-50'}`}>
                    <span className="inline-block text-xs font-semibold uppercase mb-2 text-amber-800">{item.type}</span>
                    <p className="text-slate-800 leading-relaxed">{item.description}</p>
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