import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Briefcase, CheckCircle, Clock, AlertTriangle, ChevronRight, Star, Filter, Download, Plus, Zap, Eye, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Glow Orb Component
const GlowOrb = ({ className }) => (
  <div className={`absolute w-96 h-96 rounded-full filter blur-3xl opacity-20 ${className}`}>
    <div className={`w-full h-full rounded-full bg-gradient-to-br from-accent-purple/40 to-accent-cyan/30 animate-glow-pulse`} />
  </div>
);

// Animated Counter
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

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, trend, color, delay }) => (
  <motion.div
    className="glass-card p-6 relative overflow-hidden group"
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ y: -4 }}
  >
    <div className="corner-decoration top-left" />
    <div className="corner-decoration bottom-right" />

    {/* Background Glow */}
    <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-${color}/10 filter blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-${color}/20 flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${color}`} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trend > 0 ? 'bg-accent-emerald/20 text-accent-emerald' : 'bg-accent-rose/20 text-accent-rose'
          }`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>

      <div className="text-3xl font-extrabold text-white mb-1">
        <AnimatedCounter end={value} />
      </div>
      <div className="text-sm text-white/40">{label}</div>
    </div>
  </motion.div>
);

// Candidate Card Component
const CandidateCard = ({ candidate, rank }) => {
  const scoreColor = candidate.credibilityScore >= 80 ? 'accent-emerald' :
                     candidate.credibilityScore >= 60 ? 'accent-amber' : 'accent-rose';

  return (
    <motion.div
      className="glass-card p-5 relative group cursor-pointer"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.02, x: 4 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <div className="corner-decoration top-left" />
      <div className="corner-decoration bottom-right" />

      <div className="flex items-center gap-4">
        {/* Rank */}
        <div className={`w-10 h-10 rounded-xl ${
          rank === 1 ? 'bg-accent-amber/20' : rank === 2 ? 'bg-white/10' : rank === 3 ? 'bg-accent-amber/10' : 'bg-white/5'
        } flex items-center justify-center font-bold text-white/70`}>
          #{rank}
        </div>

        {/* Avatar */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-purple/30 to-accent-cyan/30 flex items-center justify-center">
          <span className="font-bold text-white">
            {candidate.candidateInfo?.name?.split(' ').map(n => n[0]).join('') || 'UN'}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate">
            {candidate.candidateInfo?.name || 'Unknown'}
          </div>
          <div className="text-sm text-white/40 truncate">
            {candidate.candidateInfo?.location || 'Location unknown'}
          </div>
        </div>

        {/* Score */}
        <div className="text-right">
          <div className={`text-2xl font-extrabold text-${scoreColor}`}>
            {candidate.credibilityScore}
          </div>
          <div className="text-xs text-white/30">Score</div>
        </div>

        {/* View Button */}
        <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/70 transition-colors" />
      </div>

      {/* Skills Tags */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {candidate.skills?.slice(0, 3).map((skill, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 rounded-full text-xs ${
              skill.verified
                ? 'bg-accent-emerald/20 text-accent-emerald'
                : 'bg-accent-amber/20 text-accent-amber'
            }`}
          >
            {skill.name}
          </span>
        ))}
        {candidate.skills?.length > 3 && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40">
            +{candidate.skills.length - 3}
          </span>
        )}
      </div>
    </motion.div>
  );
};

// Job Card Component
const JobCard = ({ job, index }) => (
  <motion.div
    className="glass-card p-5 relative group cursor-pointer"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    whileHover={{ scale: 1.02 }}
  >
    <div className="corner-decoration top-left" />
    <div className="corner-decoration bottom-right" />

    <div className="flex items-center justify-between mb-3">
      <h3 className="font-bold text-white">{job.title}</h3>
      <Link
        to={`/recruiter/jobs/${job._id}`}
        className="px-3 py-1.5 rounded-lg bg-accent-purple/20 border border-accent-purple/30 text-accent-purple text-xs font-medium hover:bg-accent-purple/30 transition-all"
      >
        View →
      </Link>
    </div>

    <p className="text-sm text-white/40 line-clamp-1 mb-3">{job.description}</p>

    <div className="flex items-center gap-2 flex-wrap">
      {job.requiredSkills?.map((skill, i) => (
        <span key={i} className="px-2 py-0.5 rounded-full bg-white/5 text-white/60 text-xs">
          {skill}
        </span>
      ))}
    </div>

    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-xs text-white/30">
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

// Chart Data
const skillsDistribution = [
  { name: 'React', value: 35, color: '#8b5cf6' },
  { name: 'Node.js', value: 25, color: '#06b6d4' },
  { name: 'Python', value: 20, color: '#10b981' },
  { name: 'Other', value: 20, color: '#ec4899' },
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

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#ec4899'];

// Main Dashboard Component
function RecruiterDashboard() {
  // Mock data from mockData
  const jobs = [
    { _id: 'job1', title: 'Frontend Developer', description: 'Work on React-based UI', requiredSkills: ['React', 'JavaScript', 'CSS'], experienceLevel: '0-2 years' },
    { _id: 'job2', title: 'Backend Developer', description: 'Node.js + API development', requiredSkills: ['Node.js', 'Express', 'MongoDB'], experienceLevel: '2-4 years' },
    { _id: 'job3', title: 'Full Stack Developer', description: 'React + Node full stack role', requiredSkills: ['React', 'Node.js'], experienceLevel: '1-3 years' },
    { _id: 'job4', title: 'Machine Learning Engineer', description: 'ML models + data pipelines', requiredSkills: ['Python', 'Machine Learning'], experienceLevel: '2-5 years' },
    { _id: 'job5', title: 'DevOps Engineer', description: 'CI/CD and cloud infra', requiredSkills: ['Docker', 'AWS', 'Kubernetes'], experienceLevel: '3-6 years' },
  ];

  const applications = [
    { _id: 'app1', candidateInfo: { name: 'Rohit Sharma', location: 'Mumbai' }, credibilityScore: 82, skills: [{ name: 'React', verified: true }, { name: 'Node.js', verified: true }], status: 'applied' },
    { _id: 'app2', candidateInfo: { name: 'Priya Patel', location: 'Ahmedabad' }, credibilityScore: 91, skills: [{ name: 'React', verified: true }, { name: 'CSS', verified: true }], status: 'shortlisted' },
    { _id: 'app3', candidateInfo: { name: 'Arjun Mehta', location: 'Delhi' }, credibilityScore: 65, skills: [{ name: 'Node.js', verified: false }], status: 'rejected' },
    { _id: 'app4', candidateInfo: { name: 'Sneha Iyer', location: 'Bangalore' }, credibilityScore: 88, skills: [{ name: 'Full Stack', verified: true }], status: 'shortlisted' },
    { _id: 'app5', candidateInfo: { name: 'Karan Singh', location: 'Pune' }, credibilityScore: 72, skills: [{ name: 'Python', verified: true }], status: 'applied' },
  ];

  const topCandidates = [...applications].sort((a, b) => b.credibilityScore - a.credibilityScore);
  const shortlistedCount = applications.filter(a => a.status === 'shortlisted').length;
  const pendingCount = applications.filter(a => a.status === 'applied').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2">
            Recruiter Dashboard
          </h1>
          <p className="text-white/50">
            Welcome back, <span className="text-accent-purple">Amit</span>. Here's your hiring overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium flex items-center gap-2 hover:bg-white/10 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download className="w-4 h-4" />
            Export Report
          </motion.button>

          <Link
            to="/recruiter/create-job"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white text-sm font-medium flex items-center gap-2 hover:shadow-glow-purple transition-all no-underline"
          >
            <Plus className="w-4 h-4" />
            Create New Job
          </Link>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Briefcase} label="Active Jobs" value={jobs.length} color="accent-purple" delay={0.1} />
        <StatCard icon={Users} label="Total Candidates" value={applications.length} trend={12} color="accent-cyan" delay={0.2} />
        <StatCard icon={CheckCircle} label="Shortlisted" value={shortlistedCount} color="accent-emerald" delay={0.3} />
        <StatCard icon={Clock} label="Pending Review" value={pendingCount} color="accent-amber" delay={0.4} />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Weekly Applications Chart */}
        <motion.div
          className="glass-card p-6 lg:col-span-2 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="corner-decoration top-left" />
          <div className="corner-decoration bottom-right" />

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent-purple" />
              Weekly Applications
            </h3>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-accent-purple/20 text-accent-purple text-xs font-medium">Week</button>
              <button className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-medium hover:bg-white/10">Month</button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyApplications}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10,10,15,0.9)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(20px)',
                }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="applications" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Skills Distribution */}
        <motion.div
          className="glass-card p-6 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="corner-decoration top-left" />
          <div className="corner-decoration bottom-right" />

          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Star className="w-5 h-5 text-accent-amber" />
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
                    backgroundColor: 'rgba(10,10,15,0.9)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {skillsDistribution.map((skill, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: skill.color }} />
                  <span className="text-xs text-white/60">{skill.name}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Candidates */}
        <motion.div
          className="glass-card p-6 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="corner-decoration top-left" />
          <div className="corner-decoration bottom-right" />

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-accent-cyan" />
              Top Candidates
            </h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-white/40" />
              <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:border-accent-purple/50">
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
            className="mt-4 flex items-center justify-center gap-2 text-sm text-accent-purple hover:text-accent-cyan transition-colors"
          >
            View all candidates
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Recent Jobs */}
        <motion.div
          className="glass-card p-6 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="corner-decoration top-left" />
          <div className="corner-decoration bottom-right" />

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-accent-purple" />
              Recent Jobs
            </h3>
            <Link
              to="/recruiter/create-job"
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs font-medium hover:bg-white/10 transition-all no-underline"
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
            className="mt-4 flex items-center justify-center gap-2 text-sm text-accent-purple hover:text-accent-cyan transition-colors"
          >
            View all jobs
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>

      {/* Alerts Section */}
      <motion.div
        className="glass-card p-6 relative"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <div className="corner-decoration top-left" />
        <div className="corner-decoration bottom-right" />

        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-accent-amber" />
          <h3 className="text-lg font-bold text-white">Attention Required</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-accent-amber/5 border border-accent-amber/20">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-accent-amber" />
              <span className="font-medium text-accent-amber">3 Pending Reviews</span>
            </div>
            <p className="text-sm text-white/50">Candidates waiting for your review since last week</p>
          </div>

          <div className="p-4 rounded-xl bg-accent-rose/5 border border-accent-rose/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-accent-rose" />
              <span className="font-medium text-accent-rose">2 Flagged Applications</span>
            </div>
            <p className="text-sm text-white/50">Potential inconsistencies detected in skill claims</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default RecruiterDashboard;