import React from 'react';
import { Link } from 'react-router-dom';
import { jobs, applications } from './data/mockData';

function Jobs() {
  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center border-b border-slate-200 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Posted Jobs</h1>
          <p className="text-slate-500 mt-2">Manage your active job listings and candidates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {jobs.map(job => {
          const count = applications.filter(a => a.jobId === job._id).length;
          
          return (
            <div key={job._id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center hover:shadow-md transition-shadow">
              <div className="flex-1 mb-4 md:mb-0">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  {job.title}
                  {count > 0 && <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold px-2 py-1">{count} New</span>}
                </h2>
                
                <div className="flex flex-wrap gap-2 mt-3">
                  {job.requiredSkills.map(skill => (
                    <span key={skill} className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-md">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col items-start md:items-end gap-3 self-stretch justify-between">
                <span className="text-slate-500 text-sm font-medium">{count} Applications Total</span>
                <Link to={`/recruiter/jobs/${job._id}`} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white font-semibold py-2 px-6 rounded-lg transition-colors no-underline">
                  View Candidates
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Jobs;