import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload as UploadIcon, FileText, X, Zap, ChevronDown, Loader, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

// GitHub Icon SVG Component
const GithubIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

// Glow Orb Component
const GlowOrb = ({ className }) => (
  <div className={`absolute rounded-full filter blur-3xl opacity-30 ${className}`}>
    <div className="w-full h-full rounded-full animate-glow-pulse" />
  </div>
);

// Animated Background Grid
const BackgroundGrid = () => (
  <div className="absolute inset-0">
    <div className="absolute inset-0 bg-grid-pattern opacity-50" />
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
  </div>
);

// Floating Particles
const FloatingParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(15)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 bg-accent-purple rounded-full opacity-40"
        style={{
          left: `${10 + Math.random() * 80}%`,
          top: `${10 + Math.random() * 80}%`,
          boxShadow: '0 0 10px rgba(139, 92, 246, 0.6)',
        }}
        animate={{
          y: [0, -80, 0],
          opacity: [0.2, 0.6, 0.2],
          scale: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 6 + Math.random() * 4,
          delay: i * 0.3,
          repeat: Infinity,
        }}
      />
    ))}
  </div>
);

// Document Preview Component
const DocumentPreview = ({ file, onRemove }) => {
  const fileSize = (file.size / 1024).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-accent-emerald/30 backdrop-blur-xl"
    >
      <div className="flex items-center gap-4">
        {/* File Icon with Glow */}
        <motion.div
          className="relative"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-purple/30 to-accent-cyan/20 flex items-center justify-center">
            <FileText className="w-7 h-7 text-accent-emerald" />
          </div>
          <div className="absolute inset-0 rounded-xl bg-accent-emerald/20 filter blur-xl" />
        </motion.div>

        <div>
          <p className="font-semibold text-white mb-1">{file.name}</p>
          <p className="text-sm text-white/40">{fileSize} KB • PDF Document</p>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <motion.span
          className="px-3 py-1 rounded-full bg-accent-emerald/20 border border-accent-emerald/30 text-accent-emerald text-sm font-medium"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          Ready
        </motion.span>

        <motion.button
          onClick={onRemove}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 flex items-center justify-center transition-all group"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-5 h-5 text-white/60 group-hover:text-red-400 transition-colors" />
        </motion.button>
      </div>
    </motion.div>
  );
};

// Drop Zone Component
const DropZone = ({ onDrop, onDragOver, onDragLeave, isDragging, children }) => (
  <motion.div
    className={`relative p-12 rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer ${
      isDragging
        ? 'border-accent-purple bg-accent-purple/10 scale-[1.02]'
        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
    }`}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
    whileHover={{ scale: isDragging ? 1.02 : 1.01 }}
    animate={{
      boxShadow: isDragging
        ? '0 0 40px rgba(139, 92, 246, 0.3), inset 0 0 40px rgba(139, 92, 246, 0.1)'
        : '0 0 0px transparent',
    }}
  >
    {/* Corner Decorations */}
    <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-accent-purple/30 rounded-tl-xl" />
    <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-accent-purple/30 rounded-tr-xl" />
    <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-accent-purple/30 rounded-bl-xl" />
    <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-accent-purple/30 rounded-br-xl" />

    {/* Scanning Line Effect */}
    {isDragging && (
      <motion.div
        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent-purple to-transparent"
        animate={{ y: [-100, 400] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    )}

    {children}
  </motion.div>
);

// Skills Input with Animated Pills
const SkillsSelector = ({ selectedSkills, onToggle }) => {
  const suggestedSkills = ['Python', 'React', 'Node.js', 'AWS', 'TypeScript', 'Django', 'Machine Learning', 'Docker', 'MongoDB', 'SQL'];

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-white/80">Suggested Skills</label>
      <div className="flex flex-wrap gap-2">
        {suggestedSkills.map((skill, i) => {
          const isSelected = selectedSkills.includes(skill);
          return (
            <motion.button
              key={skill}
              type="button"
              onClick={() => onToggle(skill)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-accent-purple/30 border border-accent-purple/50 text-white'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/20'
              }`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isSelected && <CheckCircle className="w-3 h-3 inline mr-1 text-accent-purple" />}
              {skill}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// Main Upload Component
function Upload() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const dropZoneRef = useRef(null);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const res = await fetch('http://localhost:5001/api/jobs');
        if (!res.ok) throw new Error('Failed to fetch jobs');
        const data = await res.json();
        setJobs(data || []);
        setJobId(
          data && data[0] && String(data[0].id || data[0]._id)
            ? String(data[0].id || data[0]._id)
            : ''
        );
      } catch (e) {
        setJobsError(e.message || 'Failed to load jobs');
      } finally {
        setLoadingJobs(false);
      }
    };
    loadJobs();
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!dropZoneRef.current?.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (
      droppedFile &&
      (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.docx'))
    ) {
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleAnalyze = async () => {
    try {
      if (!jobId) {
        setError('Select a job position first.');
        return;
      }
      if (!file) {
        setError('Upload a PDF resume first.');
        return;
      }
      if (!jd.trim()) {
        setError('Please add a job description to continue');
        return;
      }

      setIsLoading(true);
      setError('');

      navigate('/candidate/processing', { state: { file, jobId, jd } });
    } finally {
      setIsLoading(false);
    }
  };

  const isReady = file && jd.trim();

  return (
    <div className="min-h-screen bg-background text-white relative overflow-hidden">
      {/* Noise Overlay */}
      <div className="noise-overlay" />

      {/* Background Effects */}
      <BackgroundGrid />
      <FloatingParticles />

      {/* Glow Orbs */}
      <GlowOrb className="w-96 h-96 bg-accent-purple top-[-20%] left-[-10%]" />
      <GlowOrb className="w-64 h-64 bg-accent-cyan bottom-[20%] right-[-5%]" />

      {/* Header */}
      <motion.header
        className="relative z-10 flex justify-between items-center py-6 px-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Link
          to="/"
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors no-underline group"
        >
          <motion.span
            animate={{ x: [0, -5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ←
          </motion.span>
          <span className="font-medium">Back</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-accent-purple to-accent-cyan rounded-xl">
            <Zap className="w-5 h-5 text-white" />
          </span>
          <span className="font-extrabold tracking-tight text-2xl">PATINA</span>
        </div>

        <div className="w-[60px]" />
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            <span className="text-white">Upload Your </span>
            <span className="gradient-text">Resume</span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Upload your resume and paste a job description to start the AI-powered skill verification process
          </p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          className="glass-card p-8 md:p-10 relative"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {/* Corner Decorations */}
          <div className="corner-decoration top-left" />
          <div className="corner-decoration bottom-right" />

          {/* Job Selection */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-purple" />
              Select Position
            </label>

            {loadingJobs ? (
              <div className="flex items-center gap-3 text-white/40">
                <Loader className="w-5 h-5 animate-spin" />
                <span>Loading positions...</span>
              </div>
            ) : jobsError ? (
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>{jobsError}</span>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white appearance-none cursor-pointer focus:outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20 transition-all"
                >
                  {jobs.map((j) => (
                    <option key={j.id || j._id} value={String(j.id || j._id)} className="bg-background">
                      {j.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
              </div>
            )}
            <p className="text-xs text-white/30 mt-3">Choose the role you're applying for. We'll match your resume to this job.</p>
          </div>

          {/* Drop Zone */}
          <div className="mb-8" ref={dropZoneRef}>
            <label className="block text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent-cyan" />
              Resume File
            </label>

            <DropZone
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              isDragging={isDragging}
            >
              <AnimatePresence mode="wait">
                {file ? (
                  <DocumentPreview
                    key="document"
                    file={file}
                    onRemove={() => setFile(null)}
                  />
                ) : (
                  <motion.div
                    key="upload"
                    className="flex flex-col items-center justify-center text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Upload Icon with Animation */}
                    <motion.div
                      className="relative mb-6"
                      animate={isDragging ? { scale: 1.2, rotate: 5 } : { scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 flex items-center justify-center">
                        <UploadIcon className="w-10 h-10 text-accent-purple" />
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-accent-purple/20 filter blur-xl" />
                    </motion.div>

                    <p className="text-lg text-white/70 mb-2">
                      <span className="text-accent-purple font-semibold">Browse</span> your files or drag and drop
                    </p>
                    <p className="text-sm text-white/40">Supports PDF and DOCX files</p>

                    {/* Hidden File Input */}
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="mt-4 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 cursor-pointer transition-all inline-block">
                      Choose File
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>
            </DropZone>
          </div>

          {/* Job Description */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-pink" />
              Job Description <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <textarea
                className="w-full h-44 p-5 bg-white/5 border border-white/10 rounded-xl text-white text-sm resize-none focus:outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20 transition-all placeholder:text-white/20"
                placeholder="Paste the job description here... e.g. We are looking for a Python developer with experience in React, MongoDB and REST APIs..."
                value={jd}
                onChange={(e) => setJd(e.target.value)}
              />
              {/* Character Count */}
              <div className="absolute bottom-3 right-3 text-xs text-white/30">
                {jd.length} characters
              </div>
            </div>
          </div>

          {/* GitHub Connect */}
          <motion.div
            className="mb-8 p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <GithubIcon className="w-8 h-8 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Connect GitHub (Optional)</h3>
            <p className="text-sm text-white/40 mb-4">
              Connect your GitHub profile to verify your coding activity and contributions
            </p>
            <motion.button
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#24292e]/80 hover:bg-[#24292e] text-white rounded-xl text-sm font-semibold transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <GithubIcon className="w-5 h-5" />
              Login with GitHub
            </motion.button>
          </motion.div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <motion.button
            onClick={handleAnalyze}
            disabled={!isReady || isLoading}
            className={`w-full py-5 rounded-xl font-semibold text-lg relative overflow-hidden transition-all ${
              isReady
                ? 'bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-purple bg-[length:200%_100%] hover:shadow-glow-purple cursor-pointer'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
            whileHover={isReady ? { scale: 1.02 } : {}}
            whileTap={isReady ? { scale: 0.98 } : {}}
            animate={isReady ? { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] } : {}}
            transition={isReady ? { duration: 3, repeat: Infinity } : {}}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Analyze Resume
                </>
              )}
            </span>
          </motion.button>

          {!jd.trim() && file && (
            <motion.p
              className="text-sm text-accent-amber mt-3 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Please add a job description to continue
            </motion.p>
          )}
        </motion.div>

        {/* Bottom Tips */}
        <motion.div
          className="mt-8 flex items-center justify-center gap-2 text-sm text-white/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <CheckCircle className="w-4 h-4 text-accent-emerald" />
          <span>Your data is encrypted and processed securely</span>
        </motion.div>
      </main>
    </div>
  );
}

export default Upload;