import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload as UploadIcon,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  FileWarning,
  Clock,
} from 'lucide-react';
import Badge from '../../components/Badge';
import PatinaMark from '../../components/PatinaMark';
import { api } from '../../lib/api';
import { EDUCATION_EMPTY_ENTRY, educationLine } from '../../lib/education';

// R-16 (D§4.1, F20, F21): upload parses the file and the page shows what was read.
// POST /api/resume/upload (backend/Controllers/analysis.controller.js uploadResume):
//   201 { message, fileName, size, parsed: { skills, experience, education, links, contact, ... } }
//   422 unreadable_document { reason, message, stored: false }   nothing was kept
//   503 parser_unavailable  { message, fileKept: true }          saved, not read yet
//   any other failure: the server's own message, shown as an error
// A failed parse is never shown as a success.

const isResumeFile = (file) => {
  const name = (file.name || '').toLowerCase();
  return (
    file.type === 'application/pdf' ||
    name.endsWith('.pdf') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  );
};

// The stored object is always `resume.<ext>` and the original file name is not kept,
// so a later visit names the format only, never the storage name as if it were the file's.
const storedResumeLabel = (storageName) => {
  const ext = String(storageName || '').split('.').pop().toLowerCase();
  return ext === 'pdf' || ext === 'docx' ? `Resume on file (${ext.toUpperCase()})` : 'Resume on file';
};

// The server's unreadable message opens with the same words as the notice's heading
// (backend/Services/resumePipeline.js); the heading says it once, the rest follows.
const unreadableDetail = (message) => {
  const rest = String(message || '').replace(/^We can't read this file[:.]?\s*/i, '').trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : '';
};

const uploadDate = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : '';
};

const DocumentPreview =({ file, onRemove }) => {
  const fileSize = (file.size / 1024).toFixed(1);
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  return (
    <div
      className="flex items-center justify-between p-6 rounded-xl bg-muted border border-border"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center flex-shrink-0">
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
        aria-label="Remove selected file"
        className="w-10 h-10 rounded-full bg-background border border-border hover:bg-destructive/10 hover:border-destructive/30 flex items-center justify-center transition-all flex-shrink-0"
      >
        <X className="w-5 h-5 text-muted-foreground" />
      </button>
    </div>
  );
};

/** One block of what the parser read, or an honest "nothing found". */
function ParsedSection({ title, count, empty, children, testId }) {
  return (
    <div data-testid={testId}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} <span className="font-normal normal-case">({count})</span>
      </p>
      {count > 0 ? children : <p className="text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}

export function ParsedSummary({ fileName, parsed }) {
  const skills = Array.isArray(parsed?.skills) ? parsed.skills : [];
  const experience = Array.isArray(parsed?.experience) ? parsed.experience : [];
  const education = Array.isArray(parsed?.education) ? parsed.education : [];
  const links = Array.isArray(parsed?.links) ? parsed.links.filter((l) => typeof l === 'string' && l.trim()) : [];
  const contact = parsed?.contact || {};
  const contactLines = [
    ['Name', contact.candidate_name],
    ['Email', contact.email],
    ['Phone', contact.phone],
    // R-38: the profile links the parser returned (also listed under Links), as text.
    ['LinkedIn', contact.linkedin],
    ['GitHub', contact.github],
  ].filter(([, v]) => typeof v === 'string' && v.trim());

  return (
    <div
      className="mt-5 rounded-xl border border-success/30 bg-success/5 p-5 space-y-5"
      data-testid="resume-parsed"
    >
      <div className="flex items-start gap-3">
        <CheckCircle className="w-5 h-5 flex-shrink-0 text-success mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {fileName ? `${fileName} was saved and read.` : 'Your resume was saved and read.'}
          </p>
          <p className="text-sm text-muted-foreground">
            This is what the parser found. It is used for every job you apply to.
            {parsed?.parserVersion ? ` Parser version ${parsed.parserVersion}.` : ''}
          </p>
        </div>
      </div>

      <ParsedSection title="Skills" count={skills.length} empty="No skills were found in the text." testId="parsed-skills">
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <Badge key={skill} variant="outline">{skill}</Badge>
          ))}
        </div>
      </ParsedSection>

      <ParsedSection title="Experience" count={experience.length} empty="No experience entries were found." testId="parsed-experience">
        <ul className="space-y-2">
          {experience.map((item, i) => {
            const heading = [item?.title, item?.organisation].filter(Boolean).join(' · ');
            return (
              <li key={i} className="text-sm text-foreground">
                {heading || <span className="text-muted-foreground">Entry without a title</span>}
                {item?.dates && <span className="ml-2 text-xs text-muted-foreground">{item.dates}</span>}
              </li>
            );
          })}
        </ul>
      </ParsedSection>

      <ParsedSection title="Education" count={education.length} empty="No education entries were found." testId="parsed-education">
        <ul className="list-disc space-y-1 pl-5">
          {education.map((entry, i) => {
            const line = educationLine(entry);
            return (
              <li key={i} className="text-sm text-foreground">
                {line || <span className="text-muted-foreground">{EDUCATION_EMPTY_ENTRY}</span>}
              </li>
            );
          })}
        </ul>
      </ParsedSection>

      {/* Every web link the parser found (GitHub, LinkedIn, portfolio, others), as text. */}
      <ParsedSection title="Links" count={links.length} empty="No web links were found." testId="parsed-links">
        <ul className="space-y-1">
          {links.map((link, i) => (
            <li key={`${i}-${link}`} className="text-sm text-foreground break-all">{link}</li>
          ))}
        </ul>
      </ParsedSection>

      {contactLines.length > 0 && (
        <div data-testid="parsed-contact">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {contactLines.map(([label, value]) => (
              <React.Fragment key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-foreground break-all">{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function Upload() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  // The outcome of the last upload:
  //   { kind: 'parsed', fileName, parsed } | { kind: 'unreadable', message }
  //   | { kind: 'kept', message } | { kind: 'error', message, requestId }
  const [outcome, setOutcome] = useState(null);

  const [hasResume, setHasResume] = useState(false);
  // The chosen file's name right after an upload; on a later visit a neutral label.
  const [currentFileName, setCurrentFileName] = useState('');
  const [currentUploadedAt, setCurrentUploadedAt] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  // While true the dropzone is revealed so the candidate can pick a new file.
  const [isUpdating, setIsUpdating] = useState(false);

  const dropZoneRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      try {
        const data = await api.get('/api/resume/status');
        if (!cancelled) {
          setHasResume(Boolean(data?.hasResume));
          setCurrentFileName(storedResumeLabel(data?.fileName));
          setCurrentUploadedAt(uploadDate(data?.updatedAt));
        }
      } catch (err) {
        // Not "no resume": we do not know. Upload stays possible.
        if (!cancelled) setStatusError(err.message || 'Could not check your resume.');
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    };
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickFile = (picked) => {
    if (!picked) return;
    setFile(picked);
    setOutcome(null);
    setIsUpdating(true);
  };

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
    pickFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e) => {
    pickFile(e.target.files[0]);
    // Allow choosing the same file again after a failed attempt.
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!file || uploading) return;

    if (!isResumeFile(file)) {
      setOutcome({ kind: 'error', message: 'Please choose a PDF or DOCX resume.' });
      return;
    }

    setUploading(true);
    setOutcome(null);

    const form = new FormData();
    form.append('resume', file);

    try {
      const data = await api.post('/api/resume/upload', form);
      setHasResume(true);
      setCurrentFileName(file.name);
      setCurrentUploadedAt('');
      setStatusError('');
      setOutcome({ kind: 'parsed', fileName: file.name, parsed: data?.parsed || null });
      setFile(null);
      setIsUpdating(false);
    } catch (err) {
      if (err.status === 422 && err.error === 'unreadable_document') {
        setOutcome({ kind: 'unreadable', message: err.message });
      } else if (err.body?.fileKept === true) {
        // The file is on the profile but was not read (parser down, or the row failed).
        setHasResume(true);
        setCurrentFileName(file.name);
        setCurrentUploadedAt('');
        setStatusError('');
        setOutcome({ kind: 'kept', message: err.message });
        setFile(null);
        setIsUpdating(false);
      } else {
        setOutcome({ kind: 'error', message: err.message, requestId: err.requestId });
      }
    } finally {
      setUploading(false);
    }
  };

  const showPicker = !statusLoading && (!hasResume || isUpdating);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex justify-between items-center py-4 px-6 border-b border-border">
        <Link
          to="/candidate/dashboard"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors no-underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-sm font-medium">My applications</span>
        </Link>

        <div className="flex items-center gap-2">
          <PatinaMark size={28} />
          <span className="font-display font-bold text-[15px] tracking-[.14em] text-foreground">PATINA</span>
        </div>

        <div className="w-[60px]" />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-h1 mb-4 text-foreground">Upload resume</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Keep one latest resume on your profile. It is read when you upload it and used for every job you apply to.
          </p>
        </div>

        {/* One file input for every way of choosing a file (Browse, Update, drop). */}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={handleFileChange}
          data-testid="resume-file-input"
        />

        <div className="card p-8">
          {/* Current resume on file */}
          {statusLoading ? (
            <p className="text-sm text-muted-foreground mb-6">Checking your resume...</p>
          ) : statusError ? (
            <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-sm text-destructive flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>Could not check whether you already have a resume: {statusError} You can still upload one.</span>
            </div>
          ) : hasResume ? (
            <div className="mb-6 p-4 rounded-xl bg-muted border border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {currentFileName || 'Resume on file'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Current resume, used for all jobs{currentUploadedAt ? ` · uploaded ${currentUploadedAt}` : ''}
                  </p>
                </div>
              </div>
              {!isUpdating && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUpdating(true);
                    setOutcome(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-background transition-colors flex-shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Replace
                </button>
              )}
            </div>
          ) : (
            <div className="mb-6 p-4 rounded-xl bg-muted border border-border flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">No resume uploaded yet</p>
                <p className="text-xs text-muted-foreground">You need a resume before you can apply to jobs.</p>
              </div>
            </div>
          )}

          {showPicker && (
            <div ref={dropZoneRef}>
              <div
                className={`relative p-10 rounded-xl border-2 border-dashed transition-all duration-300 ${
                  isDragging ? 'border-foreground bg-muted' : 'border-border bg-background hover:border-foreground/30'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <>
                  {file ? (
                    <DocumentPreview file={file} onRemove={() => setFile(null)} />
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                        <FileText className="w-8 h-8 text-foreground" />
                      </div>
                      <p className="text-foreground font-medium">Drag and drop your resume here</p>
                      <p className="text-sm text-muted-foreground mt-1">or</p>
                      <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="mt-3 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus transition-colors"
                      >
                        <UploadIcon className="w-4 h-4" />
                        Browse files
                      </button>
                      <p className="text-xs text-muted-foreground mt-3">PDF or DOCX</p>
                    </div>
                  )}
                </>
              </div>
            </div>
          )}

          {/* Outcome of the last upload */}
          {outcome?.kind === 'parsed' && <ParsedSummary fileName={outcome.fileName} parsed={outcome.parsed} />}

          {outcome?.kind === 'unreadable' && (
            <div
              className="mt-5 p-4 rounded-md bg-destructive/10 border border-destructive/30 text-sm flex items-start gap-3"
              data-testid="resume-unreadable"
              role="alert"
            >
              <FileWarning className="w-5 h-5 flex-shrink-0 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">We can't read this file.</p>
                {unreadableDetail(outcome.message) && <p className="mt-1 text-foreground">{unreadableDetail(outcome.message)}</p>}
                <p className="mt-1 text-muted-foreground">
                  Nothing was kept from this upload.
                  {hasResume ? ' Your earlier resume is still on your profile, unchanged.' : ''}
                </p>
              </div>
            </div>
          )}

          {outcome?.kind === 'kept' && (
            <div
              className="mt-5 p-4 rounded-md bg-warning/10 border border-warning/30 text-sm flex items-start gap-3"
              data-testid="resume-saved-not-read"
              role="status"
            >
              <Clock className="w-5 h-5 flex-shrink-0 text-warning mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Your file is saved but has not been read yet.</p>
                {outcome.message && <p className="mt-1 text-muted-foreground">{outcome.message}</p>}
              </div>
            </div>
          )}

          {outcome?.kind === 'error' && (
            <div
              className="mt-5 p-4 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-3"
              data-testid="resume-upload-error"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p>{outcome.message}</p>
                {outcome.requestId && (
                  <p className="mt-1 text-xs text-muted-foreground">Request id: {outcome.requestId}</p>
                )}
              </div>
            </div>
          )}

          {showPicker && (
            <>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                data-testid="resume-upload-button"
                className={`mt-6 w-full h-12 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  file && !uploading
                    ? 'bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading and reading...
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-4 h-4" />
                    {hasResume ? 'Upload new resume' : 'Upload resume'}
                  </>
                )}
              </button>

              {hasResume && isUpdating && !uploading && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUpdating(false);
                    setFile(null);
                    setOutcome(null);
                  }}
                  className="mt-3 w-full h-10 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>

        {(outcome?.kind === 'parsed' || outcome?.kind === 'kept') && (
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              to="/candidate/jobs"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground no-underline hover:bg-primary-hover active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus transition-colors"
            >
              Browse jobs
            </Link>
            <Link
              to="/candidate/dashboard"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-background px-6 py-3 text-sm font-medium text-foreground no-underline hover:bg-muted transition-colors"
            >
              My applications
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

export default Upload;
