import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';

import supabase from '../Config/supabase.js';
import { buildScoreRecord, SUBSCORE_KEYS } from '../Services/explainability.js';

const upload = multer({ storage: multer.memoryStorage() });

const NLP_PARSE_URL = process.env.NLP_PARSE_URL || 'http://localhost:8000/parse';
const PARSER_VERSION = 'nlp-engine@1.0.0';

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

export const analyzeResume = [
  upload.single('resume'),
  async (req, res) => {
    try {
      const candidateId = req.session.userId;
      const { jobId } = req.body || {};
      if (!req.file) {
        return res.status(400).json({ message: 'Resume file is required (field name: resume)' });
      }
      if (!jobId) {
        return res.status(400).json({ message: 'jobId is required' });
      }

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id, title, description, experience_level, location')
        .eq('id', String(jobId))
        .eq('status', 'published')
        .maybeSingle();
      if (jobError || !job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // FastAPI expects: resume (UploadFile) + jd (Form)
      const form = new FormData();
      form.append('resume', req.file.buffer, req.file.originalname);
      form.append('jd', job.description);

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
            contentType: req.file.mimetype || 'application/octet-stream',
            upsert: false,
          });
        if (uploadError) {
          console.error('Resume file upload failed:', uploadError.message);
        } else {
          fileRef = objectPath;
        }
      } catch (uploadErr) {
        console.error('Resume file upload threw:', uploadErr?.message || uploadErr);
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
        return res
          .status(500)
          .json({ message: 'Failed to persist parsed resume', error: resumeError.message });
      }

      const score = buildScoreRecord(nlpJson);
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
        return res
          .status(500)
          .json({ message: 'Failed to persist score', error: scoreError.message });
      }

      return res.json(
        serializeCandidate({ score: scoreRow, resume: resumeRow, job, profile: null })
      );
    } catch (err) {
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
