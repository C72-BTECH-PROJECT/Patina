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

const CandidateCard = ({ candidate, rank }) => {
  const scoreColor = candidate.credibilityScore >= 80 ? 'text-success' :
                     candidate.credibilityScore >= 60 ? 'text-warning' : 'text-destructive';

  return (
    <motion.div
      className="card p-5 relative group cursor-pointer"
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
            {candidate.candidateInfo?.name?.split(' ').map(n => n[0]).join('') || 'UN'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">
            {candidate.candidateInfo?.name || 'Unknown'}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {candidate.candidateInfo?.location || 'Location unknown'}
          </div>
        </div>

        <div className="text-right">
          <div className={`text-2xl font-extrabold ${scoreColor}`}>
            {candidate.credibilityScore}
          </div>
          <div className="text-xs text-muted-foreground">Score</div>
        </div>

        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>

      <div className="flex gap-2 mt-3 flex-wrap">
        {candidate.skills?.slice(0, 3).map((skill, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 rounded-full text-xs ${
              skill.verified
                ? 'bg-success/10 text-success'
                : 'bg-warning/10 text-warning'
            }`}
          >
            {skill.name}
          </span>
        ))}
        {candidate.skills?.length > 3 && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
            +{candidate.skills.length - 3}
          </span>
        )}
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
  const { authFetch } = useAuth();

  React.useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [candidateResponse, jobsResponse] = await Promise.all([
          authFetch(`${API_BASE_URL}/api/candidates`),
          authFetch(`${API_BASE_URL}/api/jobs/mine`),
        ]);
        const data = candidateResponse.ok ? await candidateResponse.json() : [];
        const jobData = jobsResponse.ok ? await jobsResponse.json() : [];
        const mappedData = data.map(c => ({
          _id: c.id || Math.random().toString(),
          candidateInfo: c.candidate,
          credibilityScore: c.credibilityScore || 0,
          skills: c.verifiedSkills || [],
          status: 'applied'
        }));
        setApplications(mappedData);
        setJobs(jobData);
      } catch (err) {
        console.error('Failed to fetch candidates:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [authFetch]);

  const topCandidates = [...applications].sort((a, b) => b.credibilityScore - a.credibilityScore);
  const shortlistedCount = applications.filter(a => a.status === 'shortlisted').length;
  const pendingCount = applications.filter(a => a.status === 'applied').length;

  return (
    <div className="space-y-8">
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Top Candidates
            </h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select className="bg-background border border-input rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="all">All</option>
                <option value="high">High Score</option>
                <option value="shortlisted">Shortlisted</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {topCandidates.slice(0, 5).map((candidate, index) => (
              <CandidateCard key={candidate._id} candidate={candidate} rank={index + 1} />
            ))}
          </div>

          <Link
            to="/recruiter/jobs"
            className="mt-4 flex items-center justify-center gap-2 text-sm text-foreground hover:text-foreground/80 transition-colors"
          >
            View all candidates
            <ChevronRight className="w-4 h-4" />
          </Link>
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

      <motion.div
        className="card p-6 relative"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="text-lg font-bold text-foreground">Attention Required</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-muted border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-warning" />
              <span className="font-medium text-warning">3 Pending Reviews</span>
            </div>
            <p className="text-sm text-muted-foreground">Candidates waiting for your review since last week</p>
          </div>

          <div className="p-4 rounded-xl bg-destructive/5 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="font-medium text-destructive">2 Flagged Applications</span>
            </div>
            <p className="text-sm text-muted-foreground">Potential inconsistencies detected in skill claims</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default RecruiterDashboard;
