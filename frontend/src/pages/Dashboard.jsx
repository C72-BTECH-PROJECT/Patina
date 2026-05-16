import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

function Dashboard() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5001/api/candidate-analysis')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch candidate analysis');
        return res.json();
      })
      .then((data) => {
        setAnalysis(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Dashboard load failed');
        setLoading(false);
      });
  }, []);

  const matchColor = useMemo(() => {
    return {
      High: '#10b981',
      Medium: '#f59e0b',
      Low: '#ef4444',
    };
  }, []);

  const credibilityColor = (score) => {
    if (score >= 75) return matchColor.High;
    if (score >= 50) return matchColor.Medium;
    return matchColor.Low;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          <p>Loading your analysis…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-4">
          <h2 className="text-slate-800 font-bold text-xl">Error</h2>
          <p className="text-slate-600">{error}</p>
          <Link
            to="/candidate/upload"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium"
          >
            Upload Resume Again
          </Link>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const {
    candidate,
    matchPercentage,
    extractedSkills,
    projects,
    experienceLevel,
    match_level,
    verifiedSkills,
    credibilityScore,
  } = analysis;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex justify-between items-center py-5 px-6 md:px-12 bg-white shadow-sm">
        <Link
          to="/candidate/upload"
          className="flex flex-row items-center gap-2 no-underline text-slate-500 font-medium transition-colors hover:text-indigo-500"
        >
          <span>←</span> Back
        </Link>

        <div className="flex items-center gap-2 text-xl font-bold text-indigo-500">
          <span className="w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-lg text-lg">✓</span>
          <span>Patina</span>
        </div>

        <div className="w-[100px]" />
      </header>

      <main className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6 md:gap-0">
            <div className="flex flex-col">
              <h1 className="text-4xl font-bold text-slate-800 mb-2">{candidate?.name || 'Candidate'}</h1>
              <p className="text-slate-500 mb-4">{candidate?.location || '—'}</p>

              <div className="flex gap-3 flex-wrap">
                <span className="py-1.5 px-3 rounded-full text-sm font-medium bg-blue-100 text-blue-800">✓ Resume Parsed</span>
                <span className="py-1.5 px-3 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">✓ Job Matched</span>
                <span className="py-1.5 px-3 rounded-full text-sm font-medium bg-slate-100 text-slate-700">⏳ Pipeline Complete</span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-600">Experience:</span>
                <span className="text-sm font-medium text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-full">
                  {experienceLevel || '—'}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl py-6 px-8 shadow text-center w-full md:w-auto">
              <span className="block text-sm text-slate-500 mb-2">Match Percentage</span>
              <span className="text-6xl font-extrabold" style={{ color: matchColor[match_level] || '#10b981' }}>
                {matchPercentage ?? 0}
              </span>
              <span className="text-2xl text-slate-400">%</span>
              <div className="mt-2">
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                  style={{ backgroundColor: `${(matchColor[match_level] || '#10b981').replace('10b981','dcfce7')}` }}
                >
                  Match Level: {match_level || '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow glassmorphism">
              <h3 className="text-lg font-semibold text-slate-800 mb-5 pb-3 border-b border-slate-200">Extracted Skills</h3>
              <div className="flex flex-col gap-3">
                {(extractedSkills || []).length === 0 ? (
                  <div className="text-sm text-slate-500">No skills extracted.</div>
                ) : (
                  (extractedSkills || []).map((s, idx) => {
                    const verified = (verifiedSkills || []).some((vs) => vs.name === s);
                    return (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-slate-800">{s}</span>
                        <span
                          className={`text-xs py-1 px-2 rounded-full ${verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                        >
                          {verified ? '✓ Verified' : '• Unverified'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow">
              <h3 className="text-lg font-semibold text-slate-800 mb-5 pb-3 border-b border-slate-200">Projects</h3>
              <div className="flex flex-col gap-3">
                {(projects || []).length === 0 ? (
                  <div className="text-sm text-slate-500">No projects parsed.</div>
                ) : (
                  (projects || []).map((p, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-sm font-medium text-slate-900">{p}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow">
              <h3 className="text-lg font-semibold text-slate-800 mb-5 pb-3 border-b border-slate-200">Credibility</h3>
              <div className="text-center mb-5">
                <div className="text-5xl font-extrabold" style={{ color: credibilityColor(credibilityScore || 0) }}>
                  {credibilityScore ?? 0}
                </div>
                <div className="text-sm text-slate-500 mt-2">/ 100</div>
              </div>

              <h4 className="text-sm text-slate-600 font-semibold mb-3">Verified Skills (sample)</h4>
              <div className="flex flex-col gap-3">
                {(verifiedSkills || []).length === 0 ? (
                  <div className="text-sm text-slate-500">No verified skills.</div>
                ) : (
                  (verifiedSkills || []).map((vs, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-slate-800">{vs.name}</span>
                      <span className="text-xs py-1 px-2 rounded-full bg-emerald-100 text-emerald-800">✓ Verified</span>
                      <span className="ml-auto text-sm text-slate-500">{vs.level}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow border-l-4" style={{ borderLeftColor: matchColor[match_level] || '#10b981' }}>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Summary</h3>
            <p className="text-slate-600">
              Based on semantic similarity to the selected job description, extracted skills, and project indicators, the system generated a credibility score and match level.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;

