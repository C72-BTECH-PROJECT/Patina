import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Briefcase, CheckCircle, Clock, AlertTriangle, ChevronRight, Star, Filter, Download, Plus, Eye, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const AnimatedCounter = ({ end, suffix = '', duration = 1.5 }) => {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let startTime;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span>{count}{suffix}</span>;
};

const StatCard = ({ icon: Icon, label, value, trend, color, delay }) => (
  <motion.div
    className="card p-6 relative overflow-hidden group"
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ y: -4 }}
  >
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="w-6 h-6 text-foreground" />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trend > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          }`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>

      <div className="text-3xl font-extrabold text-foreground mb-1">
        <AnimatedCounter end={value} />
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  </motion.div>
);

const CandidateCard = ({ candidate, rank, onShortlist }) => {
  const scoreColor = candidate.credibilityScore >= 80 ? 'text-success' :
                     candidate.credibilityScore >= 60 ? 'text-warning' : 'text-destructive';

  return (
    <motion.div
      className="card p-5 relative group"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01, x: 2 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg ${
          rank === 1 ? 'bg-warning/10' : rank === 2 ? 'bg-muted' : rank === 3 ? 'bg-warning/5' : 'bg-muted'
        } flex items-center justify-center font-bold text-foreground`}>
          #{rank}
        </div>

        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
          <span className="font-bold text-foreground">
            {(candidate.candidateInfo?.name || 'UN').split(' ').map(n => n[0]).join('')}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">
            {candidate.candidateInfo?.name || 'Unknown'}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {candidate.candidateInfo?.email || candidate.candidateInfo?.location || 'No contact info'}
          </div>
          {candidate.jobTitle && (
            <div className="text-xs text-muted-foreground truncate mt-1">
              Job: {candidate.jobTitle}
            </div>
          )}
        </div>

        <div className="text-right">
          <div className={`text-2xl font-extrabold ${scoreColor}`}>
            {candidate.credibilityScore}
          </div>
          <div className="text-xs text-muted-foreground">Score</div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          candidate.status === 'shortlisted' ? 'bg-success/10 text-success' :
          candidate.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
          'bg-warning/10 text-warning'
        }`}>
          {candidate.status}
        </span>
        <div className="flex gap-2">
          {candidate.status !== 'shortlisted' && onShortlist && (
            <button
              onClick={() => onShortlist('shortlisted')}
              className="px-3 py-1.5 rounded-md bg-success text-success-foreground text-xs font-medium hover:bg-success/90 transition-colors"
            >
              Shortlist
            </button>
          )}
          {candidate.status === 'shortlisted' && onShortlist && (
            <button
              onClick={() => onShortlist('rejected')}
              className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors"
            >
              Reject
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const JobCard = ({ job, index }) => (
  <motion.div
    className="card p-5 relative group cursor-pointer"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    whileHover={{ scale: 1.01 }}
  >
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-bold text-foreground">{job.title}</h3>
      <Link
        to={`/recruiter/jobs/${job._id}`}
        className="px-3 py-1.5 rounded-md bg-muted border border-border text-foreground text-xs font-medium hover:bg-muted/80 transition-all no-underline"
      >
        View →
      </Link>
    </div>

    <p className="text-sm text-muted-foreground line-clamp-1 mb-3">{job.description}</p>

    <div className="flex items-center gap-2 flex-wrap">
      {job.requiredSkills?.map((skill, i) => (
        <span key={i} className="px-2 py-0.5 rounded-full bg-muted text-foreground text-xs">
          {skill}
        </span>
      ))}
    </div>

    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {job.experienceLevel || 'Any'}
      </span>
      <span className="flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        Posted recently
      </span>
    </div>
  </motion.div>
);

const skillsDistribution = [
  { name: 'React', value: 35, color: '#0a0a0a' },
  { name: 'Node.js', value: 25, color: '#525252' },
  { name: 'Python', value: 20, color: '#737373' },
  { name: 'Other', value: 20, color: '#a3a3a3' },
];

const weeklyApplications = [
  { day: 'Mon', applications: 12 },
  { day: 'Tue', applications: 19 },
  { day: 'Wed', applications: 15 },
  { day: 'Thu', applications: 25 },
  { day: 'Fri', applications: 22 },
  { day: 'Sat', applications: 8 },
  { day: 'Sun', applications: 5 },
];

const COLORS = ['#0a0a0a', '#525252', '#737373', '#a3a3a3'];

function RecruiterDashboard() {
  const [applications, setApplications] = React.useState([]);
  const [jobs, setJobs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [toast, setToast] = React.useState(null);
  const { authFetch, user } = useAuth();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadDashboard = async () => {
    try {
      const [candidatesResponse, jobsResponse, applicationsResponse] = await Promise.all([
        authFetch(`${API_BASE_URL}/api/recruiter/applicants`),
        authFetch(`${API_BASE_URL}/api/jobs/mine`),
        authFetch(`${API_BASE_URL}/api/jobs/applications`),
      ]);

      const candidatesData = candidatesResponse.ok ? await candidatesResponse.json() : [];
      const jobData = jobsResponse.ok ? await jobsResponse.json() : [];
      const applicationsData = applicationsResponse.ok ? await applicationsResponse.json() : [];

      const mappedCandidates = candidatesData.map(c => ({
        _id: c.id || Math.random().toString(),
        candidateId: c.candidateId,
        candidateInfo: c.candidateInfo || {},
        credibilityScore: Number(c.credibilityScore || 0),
        skills: c.skills || [],
        status: c.status || 'applied',
        email: c.candidateInfo?.email || '',
        phone: '',
        github: '',
        linkedin: '',
        resume: '',
        appliedAt: c.appliedAt,
        applicationId: c.applicationId || null,
        jobTitle: c.jobTitle || '',
        jobId: c.jobId || null,
      }));

      setApplications(mappedCandidates);
      setJobs(jobData);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, [authFetch]);

  const handleShortlist = async (applicationId, newStatus) => {
    if (!applicationId) {
      showToast('Missing application ID — cannot update status', 'error');
      return;
    }

    try {
      showToast('Updating...');
      const response = await authFetch(`${API_BASE_URL}/api/jobs/applications/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        showToast(data.message || 'Failed to update status', 'error');
        return;
      }

      setApplications(prev =>
        prev.map(app =>
          app.applicationId === applicationId ? { ...app, status: newStatus } : app
        )
      );
      showToast(`Candidate ${newStatus === 'shortlisted' ? 'shortlisted' : 'updated'} successfully`);
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const filteredCandidates = React.useMemo(() => {
    let filtered = [...applications];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.candidateInfo?.name?.toLowerCase().includes(query) ||
        c.candidateInfo?.email?.toLowerCase().includes(query) ||
        c.skills?.some(s => s.name.toLowerCase().includes(query))
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(c => c.status === filterStatus);
    }

    return filtered.sort((a, b) => b.credibilityScore - a.credibilityScore);
  }, [applications, searchQuery, filterStatus]);

  const shortlistedCount = applications.filter(a => a.status === 'shortlisted').length;
  const pendingCount = applications.filter(a => a.status === 'applied').length;

  return (
    <div className="space-y-8">
      {toast && (
        <motion.div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-success text-success-foreground'
          }`}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          {toast.message}
        </motion.div>
      )}
      <motion.div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">
            Recruiter Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back, <span className="text-foreground font-medium">Amit</span>. Here's your hiring overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            className="px-4 py-2 rounded-md border border-input bg-background text-foreground text-sm font-medium flex items-center gap-2 hover:bg-accent transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download className="w-4 h-4" />
            Export Report
          </motion.button>

          <Link
            to="/recruiter/create-job"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors no-underline"
          >
            <Plus className="w-4 h-4" />
            Create New Job
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Briefcase} label="Active Jobs" value={jobs.length} color="accent-purple" delay={0.1} />
        <StatCard icon={Users} label="Total Candidates" value={applications.length} trend={12} color="accent-cyan" delay={0.2} />
        <StatCard icon={CheckCircle} label="Shortlisted" value={shortlistedCount} color="accent-emerald" delay={0.3} />
        <StatCard icon={Clock} label="Pending Review" value={pendingCount} color="accent-amber" delay={0.4} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          className="card p-6 lg:col-span-2 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Weekly Applications
            </h3>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-md bg-muted text-foreground text-xs font-medium">Week</button>
              <button className="px-3 py-1.5 rounded-md bg-background text-muted-foreground text-xs font-medium hover:bg-accent">Month</button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyApplications}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="applications" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          className="card p-6 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Top Skills
          </h3>

          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={skillsDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {skillsDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {skillsDistribution.map((skill, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: skill.color }} />
                  <span className="text-xs text-muted-foreground">{skill.name}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          className="card p-6 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Candidates
            </h3>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background border border-input rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-56"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-background border border-input rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All</option>
                <option value="applied">Pending</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filteredCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No candidates match your search.</p>
            ) : (
              filteredCandidates.map((candidate, index) => (
                <CandidateCard
                  key={candidate._id}
                  candidate={candidate}
                  rank={index + 1}
                  onShortlist={(newStatus) => candidate.applicationId && handleShortlist(candidate.applicationId, newStatus)}
                />
              ))
            )}
          </div>
        </motion.div>

        <motion.div
          className="card p-6 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Recent Jobs
            </h3>
            <Link
              to="/recruiter/create-job"
              className="px-3 py-1.5 rounded-md bg-muted border border-border text-foreground text-xs font-medium hover:bg-muted/80 transition-all no-underline"
            >
              + Add New
            </Link>
          </div>

          <div className="space-y-3">
            {jobs.slice(0, 5).map((job, index) => (
              <JobCard key={job._id} job={job} index={index} />
            ))}
          </div>

          <Link
            to="/recruiter/jobs"
            className="mt-4 flex items-center justify-center gap-2 text-sm text-foreground hover:text-foreground/80 transition-colors"
          >
            View all jobs
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

export default RecruiterDashboard;
