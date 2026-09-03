import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload as UploadIcon,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const isResumeFile = (file) => {
  const name = (file.name || '').toLowerCase();
  return (
    file.type === 'application/pdf' ||
    name.endsWith('.pdf') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  );
};

const DocumentPreview = ({ file, onRemove }) => {
  const fileSize = (file.size / 1024).toFixed(1);
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center justify-between p-6 rounded-xl bg-muted border border-border"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <FileText className="w-6 h-6 text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground mb-1 truncate">{file.name}</p>
          <p className="text-sm text-muted-foreground">
            {fileSize} KB • {isPdf ? 'PDF' : 'DOCX'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="w-10 h-10 rounded-full bg-muted border border-border hover:bg-destructive/10 hover:border-destructive/30 flex items-center justify-center transition-all flex-shrink-0"
      >
        <X className="w-5 h-5 text-muted-foreground" />
      </button>
    </motion.div>
  );
};

const DropZone = ({ onDrop, onDragOver, onDragLeave, isDragging, children }) => (
  <motion.div
    className={`relative p-10 rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer ${
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

function Upload() {
  const { authFetch } = useAuth();

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [hasResume, setHasResume] = useState(false);
  const [currentFileName, setCurrentFileName] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);
  // While true the dropzone is revealed so the candidate can pick a new file.
  // Only reachable from the "Update" button once a resume already exists.
  const [isUpdating, setIsUpdating] = useState(false);

  const dropZoneRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/resume/status`);
        const data = await res.json();
        if (!cancelled) {
          setHasResume(Boolean(data.hasResume));
          setCurrentFileName(data.fileName || '');
        }
      } catch {
        // Network issue - still allow the candidate to try uploading.
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    };
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);
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
    if (droppedFile) setFile(droppedFile);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file || uploading) return;

    if (!isResumeFile(file)) {
      setError('Please upload a PDF or DOCX resume.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess(false);

    const form = new FormData();
    form.append('resume', file);

    try {
      const res = await authFetch(`${API_BASE_URL}/api/resume/upload`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed. Please try again.');
      setHasResume(true);
      setCurrentFileName(file.name);
      setSuccess(true);
      setFile(null);
      setIsUpdating(false);
    } catch (uploadError) {
      setError(uploadError.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <motion.header
        className="flex justify-between items-center py-4 px-6 border-b border-border"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link
          to="/candidate/dashboard"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors no-underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-sm font-medium">Back to dashboard</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center bg-primary rounded-md">
            <UploadIcon className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">PATINA</span>
        </div>

        <div className="w-[60px]" />
      </motion.header>
<main className="max-w-2xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Upload <span className="text-foreground">Resume</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Keep one latest resume on your profile. It is used for every job you apply to.
          </p>
        </motion.div>

        <motion.div
          className="card p-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {/* Current resume on file */}
          {statusLoading ? (
            <p className="text-sm text-muted-foreground mb-6">Checking your resume...</p>
          ) : hasResume ? (
            <div className="mb-6 p-4 rounded-xl bg-muted border border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {currentFileName || 'Resume on file'}
                  </p>
                  <p className="text-xs text-muted-foreground">Current resume — applies to all jobs</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                  Uploaded
                </span>
                {!isUpdating && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUpdating(true);
                      setSuccess(false);
                      setError('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Update
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 rounded-xl bg-muted border border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No resume uploaded yet</p>
                <p className="text-xs text-muted-foreground">
                  You need a resume before you can apply to jobs.
                </p>
              </div>
            </div>
          )}

          {/* DropZone / Browse — hidden once a resume exists unless updating */}
          {!statusLoading && (!hasResume || isUpdating) && (
          <div ref={dropZoneRef}>
            <DropZone
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              isDragging={isDragging}
            >
              <AnimatePresence mode="wait">
                {file ? (
                  <DocumentPreview key="file" file={file} onRemove={() => setFile(null)} />
                ) : (
                  <motion.div
                    key="empty"
                    className="text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                      <FileText className="w-8 h-8 text-foreground" />
                    </div>
                    <p className="text-foreground font-medium">Drag & drop your resume here</p>
                    <p className="text-sm text-muted-foreground mt-1">or</p>
                    <label className="mt-3 inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                      <UploadIcon className="w-4 h-4" />
                      Browse Files
                      <input
                        type="file"
                        accept=".pdf,.docx"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground mt-3">PDF or DOCX</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </DropZone>
          </div>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 p-4 rounded-md bg-destructive/10 border border-border text-destructive text-sm flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 p-4 rounded-md bg-success/10 border border-success/30 text-success text-sm flex items-center gap-3"
              >
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                Resume uploaded successfully! It will be used for all your job applications.
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload button — only when no resume yet or while updating */}
          {!statusLoading && (!hasResume || isUpdating) && (
            <>
              <motion.button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`mt-6 w-full h-12 rounded-md font-medium text-body-sm flex items-center justify-center gap-2 transition-all ${
                  file && !uploading
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
                whileHover={file && !uploading ? { scale: 1.01 } : {}}
                whileTap={file && !uploading ? { scale: 0.99 } : {}}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-4 h-4" />
                    {hasResume ? 'Save New Resume' : 'Upload Resume'}
                  </>
                )}
              </motion.button>

              {isUpdating && !uploading && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUpdating(false);
                    setFile(null);
                    setError('');
                  }}
                  className="mt-3 w-full h-10 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </motion.div>

        {/* Footer note */}
        <motion.div
          className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <CheckCircle className="w-4 h-4 text-success" />
          <span>Your resume is stored securely and associated with your profile.</span>
        </motion.div>
      </main>
    </div>
  );
}

export default Upload;