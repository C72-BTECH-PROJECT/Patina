import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';
import path from 'path';

import supabase from '../Config/supabase.js';

const upload = multer({ storage: multer.memoryStorage() });

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
      contentType: file.mimetype || 'application/pdf',
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
  const { data: files } = await supabase.storage
    .from('resumes')
    .list(`candidates/${req.session.userId}`, { limit: 100 });

  const resumeFile = Array.isArray(files)
    ? files.find((f) => f.name.startsWith('resume'))
    : null;

  return res.json({
    hasResume: Boolean(resumeFile),
    fileName: resumeFile?.name || null,
    updatedAt: resumeFile?.updated_at || null,
  });
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

      const isPdf =
        req.file.mimetype === 'application/pdf' ||
        (req.file.originalname || '').toLowerCase().endsWith('.pdf');
      const isDocx =
        req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        (req.file.originalname || '').toLowerCase().endsWith('.docx');

      if (!isPdf && !isDocx) {
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

// In-memory array to store all candidate analyses for the Recruiter Dashboard
export const allAnalyses = [];
let latestAnalysis = null;
let latestJob = null;

const safeMatchLevel = (semanticSimilarity) => {
  if (semanticSimilarity >= 0.75) return 'High';
  if (semanticSimilarity >= 0.45) return 'Medium';
  return 'Low';
};

export const analyzeResume = [upload.single('resume'), async (req, res) => {
  try {
    const { jobId } = req.body || {};
    if (!req.file) {
      return res.status(400).json({ message: 'Resume file is required (field name: resume)' });
    }
    if (!jobId) {
      return res.status(400).json({ message: 'jobId is required' });
    }

    // Persist the resume to Supabase Storage (upload-once, reuse for every job).
    await saveResumeToStorage(req.session.userId, req.file);

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, description, experience_level, location')
      .eq('id', String(jobId))
      .eq('status', 'published')
      .maybeSingle();
    if (jobError || !job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    latestJob = job;

    // FastAPI expects: resume (UploadFile) + jd (Form)
    const form = new FormData();
    form.append('resume', req.file.buffer, req.file.originalname);

    // IMPORTANT: nlp-engine/app/main.py expects `jd`
    form.append('jd', job.description);

    const response = await fetch('http://localhost:8000/parse', {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      return res.status(502).json({ message: 'NLP parsing failed', error: `FastAPI error: ${response.status} ${txt}` });
    }

    const nlpJson = await response.json();

    // Map FastAPI response schema to what frontend expects
    // FastAPI returns:
    // - entities.skills
    // - entities.projects
    // - semantic_analysis.similarity_score
    // - semantic_analysis.match_level
    const semanticSimilarity = Math.max(
      0,
      Math.min(1, Number(nlpJson?.semantic_analysis?.similarity_score ?? 0) || 0)
    );
    const match_level = nlpJson?.semantic_analysis?.match_level ?? safeMatchLevel(semanticSimilarity);

    const extractedSkills = Array.isArray(nlpJson?.entities?.skills) ? nlpJson.entities.skills : [];
    const projects = Array.isArray(nlpJson?.entities?.projects) ? nlpJson.entities.projects : [];
    
    // Get newly extracted fields
    const email = nlpJson?.entities?.email || '';
    const phone = nlpJson?.entities?.phone || '';
    const github = nlpJson?.entities?.github || '';
    const linkedin = nlpJson?.entities?.linkedin || '';

    // GitHub verification is a later microservice. NLP extraction alone must
    // never label a skill as externally verified.
    const verifiedSkills = extractedSkills.map((s) => {
      return {
        name: s,
        verified: false,
        level: 'Unverified',
      };
    });

    // Interim score: 100% NLP semantic similarity. GitHub and assessment
    // weights are intentionally added only when those services exist.
    const credibilityScore = Math.round(semanticSimilarity * 100);

    const candidateNameFromFilename = (req.file.originalname || '')
      .replace(/\.[^/.]+$/, '')
      .trim();

    latestAnalysis = {
      id: `cand-${Date.now()}`,
      candidate: {
        name: candidateNameFromFilename || 'Candidate',
        location: latestJob?.location || '—',
        email,
        phone,
        github,
        linkedin
      },
      jobId: latestJob?.id,
      jobTitle: latestJob?.title,
      matchPercentage: Math.round(semanticSimilarity * 100),
      extractedSkills,
      projects,
      semantic_similarity: semanticSimilarity,
      match_level,
      verifiedSkills,
      experienceLevel: job.experience_level,
      credibilityScore,
      raw_text_preview: nlpJson?.raw_text_preview,
      appliedAt: new Date().toISOString()
    };

    allAnalyses.push(latestAnalysis);

    return res.json(latestAnalysis);
  } catch (err) {
    return res.status(500).json({ message: 'Analyze failed', error: String(err?.message || err) });
  }
}];

export const getCandidateAnalysis = (req, res) => {
  if (!latestAnalysis) {
    return res.status(404).json({ message: 'No analysis yet. Upload a resume first.' });
  }

  // latestAnalysis already includes candidate (no more mock)
  return res.json({
    ...latestAnalysis,
  });
};

export const getAllCandidates = (req, res) => {
  return res.json(allAnalyses);
};

