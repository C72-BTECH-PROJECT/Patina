import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// common pages
import Landing from './pages/Landing';
import RoleSelection from './pages/RoleSelection';
import Login from './pages/Login';

// candidate flow
import Upload from './pages/Upload';
import Processing from './pages/Processing';
import CandidateDashboard from './pages/Dashboard';

// recruiter flow
import RecruiterLayout from './Recruiter/layout/RecruiterLayout';
import Profile from './Recruiter/components/RecruiterProfileCard';
import RecruiterDashboard from './Recruiter/Dashboard';
import Jobs from './Recruiter/Jobs';
import JobDetails from './Recruiter/JobDetails';
import CreateJob from './Recruiter/CreateJob';
import { recruiters } from './Recruiter/data/mockData';

function App() {
  return (
    <Router>
      <div className="min-h-screen">

        <Routes>

          {/* 🌐 COMMON */}
          <Route path="/" element={<Landing />} />
          <Route path="/select-role" element={<RoleSelection />} />
          <Route path="/login/:role" element={<Login />} />

          {/* 👤 CANDIDATE FLOW */}
          <Route path="/candidate/upload" element={<Upload />} />
          <Route path="/candidate/processing" element={<Processing />} />
          <Route path="/candidate/dashboard" element={<CandidateDashboard />} />

          {/* 🧑‍💼 RECRUITER FLOW (WITH LAYOUT) */}
          <Route path="/recruiter" element={<RecruiterLayout />}>

            <Route path="profile" element={<Profile recruiter={recruiters[0]} />} />
            <Route path="dashboard" element={<RecruiterDashboard />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="jobs/:id" element={<JobDetails />} />
            <Route path="create-job" element={<CreateJob />} />

          </Route>

        </Routes>

      </div>
    </Router>
  );
}

export default App;