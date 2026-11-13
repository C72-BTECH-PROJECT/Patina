// R-09 (REBUILD/DECISIONS.md §3, §4.1): the one resume pipeline.
//
// Parses a candidate's stored resume through nlp-engine and persists a
// `resumes` row. Used by upload (R-09), apply and score-again (R-10) and
// assessment generation (R-11), so every caller gets the same parse, the same
// storage path and the same errors.
//
//   runResumePipeline({ candidateId, job?, requestId?, stored? }) -> {
//     resume,            the inserted `resumes` row (as returned by Supabase)
//     entities,          the parser's `entities` object
//     contact,           { candidate_name, email, phone, github, linkedin } (null when absent)
//     rawText,           full extracted text, capped at 20,000 chars by the parser. NEVER persisted.
//     rawTextTruncated,  true when the parser cut the text at its cap
//     parserVersion,     the version string the parser reported
//     semanticAnalysis,  the parser's similarity block, or null when no job was given
//     storagePath,       the object that was parsed (`candidates/<id>/resume.<ext>`)
//   }
// Upload parses before it stores, so it uses the two halves directly:
// parseResumeBytes (parse only, persists nothing) and saveParsedResume (insert
// the row, return the shape above). runResumePipeline is those two in order.
// Any failure throws ResumePipelineError { code, status, message, reason?, cause? };
// `message` is a fixed sentence that is safe to send to the client.
//
// Storage path: one form, `candidates/<candidateId>/resume.<ext>` with ext
// `pdf` or `docx`. Older uploads may carry an upper-case extension
// (`resume.PDF`); they are read, never written.
import path from 'path';

import supabase from '../Config/supabase.js';
import { createTimeoutFetch } from './internalHttp.js';
import { RESUME_TYPES } from '../Middlewares/resumeUpload.js';

export const RESUME_BUCKET = 'resumes';
export const NLP_TIMEOUT_MS_DEFAULT = 30_000;

const nlpParseUrl = () => process.env.NLP_PARSE_URL || 'http://127.0.0.1:8000/parse';
const nlpTimeoutMs = () => {
  const n = Number(process.env.NLP_PARSE_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : NLP_TIMEOUT_MS_DEFAULT;
};

const STORED_NAME_RE = /^resume\.(pdf|docx)$/i;
const TOKEN_RE = /^[a-z_]{1,64}$/;
const UNREADABLE_REASONS = new Set(['no_text_layer', 'empty', 'corrupt']);

const UNREADABLE_MESSAGES = {
  no_text_layer: "We can't read this file: it has no text layer (for example a scanned image). Please upload a PDF or DOCX with selectable text.",
  empty: "We can't read this file: it contains no text. Please upload a PDF or DOCX with selectable text.",
  corrupt: "We can't read this file: it could not be opened. Please upload a valid PDF or DOCX.",
};

/** Fixed client-facing messages, one per error code. */
export const PIPELINE_MESSAGES = Object.freeze({
  no_resume: 'No resume is on file. Please upload your resume first.',
  storage_error: 'Could not read your stored resume. Please try again.',
  unsupported_file_type: 'Only PDF or DOCX resumes are supported.',
  parser_unavailable: 'The resume parser is not available right now. Please try again later.',
  parser_failed: 'The resume parser could not process this file. Please try again.',
  database_error: 'Could not save the parsed resume. Please try again.',
});

const STATUS_BY_CODE = {
  no_resume: 404,
  storage_error: 500,
  unreadable_document: 422,
  unsupported_file_type: 415,
  parser_unavailable: 503,
  parser_failed: 502,
  database_error: 500,
};

export class ResumePipelineError extends Error {
  /**
   * code:   no_resume | storage_error | unreadable_document | unsupported_file_type |
   *         parser_unavailable | parser_failed | database_error
   * status: the HTTP status a handler should answer with
   * reason: for unreadable_document, the parser's reason (no_text_layer | empty | corrupt)
   * cause:  the underlying error, for the server log only
   */
  constructor(code, { reason = null, cause, detail } = {}) {
    super(code === 'unreadable_document'
      ? (UNREADABLE_MESSAGES[reason] || UNREADABLE_MESSAGES.corrupt)
      : PIPELINE_MESSAGES[code]);
    this.name = 'ResumePipelineError';
    this.code = code;
    this.status = STATUS_BY_CODE[code] ?? 500;
    this.reason = reason;
    this.cause = cause;
    this.detail = detail || null;
  }
}

/** The one storage path a resume is written to. `ext` is '.pdf' or '.docx'. */
export const canonicalResumePath = (candidateId, ext) => {
  const e = String(ext || '').toLowerCase();
  if (!Object.hasOwn(RESUME_TYPES, e)) throw new Error(`unsupported resume extension: ${e}`);
  return `candidates/${candidateId}/resume${e}`;
};

/**
 * Every stored resume object of a candidate (`candidates/<id>/resume.pdf|docx`,
 * any case), newest first. A storage error throws `storage_error`: it is never
 * reported as "no resume" (B9).
 */
export async function listStoredResumes(candidateId) {
  const folder = `candidates/${candidateId}`;
  let data;
  let error;
  try {
    ({ data, error } = await supabase.storage.from(RESUME_BUCKET).list(folder, { limit: 100 }));
  } catch (err) {
    throw new ResumePipelineError('storage_error', { cause: err, detail: 'storage list threw' });
  }
  if (error) throw new ResumePipelineError('storage_error', { cause: error, detail: 'storage list failed' });
  const stamp = (f) => Date.parse(f.updated_at || f.created_at || '') || 0;
  return (Array.isArray(data) ? data : [])
    .filter((f) => typeof f?.name === 'string' && STORED_NAME_RE.test(f.name))
    .sort((a, b) => stamp(b) - stamp(a))
    .map((f) => ({
      name: f.name,
      path: `${folder}/${f.name}`,
      ext: path.extname(f.name).toLowerCase(),
      updatedAt: f.updated_at || f.created_at || null,
    }));
}

/** The candidate's current resume object (newest), or null when there is none. */
export async function findStoredResume(candidateId) {
  const files = await listStoredResumes(candidateId);
  return files[0] || null;
}

async function downloadStored(objectPath) {
  let data;
  let error;
  try {
    ({ data, error } = await supabase.storage.from(RESUME_BUCKET).download(objectPath));
  } catch (err) {
    throw new ResumePipelineError('storage_error', { cause: err, detail: 'storage download threw' });
  }
  if (error || !data) {
    throw new ResumePipelineError('storage_error', { cause: error || 'no data', detail: 'storage download failed' });
  }
  return Buffer.from(await data.arrayBuffer());
}

const tokenOrNull = (v) => (typeof v === 'string' && TOKEN_RE.test(v) ? v : null);

/** POST the file (and the job, if any) to nlp-engine. Returns the parsed 200 body. */
async function callParser({ buffer, ext, job, requestId }) {
  const form = new FormData();
  form.append('resume', new Blob([buffer], { type: RESUME_TYPES[ext].contentType }), `resume${ext}`);
  if (job) {
    if (typeof job.description === 'string' && job.description.trim()) form.append('jd', job.description);
    form.append('required_skills', JSON.stringify(Array.isArray(job.required_skills) ? job.required_skills : []));
    form.append('preferred_skills', JSON.stringify(Array.isArray(job.preferred_skills) ? job.preferred_skills : []));
  }

  const timeoutMs = nlpTimeoutMs();
  const timedFetch = createTimeoutFetch({ timeoutMs, timeoutCode: 'NLP_TIMEOUT', label: 'NLP parse' });
  const headers = { Accept: 'application/json' };
  if (requestId) headers['X-Request-ID'] = requestId;

  let response;
  try {
    response = await timedFetch(nlpParseUrl(), { method: 'POST', body: form, headers });
  } catch (err) {
    const kind = err?.code === 'NLP_TIMEOUT' ? `timeout after ${timeoutMs} ms` : 'unreachable';
    throw new ResumePipelineError('parser_unavailable', { cause: err, detail: `nlp ${kind}` });
  }

  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* handled below */ }

  if (response.status === 422 && body?.error === 'unreadable_document') {
    const reason = UNREADABLE_REASONS.has(body.reason) ? body.reason : 'corrupt';
    throw new ResumePipelineError('unreadable_document', { reason, detail: `nlp 422 reason=${tokenOrNull(body.reason) || '-'}` });
  }
  if (response.status === 415) {
    throw new ResumePipelineError('unsupported_file_type', { detail: 'nlp 415' });
  }
  if (response.status === 503) {
    throw new ResumePipelineError('parser_unavailable', { detail: 'nlp 503' });
  }
  if (!response.ok) {
    // The parser's body (traceback, field list) stays out of the log too; only its code.
    throw new ResumePipelineError('parser_failed', { detail: `nlp HTTP ${response.status} error=${tokenOrNull(body?.error) || '-'}` });
  }
  if (!body || typeof body !== 'object' || !body.entities || typeof body.entities !== 'object'
    || typeof body.parser_version !== 'string' || !body.parser_version
    || typeof body.raw_text !== 'string') {
    throw new ResumePipelineError('parser_failed', { detail: 'nlp 200 body does not match the contract' });
  }
  return body;
}

const arrayOr = (v) => (Array.isArray(v) ? v : []);
const strOrNull = (v) => (typeof v === 'string' && v.trim() ? v : null);

/**
 * Parse resume bytes that are not (or not yet) stored. Returns the parser's 200
 * body; throws ResumePipelineError otherwise. Persists nothing. Upload uses it
 * to parse before storing (R-09 rework), so an unreadable file is never stored.
 *
 * @param {object}  p
 * @param {Buffer}  p.buffer
 * @param {string}  p.ext          '.pdf' | '.docx'
 * @param {object} [p.job]         as in runResumePipeline
 * @param {string} [p.requestId]
 */
export async function parseResumeBytes({ buffer, ext, job = null, requestId } = {}) {
  const e = String(ext || '').toLowerCase();
  if (!Object.hasOwn(RESUME_TYPES, e)) throw new ResumePipelineError('unsupported_file_type', { detail: `ext ${e}` });
  return callParser({ buffer, ext: e, job, requestId });
}

/**
 * Persist a parse of the object at `storagePath` as a `resumes` row and return
 * the same shape as runResumePipeline. `parsed` is the body from parseResumeBytes.
 */
export async function saveParsedResume({ candidateId, job = null, storagePath, fileName, parsed: body } = {}) {
  if (!candidateId) throw new Error('saveParsedResume: candidateId is required');
  const entities = body.entities;
  const contact = {
    candidate_name: strOrNull(entities.candidate_name),
    email: strOrNull(entities.email),
    phone: strOrNull(entities.phone),
    github: strOrNull(entities.github),
    linkedin: strOrNull(entities.linkedin),
  };
  const skills = arrayOr(entities.skills).filter((s) => typeof s === 'string');

  let row;
  let error;
  try {
    ({ data: row, error } = await supabase
      .from('resumes')
      .insert({
        candidate_id: candidateId,
        job_id: job?.id ?? null,
        file_name: fileName || path.basename(storagePath),
        file_ref: storagePath,
        // D§3: only the parser's 300-character preview is stored, never the full text.
        raw_text_preview: typeof body.raw_text_preview === 'string' ? body.raw_text_preview : null,
        contact,
        skills,
        experience: arrayOr(entities.experience),
        education: arrayOr(entities.education),
        projects: arrayOr(entities.projects),
        project_links: [contact.github, contact.linkedin].filter(Boolean),
        parser_version: body.parser_version,
      })
      .select()
      .single());
  } catch (err) {
    throw new ResumePipelineError('database_error', { cause: err, detail: 'resumes insert threw' });
  }
  if (error || !row) throw new ResumePipelineError('database_error', { cause: error || 'no row', detail: 'resumes insert failed' });

  return {
    resume: row,
    entities,
    contact,
    rawText: body.raw_text,
    rawTextTruncated: body.raw_text_truncated === true,
    parserVersion: body.parser_version,
    semanticAnalysis: body.semantic_analysis ?? null,
    storagePath,
  };
}

/**
 * Parse a candidate's stored resume and persist the `resumes` row.
 *
 * @param {object}  p
 * @param {string}  p.candidateId  the candidate's profile id
 * @param {object} [p.job]         { id, description, required_skills, preferred_skills }; when
 *                                 given, the parse includes similarity and the row carries job_id
 * @param {string} [p.requestId]   forwarded to nlp-engine as X-Request-ID
 * @param {object} [p.stored]      { path, buffer, fileName } of an object already stored at
 *                                 `path`; skips the lookup and the download
 */
export async function runResumePipeline({ candidateId, job = null, requestId, stored = null } = {}) {
  if (!candidateId) throw new Error('runResumePipeline: candidateId is required');

  let storagePath;
  let buffer;
  let fileName;
  if (stored) {
    ({ path: storagePath, buffer, fileName } = stored);
  } else {
    const found = await findStoredResume(candidateId);
    if (!found) throw new ResumePipelineError('no_resume');
    storagePath = found.path;
    buffer = await downloadStored(found.path);
    fileName = found.name;
  }

  const parsed = await parseResumeBytes({ buffer, ext: path.extname(storagePath), job, requestId });
  return saveParsedResume({ candidateId, job, storagePath, fileName, parsed });
}
