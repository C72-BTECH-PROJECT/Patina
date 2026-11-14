// Multipart parsing for the `resume` field, with the 10 MB cap (I-0025), and
// R-09's file check: the extension decides the type, and the file's leading
// bytes must match it.
import path from 'path';
import multer from 'multer';

import { MAX_RESUME_BYTES } from '../Config/uploadLimits.js';

// Busboy stops a file when its size reaches the limit, so `fileSize: N` would
// refuse a file of exactly N bytes. N + 1 accepts N and refuses N + 1, which
// matches the bucket's `file_size_limit`.
const parseResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_BYTES + 1 },
  // R-38: browsers send the file name as UTF-8; busboy's default (latin1) turned
  // "Résumé.pdf" into "RÃ©sumÃ©.pdf" in `resumes.file_name`.
  defParamCharset: 'utf8',
}).single('resume');

// Multer reports through next(err), and nothing else in core handles that, so
// without this a limit error reaches the browser as a 500 HTML page.
export const resumeUpload = (req, res, next) => {
  parseResume(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'Resume must be 10 MB or smaller.' });
      }
      return res.status(400).json({ message: 'Invalid upload. Send one file in the "resume" field.' });
    }
    return next(err);
  });
};

// The resume types core accepts. The content type is what the file is stored
// with: the `resumes` bucket has an `allowed_mime_types` list, and browsers often
// report `application/octet-stream`, so the extension decides.
//   PDF:  the header `%PDF-` must appear in the first 1024 bytes (where PDF
//         readers look for it; most files start with it).
//   DOCX: a ZIP archive, so the file starts with the local-file header PK\x03\x04.
const PDF_HEADER = Buffer.from('%PDF-', 'latin1');
const PDF_HEADER_WINDOW = 1024;
const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export const RESUME_TYPES = Object.freeze({
  '.pdf': {
    contentType: 'application/pdf',
    label: 'PDF',
    matches: (buf) => buf.subarray(0, PDF_HEADER_WINDOW).indexOf(PDF_HEADER) !== -1,
  },
  '.docx': {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'DOCX',
    matches: (buf) => buf.length >= 4 && buf.subarray(0, 4).equals(ZIP_LOCAL_HEADER),
  },
});

export const UNSUPPORTED_RESUME_MESSAGE = 'Only PDF or DOCX resumes are supported.';

/** The lower-case extension of an uploaded file when core accepts it, else null. */
export const resumeExtension = (file) => {
  const ext = path.extname(file?.originalname || '').toLowerCase();
  return Object.hasOwn(RESUME_TYPES, ext) ? ext : null;
};

/** True when the bytes look like the type the extension claims. */
export const resumeBytesMatch = (ext, buffer) =>
  Boolean(Object.hasOwn(RESUME_TYPES, ext) && Buffer.isBuffer(buffer) && RESUME_TYPES[ext].matches(buffer));

/**
 * Runs after `resumeUpload`. Refuses a missing file, an unsupported extension
 * and a file whose leading bytes do not match its extension (all 400). On
 * success sets `req.resumeExt` ('.pdf' | '.docx').
 */
export const requireResumeFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'missing_file', message: 'No resume file uploaded' });
  }
  const ext = resumeExtension(req.file);
  if (!ext) {
    return res.status(400).json({ error: 'unsupported_file_type', message: UNSUPPORTED_RESUME_MESSAGE });
  }
  if (!resumeBytesMatch(ext, req.file.buffer)) {
    const { label } = RESUME_TYPES[ext];
    return res.status(400).json({
      error: 'file_content_mismatch',
      message: `This file is not a valid ${label}. Please upload a real PDF or DOCX resume.`,
    });
  }
  req.resumeExt = ext;
  return next();
};
