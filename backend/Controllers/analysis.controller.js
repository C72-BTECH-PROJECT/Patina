import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';

import { jobs } from '../Config/Job.js';

const upload = multer({ storage: multer.memoryStorage() });

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

    const job = jobs.find((j) => String(j.id) === String(jobId) || String(j._id) === String(jobId));
    if (!job) {
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
    const semanticSimilarity = Number(nlpJson?.semantic_analysis?.similarity_score ?? 0);
    const match_level = nlpJson?.semantic_analysis?.match_level ?? safeMatchLevel(semanticSimilarity);

    const extractedSkills = Array.isArray(nlpJson?.entities?.skills) ? nlpJson.entities.skills : [];
    const projects = Array.isArray(nlpJson?.entities?.projects) ? nlpJson.entities.projects : [];

    // Keep existing “verified” heuristic for now, but it will now be based on real extracted skills
    const verifiedSkills = extractedSkills.map((s, idx) => ({
      name: s,
      verified: idx < 2,
      level: idx === 0 ? 'Advanced' : 'Intermediate',
    }));

    const credibilityScore = Math.max(
      20,
      Math.min(99, Math.round(semanticSimilarity * 100 * 0.85 + extractedSkills.length * 3))
    );

    const candidateNameFromFilename = (req.file.originalname || '')
      .replace(/\.[^/.]+$/, '')
      .trim();

    latestAnalysis = {
      candidate: {
        name: candidateNameFromFilename || 'Candidate',
        location: latestJob?.location || '—',
      },
      matchPercentage: Math.round(semanticSimilarity * 100),
      extractedSkills,
      projects,
      semantic_similarity: semanticSimilarity,
      match_level,
      verifiedSkills,
      experienceLevel: job.experienceLevel,
      credibilityScore,
      raw_text_preview: nlpJson?.raw_text_preview,
    };

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

