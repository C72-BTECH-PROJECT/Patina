import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';

import supabase from '../Config/supabase.js';
import { buildScoreRecord, SUBSCORE_KEYS } from '../Services/explainability.js';
import { fetchGithubEvidence } from '../Services/githubEvidence.js';

const upload = multer({ storage: multer.memoryStorage() });

// Same rule as github-evidence (github-evidence/README.md): an incoming ID is
// kept only if it is this shape, otherwise core generates one.
const REQUEST_ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const resolveRequestId = (req) => {
  const incoming = req.get('X-Request-ID');
  return incoming && REQUEST_ID_RE.test(incoming) ? incoming : crypto.randomUUID();
};

const NLP_PARSE_URL = process.env.NLP_PARSE_URL || 'http://localhost:8000/parse';
const PARSER_VERSION = 'nlp-engine@1.0.0';

// The `resumes` storage bucket is created with an `allowed_mime_types`
// allow-list (application/pdf + the DOCX type). Browsers and multer frequently
// report an upload part as `application/octet-stream` — for DOCX especially, and
// for PDFs on some OS/browser combos — which the bucket then rejects with a 415.
// Trust the file extension first so the common case actually stores the file.
const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const resolveContentType = (file) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  if (file.mimetype && file.mimetype !== 'application/octet-stream') return file.mimetype;
  return 'application/octet-stream';
};

// Supabase hands back two different error shapes: a PostgrestError
// (`code`/`message`/`details`/`hint`) from the database, and a StorageApiError
// (`name`/`status`/`statusCode`/`message`) from storage. The bare `.message`
// drops the code and hint, which are exactly what makes a failure diagnosable.
const describeSupabaseError = (error) => {
  if (!error) return 'unknown error';
  const parts = [];
  const code = error.code ?? error.statusCode;
  if (code != null) parts.push(`code=${code}`);
  if (error.status != null) parts.push(`status=${error.status}`);
  if (error.message) parts.push(`message=${error.message}`);
  if (error.details) parts.push(`details=${error.details}`);
  if (error.hint) parts.push(`hint=${error.hint}`);
  return parts.join(' | ') || String(error);
};

const isRlsError = (error) =>
  error?.code === '42501' || /row-level security/i.test(error?.message || '');

const RLS_HINT =
  'Postgres row-level security rejected this write. The backend must talk to Supabase with the ' +
  'service-role key: check SUPABASE_SERVICE_ROLE_KEY in backend/.env (it must decode to role ' +
  '"service_role") and restart the server. If the key is correct, confirm the migration ' +
  'supabase/migrations/20260903_create_resumes_and_scores.sql has been applied to this project.';

const logPersistenceError = (context, error) => {
  console.error(`[analyze] ${context} failed: ${describeSupabaseError(error)}`);
  if (isRlsError(error)) console.error(`[analyze] ${RLS_HINT}`);
};

// Shape a persisted score (+ its resume, job and candidate profile) into the
// object the recruiter dashboard and candidate view consume.
//
// Top-level keys are camelCase. `subScores` and `explanation` are handed over
// exactly as they were persisted (snake_case inside) — the dashboard renders
// the stored audit record rather than a re-derived copy of it, which is what
// makes the drill-down auditable (CHECKLIST 4.11 / 5.8). The per-source
// `*Score` fields are the stable interface for the candidate-facing result
// tiles: null means "that engine produced no evidence", never zero.
const serializeCandidate = ({ score, resume, job, profile }) => {
  const contact = resume?.contact || {};
  const skills = Array.isArray(resume?.skills) ? resume.skills : [];
  const profileName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : '';
  const subScores = score?.subscores || {};
  const explanation = score?.explanation || null;
  const subScoreValue = (key) =>
    subScores[key]?.available ? Number(subScores[key].value) : null;

  return {
    id: score.id,
    resumeId: resume?.id ?? null,
    candidateId: score.candidate_id,
    jobId: score.job_id,
    jobTitle: job?.title ?? null,
    candidate: {
      name: profileName || contact.candidate_name || 'Candidate',
      location: job?.location || '—',
      email: contact.email || '',
      phone: contact.phone || '',
      github: contact.github || '',
      linkedin: contact.linkedin || '',
    },
    extractedSkills: skills,
    experience: Array.isArray(resume?.experience) ? resume.experience : [],
    education: Array.isArray(resume?.education) ? resume.education : [],
    projects: Array.isArray(resume?.projects) ? resume.projects : [],
    credibilityScore: Number(score.composite_score),
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

// Removes every other resume file from the candidate's folder, keeping only
// the one just uploaded. This guarantees each profile has exactly one resume
// even when the new file has a different extension than the old one.
const pruneOldResumes = async (userId, keepName) => {
  const { data: files } = await supabase.storage
    .from('resumes')
    .list(`candidates/${userId}`, { limit: 100 });

  const stale = (Array.isArray(files) ? files : [])
    .map((f) => f.name)
    .filter((name) => name !== keepName);

  if (stale.length === 0) return;

  const { error } = await supabase.storage
    .from('resumes')
    .remove(stale.map((name) => `candidates/${userId}/${name}`));

  if (error) console.error('Old resume cleanup failed:', error.message);
};

// Persist a candidate's resume to Supabase Storage ("resumes" bucket) so the
// Apply action can later verify the candidate actually uploaded one. The resume
// is saved once per candidate (upsert), reused for every job they apply to.
const saveResumeToStorage = async (userId, file) => {
  const ext = path.extname(file.originalname || '') || '.pdf';
  const storagePath = `candidates/${userId}/resume${ext}`;

  const { error } = await supabase.storage
    .from('resumes')
    .upload(storagePath, file.buffer, {
      contentType: resolveContentType(file),
      upsert: true,
    });

  if (error) {
    console.error(
      'Resume storage upload failed:',
      JSON.stringify({ message: error.message, status: error.status ?? null, path: storagePath })
    );
    return false;
  }

  // Only after the new resume is safely stored, delete the old one(s).
  await pruneOldResumes(userId, `resume${ext}`);
  return true;
};

// Returns whether the current candidate has a resume in Supabase Storage.
export const getMyResumeStatus = async (req, res) => {
  const { data: files, error } = await supabase.storage
    .from('resumes')
    .list(`candidates/${req.session.userId}`, { limit: 100 });

  // A storage outage must not read as "no resume uploaded".
  if (error) {
    logPersistenceError('resume status storage list', error);
    return res.status(500).json({ message: 'Could not check your resume. Please try again.' });
  }

  const resumeFile = Array.isArray(files)
    ? files.find((f) => f.name.startsWith('resume'))
    : null;

  return res.json({
    hasResume: Boolean(resumeFile),
    fileName: resumeFile?.name || null,
    updatedAt: resumeFile?.updated_at || null,
  });
};

// Generates a signed URL for a candidate's resume. Intended for recruiters
// reviewing applicants; the frontend opens this URL in a new tab.
export const getCandidateResume = async (req, res) => {
  try {
    const { candidateId } = req.params;

    const { data: files } = await supabase.storage
      .from('resumes')
      .list(`candidates/${candidateId}`, { limit: 100 });

    const resumeFile = Array.isArray(files)
      ? files.find((f) => f.name.startsWith('resume'))
      : null;

    if (!resumeFile) {
      return res.status(404).json({ message: 'No resume found for this candidate.' });
    }

    const storagePath = `candidates/${candidateId}/${resumeFile.name}`;
    const { data: signed, error: signedError } = await supabase.storage
      .from('resumes')
      .createSignedUrl(storagePath, 60);

    if (signedError || !signed?.signedUrl) {
      return res.status(500).json({ message: 'Could not generate resume link.' });
    }

    return res.json({ url: signed.signedUrl, fileName: resumeFile.name });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load resume', error: String(err?.message || err) });
  }
};

// Dedicated endpoint for uploading / replacing the candidate's single resume.
// Each candidate profile has exactly one resume, stored at a fixed path, so a
// re-upload simply overwrites the previous one (upsert).
export const uploadResume = [
  upload.single('resume'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No resume file uploaded' });
      }

      // The extension decides: it is also what the stored path and content type
      // are derived from, and the client-reported mimetype is unreliable.
      const ext = path.extname(req.file.originalname || '').toLowerCase();
      if (!MIME_BY_EXT[ext]) {
        return res.status(400).json({ message: 'Only PDF or DOCX resumes are supported.' });
      }

      const saved = await saveResumeToStorage(req.session.userId, req.file);
      if (!saved) {
        return res.status(500).json({ message: 'Could not save your resume. Please try again.' });
      }

      return res.status(200).json({
        message: 'Resume uploaded successfully',
        fileName: req.file.originalname,
        size: req.file.size,
      });
    } catch (error) {
      console.error('Resume upload failed:', error.message);
      return res.status(500).json({ message: 'Could not upload your resume.' });
    }
  },
];

export const analyzeResume = [
  upload.single('resume'),
  async (req, res) => {
    try {
      const candidateId = req.session.userId;
      const requestId = resolveRequestId(req);
      console.log(`[analyze] request_id=${requestId}`);
      const { jobId } = req.body || {};
      if (!req.file) {
        return res.status(400).json({ message: 'Resume file is required (field name: resume)' });
      }
      if (!jobId) {
        return res.status(400).json({ message: 'jobId is required' });
      }

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id, title, description, required_skills, preferred_skills, experience_level, location')
        .eq('id', String(jobId))
        .eq('status', 'published')
        .maybeSingle();
      if (jobError || !job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // FastAPI expects: resume (UploadFile) + jd (Form). The stored job is the
      // sole authoritative JD — a candidate-supplied description is never sent.
      // The structured skill lists are the primary job-skill source; `jd` (the
      // markdown description) is only the text for semantic similarity.
      const form = new FormData();
      form.append('resume', req.file.buffer, req.file.originalname);
      form.append('jd', job.description);
      form.append('required_skills', JSON.stringify(job.required_skills ?? []));
      form.append('preferred_skills', JSON.stringify(job.preferred_skills ?? []));

      const response = await fetch(NLP_PARSE_URL, { method: 'POST', body: form });
      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        return res.status(502).json({
          message: 'NLP parsing failed',
          error: `FastAPI error: ${response.status} ${txt}`,
        });
      }
      const nlpJson = await response.json();

      // Persist the raw upload. A storage outage must not fail the pipeline —
      // the file reference is nullable and the parse result is still saved.
      let fileRef = null;
      try {
        const objectPath = `${candidateId}/${crypto.randomUUID()}${path.extname(req.file.originalname) || ''}`;
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(objectPath, req.file.buffer, {
            contentType: resolveContentType(req.file),
            upsert: false,
          });
        if (uploadError) {
          logPersistenceError('resume file storage upload', uploadError);
        } else {
          fileRef = objectPath;
        }
      } catch (uploadErr) {
        console.error('[analyze] resume file storage upload threw:', uploadErr);
      }

      const entities = nlpJson?.entities || {};
      const contact = {
        candidate_name: entities.candidate_name || null,
        email: entities.email || null,
        phone: entities.phone || null,
        github: entities.github || null,
        linkedin: entities.linkedin || null,
      };
      const skills = Array.isArray(entities.skills) ? entities.skills : [];
      const projectLinks = [entities.github, entities.linkedin].filter(Boolean);

      const { data: resumeRow, error: resumeError } = await supabase
        .from('resumes')
        .insert({
          candidate_id: candidateId,
          job_id: job.id,
          file_name: req.file.originalname,
          file_ref: fileRef,
          raw_text_preview: nlpJson?.raw_text_preview || null,
          contact,
          skills,
          experience: Array.isArray(entities.experience) ? entities.experience : [],
          education: Array.isArray(entities.education) ? entities.education : [],
          projects: Array.isArray(entities.projects) ? entities.projects : [],
          project_links: projectLinks,
          parser_version: PARSER_VERSION,
        })
        .select()
        .single();
      if (resumeError) {
        logPersistenceError('resumes insert', resumeError);
        return res.status(500).json({
          message: 'Failed to persist parsed resume',
          error: resumeError.message,
          code: resumeError.code ?? null,
        });
      }

      // GitHub evidence (GF-4: optional). Never throws: any failure comes back as
      // a reason code and the score is still produced from the other sources.
      const github = await fetchGithubEvidence({ githubLink: entities.github, claimedSkills: skills, requestId });
      console.log(`[analyze] request_id=${requestId} github=${github.ok ? 'ok' : github.reasonCode}`);

      // Fold in a completed assessment when one exists (CHECKLIST 3.7 /
      // T-0025). Guarded so analysis still works before the assessments
      // table exists.
      let assessmentEvaluation = null;
      try {
        const { data: completed } = await supabase
          .from('assessments')
          .select('evaluation')
          .eq('candidate_id', candidateId)
          .eq('job_id', job.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        assessmentEvaluation = completed?.evaluation ?? null;
      } catch (assessErr) {
        console.warn('[analysis] assessment lookup skipped:', assessErr?.message);
      }

      const score = buildScoreRecord(nlpJson, { github, assessmentEvaluation });
      const { data: scoreRow, error: scoreError } = await supabase
        .from('scores')
        .insert({
          resume_id: resumeRow.id,
          candidate_id: candidateId,
          job_id: job.id,
          composite_score: score.composite,
          subscores: score.subscores,
          weights: score.weights,
          explanation: score.explanation,
          evidence_limited: score.evidence_limited,
        })
        .select()
        .single();
      if (scoreError) {
        logPersistenceError('scores insert', scoreError);
        return res.status(500).json({
          message: 'Failed to persist score',
          error: scoreError.message,
          code: scoreError.code ?? null,
        });
      }

      return res.json(
        serializeCandidate({ score: scoreRow, resume: resumeRow, job, profile: null })
      );
    } catch (err) {
      console.error('[analyze] unhandled failure:', err);
      return res.status(500).json({ message: 'Analyze failed', error: String(err?.message || err) });
    }
  },
];

export const getCandidateAnalysis = async (req, res) => {
  try {
    const candidateId = req.session.userId;
    const { data: score, error } = await supabase
      .from('scores')
      .select('*, resume:resumes(*), job:jobs(title, location)')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return res.status(500).json({ message: 'Failed to load analysis', error: error.message });
    }
    if (!score) {
      return res.status(404).json({ message: 'No analysis yet. Upload a resume first.' });
    }
    return res.json(
      serializeCandidate({ score, resume: score.resume, job: score.job, profile: null })
    );
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'Failed to load analysis', error: String(err?.message || err) });
  }
};

export const getAllCandidates = async (req, res) => {
  try {
    const recruiterId = req.session.userId;

    const { data: jobRows, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, location')
      .eq('recruiter_id', recruiterId);
    if (jobsError) {
      return res.status(500).json({ message: 'Failed to load jobs', error: jobsError.message });
    }
    if (!jobRows?.length) {
      return res.json([]);
    }

    const jobsById = new Map(jobRows.map((j) => [j.id, j]));
    const { data: scoreRows, error: scoresError } = await supabase
      .from('scores')
      .select('*, resume:resumes(*, profile:profiles(first_name, last_name))')
      .in('job_id', jobRows.map((j) => j.id))
      .order('created_at', { ascending: false });
    if (scoresError) {
      return res
        .status(500)
        .json({ message: 'Failed to load candidate scores', error: scoresError.message });
    }

    // One row per candidate (their most recent score), ranked by composite.
    const latestByCandidate = new Map();
    for (const row of scoreRows || []) {
      if (!latestByCandidate.has(row.candidate_id)) {
        latestByCandidate.set(row.candidate_id, row);
      }
    }

    const candidates = [...latestByCandidate.values()]
      .sort((a, b) => Number(b.composite_score) - Number(a.composite_score))
      .map((row) =>
        serializeCandidate({
          score: row,
          resume: row.resume,
          job: jobsById.get(row.job_id),
          profile: row.resume?.profile,
        })
      );

    return res.json(candidates);
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'Failed to load candidates', error: String(err?.message || err) });
  }
};

export const getAllApplicants = async (req, res) => {
  try {
    const recruiterId = req.session.userId;

    const { data: jobRows, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, location')
      .eq('recruiter_id', recruiterId);
    if (jobsError) {
      return res.status(500).json({ message: 'Failed to load jobs', error: jobsError.message });
    }
    if (!jobRows?.length) {
      return res.json([]);
    }

    const { data: applicationRows, error: applicationsError } = await supabase
      .from('applications')
      .select('id, candidate_id, job_id, status, submitted_at')
      .in('job_id', jobRows.map((j) => j.id))
      .order('submitted_at', { ascending: false });

    if (applicationsError) {
      return res.status(500).json({ message: 'Failed to load applications', error: applicationsError.message });
    }

    const jobsById = new Map(jobRows.map((j) => [j.id, j]));

    // One query for every applicant's name. `profiles` has no email column.
    const candidateIds = [...new Set((applicationRows || []).map((app) => app.candidate_id))];
    const { data: profileRows, error: profilesError } = candidateIds.length
      ? await supabase.from('profiles').select('id, first_name, last_name').in('id', candidateIds)
      : { data: [], error: null };
    if (profilesError) {
      return res.status(500).json({ message: 'Failed to load applicant profiles', error: profilesError.message });
    }
    const profilesById = new Map((profileRows || []).map((p) => [p.id, p]));

    const enriched = await Promise.all((applicationRows || []).map(async (app) => {
      const profile = profilesById.get(app.candidate_id) || null;
      let authUser = null;

      // Only a candidate without a profile row falls back to the auth record.
      if (!profile) {
        try {
          const authResult = await supabase.auth.admin.getUserById(app.candidate_id);
          authUser = authResult.data?.user;
        } catch (e) {
          authUser = null;
        }
      }

      const meta = authUser?.user_metadata || authUser?.raw_user_meta_data || {};
      const firstName = profile?.first_name || meta.first_name || '';
      const lastName = profile?.last_name || meta.last_name || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Candidate';
      const email = authUser?.email || meta.email || '';
      const location = jobsById.get(app.job_id)?.location || '—';

      // A candidate can be analysed more than once for the same job; the most
      // recent score is the current one.
      const { data: scoreRow } = await supabase
        .from('scores')
        .select('composite_score')
        .eq('candidate_id', app.candidate_id)
        .eq('job_id', app.job_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        id: app.id,
        candidateId: app.candidate_id,
        jobId: app.job_id,
        jobTitle: jobsById.get(app.job_id)?.title || 'Unknown Job',
        candidateInfo: {
          name: fullName,
          email,
          location,
        },
        // null means "not scored yet", never a score of 0.
        credibilityScore: scoreRow ? Number(scoreRow.composite_score) : null,
        skills: [],
        status: app.status,
        applicationId: app.id,
        appliedAt: app.submitted_at,
      };
    }));

    return res.json(enriched);
  } catch (err) {
    console.error('getAllApplicants failed:', err);
    return res.status(500).json({ message: 'Failed to load applicants', error: String(err?.message || err) });
  }
};
