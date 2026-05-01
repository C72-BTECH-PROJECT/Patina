import React from 'react';

function CandidateModal({ candidate, onClose }) {
  if (!candidate) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 min-h-screen overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative max-h-[90vh] overflow-y-auto animate-fadeIn m-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full w-10 h-10 flex items-center justify-center font-bold transition-colors z-10"
          title="Close Modal"
        >
          ×
        </button>

        <div className="p-8 pb-0">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-800 mb-1">{candidate.name}</h2>
              <p className="text-slate-500 mb-1 flex items-center gap-2">
                <span>📍 {candidate.location}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>✉️ {candidate.email}</span>
              </p>
            </div>
            <div className="text-center bg-slate-50 px-6 py-3 rounded-2xl shadow-inner">
              <span className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Credibility</span>
              <span className={`text-5xl font-black ${candidate.credibilityScore > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {candidate.credibilityScore}
              </span>
            </div>
          </div>

          <div className="flex gap-4 border-b border-slate-100 pb-8 mb-8">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors shadow-sm no-underline">
              Send Offer
            </button>
            <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 font-semibold py-2.5 px-6 rounded-xl transition-colors no-underline">
              Contact
            </button>
          </div>
        </div>

        {/* Detailed Application Info (Mirrors Dashboard.jsx logic) */}
        <div className="p-8 pt-0 grid gap-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Skills */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-800 text-lg mb-4 border-b border-slate-100 pb-2">Verified Skills</h3>
              <div className="flex flex-col gap-3">
                {candidate.skills.map((skill, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="font-semibold text-slate-700">{skill.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">{skill.level}</span>
                      {skill.verified ? 
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 flex items-center justify-center rounded-full font-bold">✓</span> : 
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 flex items-center justify-center rounded-full font-bold">!</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GitHub */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-800 text-lg mb-4 border-b border-slate-100 pb-2">GitHub Analysis</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <span className="block text-2xl font-black text-indigo-600">{candidate.github.commits}</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Commits</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <span className="block text-2xl font-black text-indigo-600">{candidate.github.repos}</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Repos</span>
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-600 mb-2">Top Languages:</p>
              <div className="flex flex-wrap gap-2">
                {candidate.github.languages.map((l, i) => (
                  <span key={i} className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-bold">{l}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Assessment */}
           <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-800 text-lg mb-4 border-b border-slate-100 pb-2 flex justify-between items-center">
                <span>AI Assessment</span>
                <span className="text-sm font-semibold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase tracking-widest">{candidate.assessment.score}/100</span>
              </h3>
              
              <div className="flex flex-col gap-4">
                {candidate.assessment.categories.map((cat, index) => (
                  <div key={index} className="flex flex-col">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-slate-600">{cat.name}</span>
                      <span className="text-sm font-bold text-slate-800">{cat.score}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cat.score > 80 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{width: `${cat.score}%`}}></div>
                    </div>
                  </div>
                ))}
              </div>
           </div>

           {/* Flags */}
           {candidate.flaggedInconsistencies && candidate.flaggedInconsistencies.length > 0 && (
             <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-6 flex flex-col gap-3">
               <h3 className="font-bold text-amber-900 text-lg flex items-center gap-2">
                 <span>⚠️</span> AI Flagged Inconsistencies
               </h3>
               {candidate.flaggedInconsistencies.map(flag => (
                 <div key={flag.id} className="p-4 bg-white border border-amber-100 rounded-lg">
                    <p className="text-sm text-slate-700 font-medium">{flag.description}</p>
                 </div>
               ))}
             </div>
           )}

        </div>
      </div>
    </div>
  );
}

export default CandidateModal;