import React from 'react';
import { Link } from 'react-router-dom';
import { jobs, candidates, applications } from './data/mockData';

function RecruiterDashboard() {
  const topCandidates = candidates.map(c => {
    const app = applications.find(a => a.candidate === c._id);
    return {
      ...c,
      credibilityScore: app?.credibilityScore || 0
    };
  })
  .sort((a,b) => b.credibilityScore - a.credibilityScore)
  .slice(0, 3);

  
  const recentJobs = jobs.slice(0, 3);
  const shortlistedCount = applications.filter(a => a.status === 'shortlisted').length;

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Recruiter Dashboard</h1>
          <p className="text-slate-500">Welcome back, Amit. Here's what's happening.</p>
        </div>
        <Link to="/recruiter/create-job" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-sm inline-flex items-center gap-2 no-underline">
          <span className="text-xl leading-none">+</span> Create New Job
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
          <span className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Total Jobs</span>
          <span className="text-5xl font-extrabold text-indigo-600 mt-2">{jobs.length}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
          <span className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Total Applications</span>
          <span className="text-5xl font-extrabold text-slate-800 mt-2">{applications.length}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
          <span className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Shortlisted</span>
          <span className="text-5xl font-extrabold text-emerald-500 mt-2">{shortlistedCount}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-bold text-slate-800 text-lg">Recent Jobs</h2>
            <Link to="/recruiter/jobs" className="text-indigo-600 font-medium text-sm hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentJobs.map(job => (
              <div key={job._id} className="p-6 flex justify-between items-center hover:bg-slate-50 transition-colors">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{job.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-1">{job.description}</p>
                </div>
                <Link to={`/recruiter/jobs/${job._id}`} className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                  View →
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-bold text-slate-800 text-lg">Recent Candidates</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {topCandidates.map(cand => (
              <div key={cand._id} className="p-6 flex justify-between items-center hover:bg-slate-50 transition-colors">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800">{cand.name}</span>
                  <span className="text-sm text-slate-500">Credibility: <span className={cand.credibilityScore > 80 ? 'text-emerald-500 font-semibold' : 'text-amber-500 font-semibold'}>{cand.credibilityScore}/100</span></span>
                </div>
                <span className="text-slate-400 text-sm">Preview</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecruiterDashboard;