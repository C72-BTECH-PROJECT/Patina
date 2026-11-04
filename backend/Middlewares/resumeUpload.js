// Multipart parsing for the `resume` field, with the 10 MB cap (I-0025).
import multer from 'multer';

import { MAX_RESUME_BYTES } from '../Config/uploadLimits.js';

// Busboy stops a file when its size reaches the limit, so `fileSize: N` would
// refuse a file of exactly N bytes. N + 1 accepts N and refuses N + 1, which
// matches the bucket's `file_size_limit`.
const parseResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_BYTES + 1 },
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
