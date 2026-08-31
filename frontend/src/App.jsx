import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// common pages
import Landing from './pages/public/Landing';
import RoleSelection from './pages/public/RoleSelection';
import Login from './pages/public/Login';
import EmailConfirmed from './pages/public/EmailConfirmed';

// candidate flow
import Upload from './pages/candidate/Upload';
import Processing from './pages/candidate/Processing';
import CandidateDashboard from './pages/candidate/Dashboard';
import CandidateLayout from './components/layouts/CandidateLayout';
import CandidateProfile from './pages/candidate/CandidateProfile';
import CandidateJobs from './pages/candidate/CandidateJobs';

// recruiter flow
import RecruiterLayout from './components/layouts/RecruiterLayout';
import Profile from './pages/recruiter/Profile';
import RecruiterDashboard from './pages/recruiter/Dashboard';
import Jobs from './pages/recruiter/Jobs';
import JobDetails from './pages/recruiter/JobDetails';
import CreateJob from './pages/recruiter/CreateJob';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen">

          <Routes>

            {/* 🌐 COMMON */}
            <Route path="/" element={<Landing />} />
            <Route path="/select-role" element={<RoleSelection />} />
            <Route path="/login/:role" element={<Login />} />
            <Route path="/signup/:role" element={<Login />} />
            <Route path="/email-confirmed" element={<EmailConfirmed />} />

            {/* 👤 CANDIDATE FLOW */}
            <Route path="/candidate/upload" element={<Upload />} />
            <Route path="/candidate/processing" element={<Processing />} />
            <Route path="/candidate" element={<CandidateLayout />}>
              <Route path="dashboard" element={<CandidateDashboard />} />
              <Route path="jobs" element={<CandidateJobs />} />
              <Route path="profile" element={<CandidateProfile />} />
            </Route>

            {/* 🧑‍💼 RECRUITER FLOW (WITH LAYOUT) */}
            <Route path="/recruiter" element={<RecruiterLayout />}>

              <Route path="profile" element={<Profile />} />
              <Route path="dashboard" element={<RecruiterDashboard />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="jobs/:id" element={<JobDetails />} />
              <Route path="create-job" element={<CreateJob />} />

            </Route>

          </Routes>

        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
