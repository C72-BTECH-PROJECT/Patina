import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// common pages
import Landing from './pages/public/Landing';
import RoleSelection from './pages/public/RoleSelection';
import Login from './pages/public/Login';
import EmailConfirmed from './pages/public/EmailConfirmed';
import ResetPassword from './pages/public/ResetPassword';
import AdminDashboard from './pages/admin/Dashboard';

// candidate flow
import Upload from './pages/candidate/Upload';
import Processing from './pages/candidate/Processing';
import CandidateDashboard from './pages/candidate/Dashboard';
import CandidateLayout from './components/layouts/CandidateLayout';
import CandidateProfile from './pages/candidate/CandidateProfile';
import CandidateJobs from './pages/candidate/CandidateJobs';
import CandidateJobDetail from './pages/candidate/JobDetail';

// recruiter flow
import RecruiterLayout from './components/layouts/RecruiterLayout';
import Profile from './pages/recruiter/Profile';
import RecruiterDashboard from './pages/recruiter/Dashboard';
import Jobs from './pages/recruiter/Jobs';
import JobDetails from './pages/recruiter/JobDetails';
import CreateJob from './pages/recruiter/CreateJob';
import { AuthProvider } from './context/AuthContext';
import RequireRole from './components/auth/RequireRole';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen">

          <Routes>

            {/* 🌐 COMMON */}
            <Route path="/" element={<Landing />} />
            <Route path="/select-role" element={<RoleSelection />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Login />} />
            {/* Keep old links functional while using the shared authentication flow. */}
            <Route path="/login/:role" element={<Navigate to="/login" replace />} />
            <Route path="/signup/:role" element={<Navigate to="/signup" replace />} />
            <Route path="/email-confirmed" element={<EmailConfirmed />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin/dashboard" element={<RequireRole role="ADMIN"><AdminDashboard /></RequireRole>} />

            {/* 👤 CANDIDATE FLOW */}
            <Route path="/candidate/upload" element={<RequireRole role="CANDIDATE"><Upload /></RequireRole>} />
            <Route path="/candidate/processing" element={<RequireRole role="CANDIDATE"><Processing /></RequireRole>} />
            <Route path="/candidate" element={<RequireRole role="CANDIDATE"><CandidateLayout /></RequireRole>}>
              <Route path="dashboard" element={<CandidateDashboard />} />
              <Route path="jobs" element={<CandidateJobs />} />
              <Route path="jobs/:id" element={<CandidateJobDetail />} />
              <Route path="profile" element={<CandidateProfile />} />
            </Route>

            {/* 🧑‍💼 RECRUITER FLOW (WITH LAYOUT) */}
            <Route path="/recruiter" element={<RequireRole role="RECRUITER"><RecruiterLayout /></RequireRole>}>

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
