import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload as UploadIcon, FileText, X, Sparkles, CheckCircle, AlertCircle, Zap, ChevronDown } from 'lucide-react';

const DocumentPreview = ({ file, onRemove }) => {
  const fileSize = (file.size / 1024).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center justify-between p-6 rounded-xl bg-muted border border-border"
    >
      <div className="flex items-center gap-4">
        <motion.div
          className="relative"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
            <FileText className="w-7 h-7 text-foreground" />
          </div>
        </motion.div>

        <div>
          <p className="font-semibold text-foreground mb-1">{file.name}</p>
          <p className="text-sm text-muted-foreground">{fileSize} KB • PDF Document</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <motion.span
          className="px-3 py-1 rounded-full bg-success/10 border border-border text-success text-sm font-medium"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          Ready
        </motion.span>

        <motion.button
          onClick={onRemove}
          className="w-10 h-10 rounded-full bg-muted border border-border hover:bg-destructive/10 hover:border-destructive/30 flex items-center justify-center transition-all"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </motion.button>
      </div>
    </motion.div>
  );
};

const DropZone = ({ onDrop, onDragOver, onDragLeave, isDragging, children }) => (
  <motion.div
    className={`relative p-12 rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer ${
      isDragging
        ? 'border-foreground bg-muted'
        : 'border-border bg-background hover:border-foreground/30'
    }`}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
    whileHover={{ scale: isDragging ? 1.02 : 1.01 }}
  >
    {children}
  </motion.div>
);

const SkillsSelector = ({ selectedSkills, onToggle }) => {
  const suggestedSkills = ['Python', 'React', 'Node.js', 'AWS', 'TypeScript', 'Django', 'Machine Learning', 'Docker', 'MongoDB', 'SQL'];

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-foreground">Suggested Skills</label>
      <div className="flex flex-wrap gap-2">
        {suggestedSkills.map((skill, i) => {
          const isSelected = selectedSkills.includes(skill);
          return (
            <motion.button
              key={skill}
              type="button"
              onClick={() => onToggle(skill)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-foreground text-primary-foreground'
                  : 'bg-muted border border-border text-foreground hover:bg-muted/80'
              }`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isSelected && <CheckCircle className="w-3 h-3 inline mr-1" />}
              {skill}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

function Upload() {
  const [file, setFile] = useState(null);
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
        const res = await fetch('http://localhost:5000/api/jobs');
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
        setError('Upload a PDF or DOCX resume first.');
        return;
      }

      setIsLoading(true);
      setError('');

      navigate('/candidate/processing', { state: { file, jobId } });
    } finally {
      setIsLoading(false);
    }
  };

  const isReady = Boolean(file && jobId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <motion.header
        className="flex justify-between items-center py-4 px-6 border-b border-border"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link
          to="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors no-underline"
        >
          <motion.span
            animate={{ x: [0, -5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ←
          </motion.span>
          <span className="font-medium">Back</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center bg-primary rounded-md">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">PATINA</span>
        </div>

        <div className="w-[60px]" />
      </motion.header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Upload Your <span className="text-foreground">Resume</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Select the role you're applying for and upload your resume to start the AI-powered skill verification process
          </p>
        </motion.div>

        <motion.div
          className="card p-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="mb-8">
            <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Select Job
            </label>

            {loadingJobs ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <motion.div
                  className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <span>Loading positions...</span>
              </div>
            ) : jobsError ? (
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="w-5 h-5" />
                <span>{jobsError}</span>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-body-sm text-foreground appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {jobs.map((j) => (
                    <option key={j.id || j._id} value={String(j.id || j._id)}>
                      {j.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">Choose the role you're applying for. We'll match your resume to this job.</p>
          </div>

          <div className="mb-8" ref={dropZoneRef}>
            <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
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
                    <motion.div
                      className="relative mb-6"
                      animate={isDragging ? { scale: 1.2, rotate: 5 } : { scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center">
                        <UploadIcon className="w-10 h-10 text-foreground" />
                      </div>
                    </motion.div>

                    <p className="text-lg text-foreground mb-2">
                      <span className="font-semibold">Browse</span> your files or drag and drop
                    </p>
                    <p className="text-sm text-muted-foreground">Supports PDF and DOCX files</p>

                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="mt-4 px-6 py-2.5 rounded-md bg-muted border border-border text-sm text-foreground hover:bg-muted/80 cursor-pointer transition-all inline-block">
                      Choose File
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>
            </DropZone>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 rounded-md bg-destructive/10 border border-border text-destructive text-sm flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={handleAnalyze}
            disabled={!isReady || isLoading}
            className={`w-full h-10 rounded-md font-medium text-body-sm transition-all ${
              isReady
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
            whileHover={isReady ? { scale: 1.01 } : {}}
            whileTap={isReady ? { scale: 0.99 } : {}}
          >
            <span className="flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <motion.div
                    className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  Preparing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze Resume
                </>
              )}
            </span>
          </motion.button>

          {!jobId && !loadingJobs && !jobsError && (
            <motion.p
              className="text-sm text-warning mt-3 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Select a job position to continue
            </motion.p>
          )}
        </motion.div>

        <motion.div
          className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <CheckCircle className="w-4 h-4 text-success" />
          <span>Your data is encrypted and processed securely</span>
        </motion.div>
      </main>
    </div>
  );
}

export default Upload;
