import supabase from '../Config/supabase.js';
import { GITHUB_OWNERSHIP_NOTE, SUBSCORE_KEYS, UNPROCTORED_NOTE, scoreBand } from '../Services/explainability.js';
import {
  attemptPhase, isVoided, loadAttempts, maxAttempts, poolOf, startedAtOf, summariseAttempts,
} from '../Services/assessmentService.js';
// R-13: the recruiter list derives assessment state through the candidate status
// read's own function, and shows attempts as the recruiter attempts read does.
import { candidateView, recruiterAttempt } from './assessment.controller.js';
import { resolveRequestId } from '../Services/internalHttp.js';
import { loadApplicantIdentities } from '../Services/applicantIdentity.js';
import { isUuid } from '../Services/validation.js';
import { MAX_RESUME_BYTES } from '../Config/uploadLimits.js';
import { resumeUpload, requireResumeFile, RESUME_TYPES } from '../Middlewares/resumeUpload.js';
import { logError, sendError } from '../Middlewares/errorHandler.js';
import {
  RESUME_BUCKET,
  ResumePipelineError,
  canonicalResumePath,
  findStoredResume,
  listStoredResumes,
  parseResumeBytes,
  saveParsedResume,
} from '../Services/resumePipeline.js';
import { scoreApplication, scoringSummary } from '../Services/scoringPipeline.js';

// R-10: POST /api/analyze is removed (Y1). Scoring runs on apply
// (jobs.controller.js applyToJob) and on POST /api/applications/:id/score
// (rescoreApplication below), both through Services/scoringPipeline.js; the parse
// goes through Services/resumePipeline.js, whose parser version comes from the
// service itself.

// Shape a persisted score (+ its resume and job) into the object the candidate's
// own result view (GET /api/candidate-analysis) consumes. The recruiter views use
// the applications API below instead (R-13, Y2).
//
// Top-level keys are camelCase. `subScores` and `explanation` are handed over
// exactly as they were persisted (snake_case inside), so the stored audit record
// is rendered rather than a re-derived copy of it (CHECKLIST 4.11 / 5.8). The
// per-source `*Score` fields: null means "that engine produced no evidence", never
// zero. R-13 (B3, B4): no "Candidate" placeholder name (null when the resume names
// nobody) and no `location` (it was the job's location, not the candidate's).
const serializeCandidate = ({ score, resume, job }) => {
  const contact = resume?.contact || {};
  const skills = Array.isArray(resume?.skills) ? resume.skills : [];
  const subScores = score?.subscores || {};
  const explanation = score?.explanation || null;
  const subScoreValue = (key) =>
    subScores[key]?.available ? Number(subScores[key].value) : null;
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  return {
    id: score.id,
    resumeId: resume?.id ?? null,
    candidateId: score.candidate_id,
    jobId: score.job_id,
    jobTitle: job?.title ?? null,
    candidate: {
      name: text(contact.candidate_name),
      email: text(contact.email),
      phone: text(contact.phone),
      github: text(contact.github),
      linkedin: text(contact.linkedin),
    },
    extractedSkills: skills,
    experience: Array.isArray(resume?.experience) ? resume.experience : [],
    education: Array.isArray(resume?.education) ? resume.education : [],
    projects: Array.isArray(resume?.projects) ? resume.projects : [],
    credibilityScore: Number(score.composite_score),
    // D§7: the one band, from explainability.js (thresholds live there only).
    band: scoreBand(score.composite_score),
    matchLevel: subScores[SUBSCORE_KEYS.PARSING]?.components?.match_level ?? null,

    // Explainability payload (FR-13, GF-5).
    subScores,
    weights: score.weights,
    explanation,
    evidenceLimited: score.evidence_limited,
    skillEvidence: explanation?.skill_evidence ?? [],
    flags: explanation?.flags ?? [],
    flagsAvailable: explanation?.flags_available ?? false,
    flagsUnavailableReason: explanation?.flags_unavailable_reason ?? null,

    // Per-source values, null while that source has no evidence.
    nlpScore: subScoreValue(SUBSCORE_KEYS.PARSING),
    githubScore: subScoreValue(SUBSCORE_KEYS.GITHUB),
    assessmentScore: subScoreValue(SUBSCORE_KEYS.ASSESSMENT),

    resumeFileName: resume?.file_name ?? null,
    appliedAt: score.created_at,
  };
};

// R-09: after a new resume is kept, remove the candidate's other resume objects
// (a different extension), so the profile has exactly one. Best effort: a
// failure is logged; readers take the newest object (listStoredResumes), so a
// leftover file is never read as the current resume.
const pruneOtherResumes = async (req, candidateId, keepPath) => {
  try {
    const stale = (await listStoredResumes(candidateId)).map((f) => f.path).filter((p) => p !== keepPath);
    if (stale.length === 0) return;
    const { error } = await supabase.storage.from(RESUME_BUCKET).remove(stale);
    if (error) logError(req, '[resume] old resume cleanup failed', error);
  } catch (err) {
    logError(req, '[resume] old resume cleanup failed', err);
  }
};

// Returns whether the current candidate has a resume in Supabase Storage.
// A storage error is an error, never "no resume uploaded" (B9).
export const getMyResumeStatus = async (req, res) => {
  let resumeFile;
  try {
    resumeFile = await findStoredResume(req.session.userId);
  } catch (err) {
    if (err instanceof ResumePipelineError) {
      return sendError(req, res, { status: 500, error: 'storage_error', message: 'Could not check your resume. Please try again.', cause: err.cause, context: 'resume status storage list' });
    }
    throw err;
  }

  return res.json({
    hasResume: Boolean(resumeFile),
    fileName: resumeFile?.name || null,
    updatedAt: resumeFile?.updatedAt || null,
    maxResumeBytes: MAX_RESUME_BYTES,
  });
};

// Generates a signed URL for a candidate's resume. Intended for recruiters
// reviewing applicants; the frontend opens this URL in a new tab.
// T-0029 (I-0056): only for a candidate who applied to one of this recruiter's
// jobs. "Not yours" and "no résumé" give the same 404, so ids cannot be probed.
export const getCandidateResume = async (req, res) => {
  try {
    const { candidateId } = req.params;
    if (!isUuid(candidateId)) {
      return res.status(400).json({ error: 'invalid_candidate_id', message: 'candidateId must be a UUID.' });
    }

    const { data: applied, error: appliedError } = await supabase
      .from('applications')
      .select('id, job:jobs!inner(recruiter_id)')
      .eq('candidate_id', candidateId)
      .eq('job.recruiter_id', req.session.userId)
      .limit(1);
    if (appliedError) {
      console.error('[resume] application lookup failed:', appliedError.message);
      return res.status(500).json({ message: 'Failed to load resume' });
    }
    if (!Array.isArray(applied) || applied.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'No resume found for this candidate.' });
    }

    // B9 (R-09): a storage-list error is an error, not "no resume".
    let resumeFile;
    try {
      resumeFile = await findStoredResume(candidateId);
    } catch (err) {
      if (err instanceof ResumePipelineError) {
        return sendError(req, res, { status: 500, error: 'storage_error', message: 'Failed to load resume', cause: err.cause, context: 'resume link storage list' });
      }
      throw err;
    }

    if (!resumeFile) {
      return res.status(404).json({ error: 'not_found', message: 'No resume found for this candidate.' });
    }

    const storagePath = resumeFile.path;
    const { data: signed, error: signedError } = await supabase.storage
      .from('resumes')
      .createSignedUrl(storagePath, 60);

    if (signedError || !signed?.signedUrl) {
      return sendError(req, res, { status: 500, error: 'storage_error', message: 'Could not generate resume link.', cause: signedError || 'no signed URL returned', context: 'resume signed URL' });
    }

    return res.json({ url: signed.signedUrl, fileName: resumeFile.name });
  } catch (err) {
    return sendError(req, res, { status: 500, error: 'internal_error', message: 'Failed to load resume', cause: err, context: 'resume link' });
  }
};

// R-09 (D§4.1, reworked): upload parses the in-memory file first, then decides
// what to store, so an unreadable re-upload never touches an earlier resume.
//   400  no file, unsupported extension, or bytes that do not match it (nothing parsed or stored)
//   201  parsed: stored at `candidates/<id>/resume.<ext>` (replacing), `resumes` row persisted,
//        { message, fileName, size, parsed: {...} }
//   422  unreadable_document { error, reason, message, stored: false }: nothing stored
//   415  the parser refused the type { error, message, stored: false }: nothing stored
//   502  parser_failed / 500 before storing: nothing stored (`stored: false`)
//   503  parser_unavailable: the file IS stored so it can be parsed later (`fileKept: true`)
//   500  storage_error when storing fails (no `resumes` row); database_error when the row
//        insert fails after the file was stored (`fileKept: true`)
// After a file is stored, the candidate's resume objects with the other extension are
// removed (best effort), so a profile keeps exactly one resume.
export const uploadResume = [
  resumeUpload,
  requireResumeFile,
  async (req, res) => {
    const candidateId = req.session.userId;
    const requestId = req.requestId || resolveRequestId(req);
    const ext = req.resumeExt;
    const storagePath = canonicalResumePath(candidateId, ext);
    const fileName = req.file.originalname;

    const storeFile = async () => {
      const { error } = await supabase.storage
        .from(RESUME_BUCKET)
        .upload(storagePath, req.file.buffer, { contentType: RESUME_TYPES[ext].contentType, upsert: true });
      return error || null;
    };
    const storageFailed = (cause) => sendError(req, res, {
      status: 500, error: 'storage_error', message: 'Could not save your resume. Please try again.', cause, context: '[resume] upload: storage upload',
    });

    // 1. Parse the bytes in memory. Nothing is stored yet.
    let parsed;
    try {
      parsed = await parseResumeBytes({ buffer: req.file.buffer, ext, requestId });
    } catch (err) {
      if (!(err instanceof ResumePipelineError)) {
        return sendError(req, res, { status: 500, error: 'internal_error', message: 'Could not upload your resume.', cause: err, context: '[resume] upload: parse' });
      }
      logError(req, `[resume] upload -> ${err.status} ${err.code}${err.detail ? ` (${err.detail})` : ''}`, err.cause);
      // A ResumePipelineError's message is one of its fixed client sentences
      // (Services/resumePipeline.js), never upstream text.
      const fixedMessage = err.message;

      if (err.code === 'parser_unavailable') {
        // The one case where an unparsed file is stored, and so replaces an earlier
        // resume of the same extension: the parser is down, not the file at fault,
        // and the candidate's upload is kept so it can be parsed later.
        const storeError = await storeFile();
        if (storeError) return storageFailed(storeError);
        await pruneOtherResumes(req, candidateId, storagePath);
        return res.status(503).json({
          error: 'parser_unavailable',
          message: 'Your resume was saved, but it could not be read right now because the resume parser is unavailable. Please try again later.',
          fileKept: true,
        });
      }
      // unreadable_document (422), unsupported_file_type (415), parser_failed (502):
      // nothing is stored and any earlier resume stays as it was.
      return res.status(err.status).json({
        error: err.code,
        ...(err.reason ? { reason: err.reason } : {}),
        message: fixedMessage,
        stored: false,
      });
    }

    // 2. Parsed: store the file (replacing), then persist the row.
    const storeError = await storeFile();
    if (storeError) return storageFailed(storeError);
    await pruneOtherResumes(req, candidateId, storagePath);

    let result;
    try {
      result = await saveParsedResume({ candidateId, storagePath, fileName, parsed });
    } catch (err) {
      if (!(err instanceof ResumePipelineError)) {
        return sendError(req, res, { status: 500, error: 'internal_error', message: 'Could not upload your resume.', cause: err, context: '[resume] upload: persist' });
      }
      logError(req, `[resume] upload -> ${err.status} ${err.code}${err.detail ? ` (${err.detail})` : ''}`, err.cause);
      const fixedMessage = err.message;
      return res.status(err.status).json({ error: err.code, message: fixedMessage, fileKept: true });
    }

    const row = result.resume;
    return res.status(201).json({
      message: 'Resume uploaded and read.',
      fileName,
      size: req.file.size,
      parsed: {
        resumeId: row.id,
        parserVersion: result.parserVersion,
        contact: result.contact,
        skills: Array.isArray(row.skills) ? row.skills : [],
        experience: Array.isArray(row.experience) ? row.experience : [],
        education: Array.isArray(row.education) ? row.education : [],
        projects: Array.isArray(row.projects) ? row.projects : [],
        links: Array.isArray(row.project_links) ? row.project_links : [],
        parsedAt: row.created_at ?? null,
      },
    });
  },
];

// R-10 (D§4.1, Y1): POST /api/applications/:id/score. Re-runs the scoring
// pipeline for one application and inserts a new `scores` row (never an update).
// Allowed for the candidate who owns the application and for the recruiter who
// owns its job; anyone else gets 403.
//   400 invalid id · 404 no such application · 403 not yours · 500 lookup error
//   200 { applicationId, scoring: { status: 'scored' | 'failed', reason } }
// The scoring outcome is in the body, as on apply: a failed attempt is a normal
// answer (the application is untouched and can be retried), with a stable reason code.
export const rescoreApplication = async (req, res) => {
  const applicationId = req.params.id;
  if (!isUuid(applicationId)) {
    return res.status(400).json({ error: 'invalid_application_id', message: 'The application id must be a UUID.' });
  }

  const { data: application, error } = await supabase
    .from('applications')
    .select('id, candidate_id, job_id, job:jobs!inner(id, recruiter_id, description, required_skills, preferred_skills)')
    .eq('id', applicationId)
    .maybeSingle();
  if (error) {
    return sendError(req, res, { status: 500, error: 'database_error', message: 'Could not load the application.', cause: error, context: 'score-again: application lookup' });
  }
  if (!application) {
    return res.status(404).json({ error: 'not_found', message: 'Application not found.' });
  }

  const userId = req.session.userId;
  const role = req.session.role;
  const allowed = (role === 'CANDIDATE' && application.candidate_id === userId)
    || (role === 'RECRUITER' && application.job?.recruiter_id === userId);
  if (!allowed) {
    return res.status(403).json({ error: 'forbidden', message: 'You cannot score this application.' });
  }

  const { recruiter_id: _owner, ...job } = application.job;
  let result;
  try {
    result = await scoreApplication({
      candidateId: application.candidate_id,
      job,
      requestId: req.requestId || resolveRequestId(req),
    });
  } catch (err) {
    logError(req, '[score-again] scoring threw', err);
    result = { status: 'failed', reason: 'internal_error' };
  }
  return res.status(200).json({ applicationId: application.id, scoring: scoringSummary(result) });
};

export const getCandidateAnalysis = async (req, res) => {
  try {
    const candidateId = req.session.userId;
    const { data: score, error } = await supabase
      .from('scores')
      .select('*, resume:resumes(*), job:jobs(title)')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return sendError(req, res, { status: 500, error: 'database_error', message: 'Failed to load analysis', cause: error, context: 'candidate analysis' });
    }
    if (!score) {
      return res.status(404).json({ message: 'No analysis yet. Upload a resume first.' });
    }
    return res.json(serializeCandidate({ score, resume: score.resume, job: score.job }));
  } catch (err) {
    return sendError(req, res, { status: 500, error: 'internal_error', message: 'Failed to load analysis', cause: err, context: 'candidate analysis' });
  }
};

// ---------------------------------------------------------------------------
// R-13 (D§8.2, Y2): the recruiter applications API. One application-centric list
// replaces GET /api/candidates and GET /api/recruiter/applicants (both removed).
//
//   GET /api/recruiter/applications[?jobId=]   (RECRUITER)
//   GET /api/recruiter/applications/:id        (RECRUITER)
//
// Only applications to jobs the calling recruiter owns. A `jobId` or application id
// that is someone else's answers exactly like one that does not exist (404), so ids
// cannot be probed. A candidate's contact data (profile name, account email) reaches
// a recruiter only through such an application (D§10). Every lookup error is an
// error (500 JSON through the error contract), never an empty list, a blank email or
// "not scored" (B5, B6, B8).
//
// List item:
//   { id, status, applied_at,
//     job: { id, title },
//     candidate: { id, name, email },      name from the account profile (null when it
//                                          has none), never from the parsed resume
//     score: null | { id, composite, band, evidence_limited, created_at,
//                     subscores: { <key>: { available, value, weight, reason? } | null },
//                     skills },            skills of the resume the score was computed from
//     scoring: { state: 'scored' | 'pending' },   pending = no score row yet (Y1); no
//                                          failure reason is stored, so none is given
//     assessment: { state, reason?, assessment_id, attempts: { used, max },
//                   score_of_record: null | { assessment_id, score, completed_at },
//                   voided: [{ assessment_id, by, role, at, reason, prior_state }] } }
//
// `score` is the NEWEST `scores` row for that candidate and job (rows are inserted,
// never updated; D§3). Sorted by composite descending, unscored last; ties by
// applied_at descending, then id. `assessment.state` comes from the same function
// the candidate status endpoint uses (assessment.controller.js candidateView) in its
// observe-only mode: a recruiter read never starts a preparation (no LLM generation)
// and never voids a row; it does finalise an expired started attempt (R-12). States:
// `not_prepared` (no pool, nothing running), `preparing` / `unavailable` (only when this
// process's in-memory registry says so, never a stored fact), `ready`, `in_progress`,
// `grading_pending`, `completed`, `attempts_used`.
// ---------------------------------------------------------------------------

const SCORE_COLUMNS = 'id, candidate_id, job_id, resume_id, composite_score, subscores, weights, evidence_limited, created_at';

const applicationNotFound = (res) => res.status(404).json({ error: 'not_found', message: 'Application not found.' });

const recruiterReadFailed = (req, res, err, context) => sendError(req, res, {
  status: 500,
  error: err?.code === 'database_error' ? 'database_error' : 'internal_error',
  message: 'Could not load applications. Please try again.',
  cause: err?.cause || err,
  context,
});

const dbFailure = (context, cause) => Object.assign(new Error(`${context} failed`), { code: 'database_error', cause });
const pairKey = (candidateId, jobId) => `${candidateId}:${jobId}`;
const stampOf = (v) => Date.parse(v || '') || 0;
const newestFirst = (a, b) => stampOf(b.created_at) - stampOf(a.created_at) || String(b.id).localeCompare(String(a.id));

/** One stored sub-score as the list shows it, or null when the row holds none for that key. */
const subscoreSummary = (sub, storedWeight) => {
  if (!sub || typeof sub !== 'object') return null;
  const available = sub.available === true;
  const weight = Number.isFinite(Number(sub.weight)) ? Number(sub.weight) : Number(storedWeight) || 0;
  return {
    available,
    value: available && Number.isFinite(Number(sub.value)) ? Number(sub.value) : null,
    weight,
    ...(available ? {} : { reason: typeof sub.reason === 'string' ? sub.reason : null }),
  };
};

/** The summary fields of one `scores` row. `skillsByResume`: resume id -> skills array. */
const scoreSummary = (row, skillsByResume) => ({
  id: row.id,
  composite: Number(row.composite_score),
  band: scoreBand(row.composite_score),
  evidence_limited: row.evidence_limited === true,
  subscores: Object.fromEntries(Object.values(SUBSCORE_KEYS).map((key) => [
    key, subscoreSummary(row.subscores?.[key], row.weights?.[key]),
  ])),
  // null when the resume row is gone; never an invented empty list (B2).
  skills: skillsByResume.has(row.resume_id) ? skillsByResume.get(row.resume_id) : null,
  created_at: row.created_at ?? null,
});

/** resume id -> skills, for the given ids (one query). Throws on a lookup error. */
async function loadResumeSkills(resumeIds) {
  const ids = [...new Set(resumeIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from('resumes').select('id, skills').in('id', ids);
  if (error) throw dbFailure('resume skills lookup', error);
  return new Map((data || []).map((r) => [r.id, Array.isArray(r.skills) ? r.skills : []]));
}

/**
 * One batched pool check for every open, unstarted row (instead of one lookup per
 * `ready` row): returns id -> boolean. The key row is read server-side only; nothing
 * of it leaves this function. Throws on a lookup error.
 */
async function loadPoolReadiness(rows) {
  const ids = rows.filter((r) => r.status === 'generated' && !startedAtOf(r) && !isVoided(r)).map((r) => r.id);
  const ready = new Set();
  if (ids.length) {
    const { data, error } = await supabase.from('assessment_keys').select('assessment_id, answer_key').in('assessment_id', ids);
    if (error) throw dbFailure('pool readiness lookup', error);
    for (const k of data || []) if (poolOf(k.answer_key)) ready.add(k.assessment_id);
  }
  return (id) => ready.has(id);
}

const voidList = (rows) => rows
  .filter(isVoided)
  .sort((a, b) => stampOf(a.evaluation.voided.at) - stampOf(b.evaluation.voided.at))
  .map((r) => {
    const v = r.evaluation.voided;
    return { assessment_id: r.id, by: v.by ?? null, role: v.role ?? null, at: v.at ?? null, reason: v.reason ?? null, prior_state: v.prior_state ?? null };
  });

/**
 * The assessment block for one application. `rows` are that candidate's assessment
 * rows for the job; the state is derived by candidateView in observe-only mode (see
 * above). `poolReady` (optional): the batched pool check for unstarted rows.
 */
async function assessmentSummary(req, { candidateId, jobId, rows, poolReady = null }) {
  const s = summariseAttempts(rows, maxAttempts());
  const view = await candidateView(req, { candidateId, jobId, s }, { observeOnly: true, poolReady });
  return {
    s,
    view,
    summary: {
      state: view.state,
      ...(view.reason ? { reason: view.reason } : {}),
      assessment_id: view.assessmentId ?? null,
      attempts: { used: s.used, max: s.max },
      score_of_record: s.scoreOfRecord
        ? { assessment_id: s.scoreOfRecord.assessmentId, score: s.scoreOfRecord.score, completed_at: s.scoreOfRecord.completedAt }
        : null,
      voided: voidList(rows),
    },
  };
}

const applicationItem = ({ app, job, identity, newest, skillsByResume, assessment }) => ({
  id: app.id,
  status: app.status,
  applied_at: app.submitted_at ?? null,
  job: { id: job.id, title: job.title ?? null },
  candidate: { id: app.candidate_id, name: identity?.name ?? null, email: identity?.email ?? null },
  score: newest ? scoreSummary(newest, skillsByResume) : null,
  scoring: { state: newest ? 'scored' : 'pending' },
  assessment,
});

const byCompositeThenApplied = (a, b) => {
  if (a.score && !b.score) return -1;
  if (!a.score && b.score) return 1;
  if (a.score && b.score && a.score.composite !== b.score.composite) return b.score.composite - a.score.composite;
  return stampOf(b.applied_at) - stampOf(a.applied_at) || String(a.id).localeCompare(String(b.id));
};

/**
 * GET /api/recruiter/applications[?jobId=]
 *   200 [ list item, ... ] (see above)
 *   400 invalid_job_id · 404 job_not_found (no such job, or not this recruiter's) · 500
 */
export const listRecruiterApplications = async (req, res) => {
  try {
    const recruiterId = req.session.userId;
    const jobId = req.query?.jobId;
    if (jobId !== undefined && !isUuid(jobId)) {
      return res.status(400).json({ error: 'invalid_job_id', message: 'jobId must be a UUID.' });
    }

    const { data: jobRows, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('recruiter_id', recruiterId);
    if (jobsError) throw dbFailure('recruiter jobs', jobsError);
    let jobs = jobRows || [];
    if (jobId !== undefined) {
      jobs = jobs.filter((j) => j.id === jobId);
      if (!jobs.length) return res.status(404).json({ error: 'job_not_found', message: 'Job not found.' });
    }
    if (!jobs.length) return res.json([]);
    const jobsById = new Map(jobs.map((j) => [j.id, j]));
    const jobIds = [...jobsById.keys()];

    const { data: appRows, error: appsError } = await supabase
      .from('applications')
      .select('id, candidate_id, job_id, status, submitted_at')
      .in('job_id', jobIds)
      .order('submitted_at', { ascending: false });
    if (appsError) throw dbFailure('recruiter applications', appsError);
    // Defence in depth: only rows for the jobs asked about, whatever the query returned.
    const apps = (appRows || []).filter((a) => jobsById.has(a.job_id));
    if (!apps.length) return res.json([]);
    const candidateIds = [...new Set(apps.map((a) => a.candidate_id))];
    const pairs = new Set(apps.map((a) => pairKey(a.candidate_id, a.job_id)));

    // Batched: one profiles query + one email RPC, one scores query, one assessments query.
    const [identities, scoreResult, attemptResult] = await Promise.all([
      loadApplicantIdentities(supabase, candidateIds),
      supabase.from('scores').select(SCORE_COLUMNS)
        .in('job_id', jobIds).in('candidate_id', candidateIds)
        .order('created_at', { ascending: false }),
      supabase.from('assessments')
        .select('id, candidate_id, job_id, status, answers, score, evaluation, created_at, completed_at, grading_started_at')
        .in('job_id', jobIds).in('candidate_id', candidateIds),
    ]);
    if (scoreResult.error) throw dbFailure('recruiter scores', scoreResult.error);
    if (attemptResult.error) throw dbFailure('recruiter assessments', attemptResult.error);

    const newestByPair = new Map();
    for (const row of [...(scoreResult.data || [])].sort(newestFirst)) {
      const key = pairKey(row.candidate_id, row.job_id);
      if (pairs.has(key) && !newestByPair.has(key)) newestByPair.set(key, row);
    }
    const attemptsByPair = new Map();
    for (const row of attemptResult.data || []) {
      const key = pairKey(row.candidate_id, row.job_id);
      if (!pairs.has(key)) continue;
      if (!attemptsByPair.has(key)) attemptsByPair.set(key, []);
      attemptsByPair.get(key).push(row);
    }
    const skillsByResume = await loadResumeSkills([...newestByPair.values()].map((r) => r.resume_id));
    const poolReady = await loadPoolReadiness([...attemptsByPair.values()].flat());

    const items = await Promise.all(apps.map(async (app) => {
      const key = pairKey(app.candidate_id, app.job_id);
      const { summary } = await assessmentSummary(req, {
        candidateId: app.candidate_id, jobId: app.job_id, rows: attemptsByPair.get(key) || [], poolReady,
      });
      return applicationItem({
        app,
        job: jobsById.get(app.job_id),
        identity: identities.get(app.candidate_id),
        newest: newestByPair.get(key) || null,
        skillsByResume,
        assessment: summary,
      });
    }));

    return res.json(items.sort(byCompositeThenApplied));
  } catch (err) {
    return recruiterReadFailed(req, res, err, 'recruiter applications: list');
  }
};

/**
 * Per-question recruiter detail for graded attempts: assessment id -> Map(question_id ->
 * { question, recruiter_feedback }). The question text comes from the served questions
 * of a STARTED attempt (an unstarted pool is never read); the feedback from
 * `assessment_keys.answer_key.recruiter_results` (server-side only; nothing else of the
 * key leaves this function). Throws on a lookup error.
 */
async function loadRecruiterDetail(rows) {
  const graded = rows.filter((r) => startedAtOf(r) && Array.isArray(r.evaluation?.results) && r.evaluation.results.length);
  const out = new Map(graded.map((r) => [r.id, new Map()]));
  if (!graded.length) return out;
  const ids = graded.map((r) => r.id);
  const [questions, keys] = await Promise.all([
    supabase.from('assessments').select('id, questions').in('id', ids),
    supabase.from('assessment_keys').select('assessment_id, answer_key').in('assessment_id', ids),
  ]);
  if (questions.error) throw dbFailure('assessment questions lookup', questions.error);
  if (keys.error) throw dbFailure('recruiter detail lookup', keys.error);
  for (const q of questions.data || []) {
    const m = out.get(q.id);
    for (const item of Array.isArray(q.questions?.questions) ? q.questions.questions : []) {
      if (m && typeof item?.question_id === 'string') {
        m.set(item.question_id, { question: typeof item.question === 'string' ? item.question : null, recruiter_feedback: null });
      }
    }
  }
  for (const k of keys.data || []) {
    const m = out.get(k.assessment_id);
    const results = k.answer_key?.recruiter_results;
    for (const r of Array.isArray(results) ? results : []) {
      if (!m || typeof r?.question_id !== 'string') continue;
      const entry = m.get(r.question_id) || { question: null, recruiter_feedback: null };
      entry.recruiter_feedback = typeof r.recruiter_feedback === 'string' ? r.recruiter_feedback : null;
      m.set(r.question_id, entry);
    }
  }
  return out;
}

/**
 * GET /api/recruiter/applications/:id
 *   200 { ...list item,
 *         explanation: the newest score's stored explanation (factors, weights,
 *                      evidence, skill_evidence, github_account, flags, ...) | null,
 *         weights: the newest score's stored weights | null,
 *         score_history: [score summary, ...] every row for this candidate and job,
 *                        newest first,
 *         assessment: { ...list block, unproctored_note,
 *                       items: [every attempt, oldest first, voided ones included:
 *                               assessment.controller.js recruiterAttempt fields, with
 *                               each result carrying `question` and `recruiter_feedback`] },
 *         notes: { github_ownership, unproctored_assessment } }
 *   400 invalid_application_id · 404 not_found (no such application, or not this
 *   recruiter's) · 500
 */
export const getRecruiterApplication = async (req, res) => {
  try {
    const applicationId = req.params.id;
    if (!isUuid(applicationId)) {
      return res.status(400).json({ error: 'invalid_application_id', message: 'The application id must be a UUID.' });
    }
    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id, candidate_id, job_id, status, submitted_at, job:jobs!inner(id, title, recruiter_id)')
      .eq('id', applicationId)
      .maybeSingle();
    if (appError) throw dbFailure('application lookup', appError);
    if (!app || !app.job || app.job.recruiter_id !== req.session.userId) return applicationNotFound(res);

    const { candidate_id: candidateId, job_id: jobId } = app;
    const [identities, scoreResult, rows] = await Promise.all([
      loadApplicantIdentities(supabase, [candidateId]),
      supabase.from('scores').select(`${SCORE_COLUMNS}, explanation`)
        .eq('candidate_id', candidateId).eq('job_id', jobId)
        .order('created_at', { ascending: false }),
      loadAttempts(candidateId, jobId),
    ]);
    if (scoreResult.error) throw dbFailure('application scores', scoreResult.error);
    const history = [...(scoreResult.data || [])].sort(newestFirst);
    const newest = history[0] || null;
    const skillsByResume = await loadResumeSkills(history.map((r) => r.resume_id));

    const { s, view, summary } = await assessmentSummary(req, { candidateId, jobId, rows });
    const detail = await loadRecruiterDetail(rows);
    // The open, started row was just settled by candidateView: present it as that read did.
    const phaseOf = (row) => (row === s.open && startedAtOf(row)
      ? (view.state === 'in_progress' ? 'open' : 'submitted')
      : attemptPhase(row));
    const items = [...rows]
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
      .map((row) => {
        const item = recruiterAttempt(row, phaseOf(row), s.scoreOfRecord?.assessmentId ?? null);
        const perQuestion = detail.get(row.id) || new Map();
        return {
          ...item,
          results: item.results.map((r) => ({
            ...r,
            question: perQuestion.get(r.question_id)?.question ?? null,
            recruiter_feedback: perQuestion.get(r.question_id)?.recruiter_feedback ?? null,
          })),
        };
      });

    const base = applicationItem({
      app,
      job: app.job,
      identity: identities.get(candidateId),
      newest,
      skillsByResume,
      assessment: summary,
    });
    return res.json({
      ...base,
      explanation: newest?.explanation ?? null,
      weights: newest?.weights ?? null,
      score_history: history.map((row) => scoreSummary(row, skillsByResume)),
      assessment: { ...summary, unproctored_note: UNPROCTORED_NOTE, items },
      notes: { github_ownership: GITHUB_OWNERSHIP_NOTE, unproctored_assessment: UNPROCTORED_NOTE },
    });
  } catch (err) {
    return recruiterReadFailed(req, res, err, 'recruiter applications: detail');
  }
};
