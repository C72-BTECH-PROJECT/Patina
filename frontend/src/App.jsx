import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';

// common pages
import Landing from './pages/public/Landing';
import RoleSelection from './pages/public/RoleSelection';
import Login from './pages/public/Login';
import EmailConfirmed from './pages/public/EmailConfirmed';
import ResetPassword from './pages/public/ResetPassword';
import NotFound from './pages/public/NotFound';
import AdminDashboard from './pages/admin/Dashboard';

// candidate flow
import Upload from './pages/candidate/Upload';
import Results from './pages/candidate/Results';
import CandidateDashboard from './pages/candidate/Dashboard';
import CandidateLayout from './components/layouts/CandidateLayout';
import CandidateProfile from './pages/candidate/CandidateProfile';
import CandidateJobs from './pages/candidate/CandidateJobs';
import CandidateNotifications from './pages/candidate/Notifications';
import CandidateJobDetail from './pages/candidate/JobDetail';
import Assessment from './pages/candidate/Assessment';

// recruiter flow
import RecruiterLayout from './components/layouts/RecruiterLayout';
import Profile from './pages/recruiter/Profile';
import RecruiterDashboard from './pages/recruiter/Dashboard';
import Jobs from './pages/recruiter/Jobs';
import JobDetails from './pages/recruiter/JobDetails';
import CreateJob from './pages/recruiter/CreateJob';
import Applications from './pages/recruiter/Applications';
import { AuthProvider } from './context/AuthContext';
import RequireRole from './components/auth/RequireRole';

function App() {
  return (
    <MotionConfig reducedMotion="user">
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
            <Route path="/candidate" element={<RequireRole role="CANDIDATE"><CandidateLayout /></RequireRole>}>
              <Route index element={<Navigate to="/candidate/dashboard" replace />} />
              <Route path="dashboard" element={<CandidateDashboard />} />
              {/* R-16: results are per application; /results alone lets the candidate pick one. */}
              <Route path="results" element={<Results />} />
              <Route path="results/:applicationId" element={<Results />} />
              <Route path="jobs" element={<CandidateJobs />} />
              <Route path="jobs/:id" element={<CandidateJobDetail />} />
              <Route path="profile" element={<CandidateProfile />} />
              <Route path="notifications" element={<CandidateNotifications />} />
              <Route path="assessment" element={<Assessment />} />
            </Route>

            {/* 🧑‍💼 RECRUITER FLOW (WITH LAYOUT) */}
            <Route path="/recruiter" element={<RequireRole role="RECRUITER"><RecruiterLayout /></RequireRole>}>
              <Route index element={<Navigate to="/recruiter/dashboard" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="dashboard" element={<RecruiterDashboard />} />
              {/* R-18 (Y2, Y6): one application-centric view; the old candidates URL points to it. */}
              <Route path="applications" element={<Applications />} />
              <Route path="candidates" element={<Navigate to="/recruiter/applications" replace />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="jobs/:id" element={<JobDetails />} />
              <Route path="create-job" element={<CreateJob />} />
            </Route>

            {/* Anything else: an honest "page not found", never a blank screen. */}
            <Route path="*" element={<NotFound />} />

          </Routes>

        </div>
      </Router>
    </AuthProvider>
    </MotionConfig>
  );
}

export default App;
