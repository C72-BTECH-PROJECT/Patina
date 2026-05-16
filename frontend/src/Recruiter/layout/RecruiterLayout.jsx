import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import Profile from '../components/RecruiterProfileCard.jsx';

function RecruiterLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 shrink-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/recruiter/dashboard" className="flex items-center gap-2 text-xl font-bold text-indigo-500 no-underline">
            <span className="w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-lg text-lg">✓</span>
<span className="font-extrabold tracking-tight text-2xl">PATINA Recruiter</span>
          </Link>
          
          <div className="flex gap-6">
            <Link to="/recruiter/dashboard" className="text-slate-600 hover:text-indigo-600 font-medium no-underline transition-colors">Dashboard</Link>
            <Link to="/recruiter/jobs" className="text-slate-600 hover:text-indigo-600 font-medium no-underline transition-colors">Jobs</Link>
          </div>
          
          <Link to="/recruiter/profile">
  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold cursor-pointer">
    AV
  </div>
</Link>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
         <Outlet />
      </main>
    </div>
  );
}

export default RecruiterLayout;