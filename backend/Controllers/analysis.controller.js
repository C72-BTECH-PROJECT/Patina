import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';

import supabase from '../Config/supabase.js';

const upload = multer({ storage: multer.memoryStorage() });

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

