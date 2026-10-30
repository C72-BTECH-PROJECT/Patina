import FormData from 'form-data';
import fetch from 'node-fetch';

import supabase from '../Config/supabase.js';
import { rebuildScoreRecord } from '../Services/explainability.js';

// Standalone generation service (T-0024/T-0025). The service holds the LLM
// key and mints the answer key; this proxy forwards the candidate/job
// context, persists the assessment row, and returns candidate questions
// only — the key never reaches the browser.
const ASSESSMENT_SERVICE_URL =
  process.env.ASSESSMENT_SERVICE_URL || 'http://localhost:8002';

// T-0026: the upload page stores the raw file without parsing it, so
// generate must be able to run the NLP parser on demand. Same endpoint and
// form contract as /api/analyze (analysis.controller.js).
const NLP_PARSE_URL = process.env.NLP_PARSE_URL || 'http://localhost:8000/parse';
const PARSER_VERSION = 'nlp-engine@1.0.0';
const RESUME_BUCKET = 'resumes';

const stripKey = (data) => {
  const { answer_key: _withheld, ...candidateView } = data;
  return candidateView;
};

// Download the candidate's stored resume file and parse it with the NLP
// service, then persist the result so every later quiz reads Supabase
// directly. A persistence failure must not block the quiz (the parse itself
// succeeded); a parse/download failure throws and is handled by the caller.
const parseStoredResume = async (candidateId, job, fileName) => {
  const objectPath = `candidates/${candidateId}/${fileName}`;
  const { data: blob, error: downloadError } = await supabase.storage
    .from(RESUME_BUCKET)
    .download(objectPath);
  if (downloadError || !blob) {
    throw new Error(`storage download failed: ${downloadError?.message || 'empty file'}`);
  }

  const form = new FormData();
  form.append('resume', Buffer.from(await blob.arrayBuffer()), fileName);
  form.append('jd', job.description ?? '');
  form.append('required_skills', JSON.stringify(job.required_skills ?? []));
  form.append('preferred_skills', JSON.stringify(job.preferred_skills ?? []));

  const nlpResponse = await fetch(NLP_PARSE_URL, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  if (!nlpResponse.ok) {
    const detail = await nlpResponse.text().catch(() => '');
    throw new Error(`NLP ${nlpResponse.status}: ${detail.slice(0, 200)}`);
  }
  const nlpJson = await nlpResponse.json();
  const entities = nlpJson?.entities || {};
  const parsed = {
    skills: Array.isArray(entities.skills) ? entities.skills : [],
    experience: Array.isArray(entities.experience) ? entities.experience : [],
    education: Array.isArray(entities.education) ? entities.education : [],
    projects: Array.isArray(entities.projects) ? entities.projects : [],
    raw_text_preview: nlpJson?.raw_text_preview || null,
  };

  try {
    const { error: insertError } = await supabase.from('resumes').insert({
      candidate_id: candidateId,
      job_id: job.id,
      file_name: fileName,
      file_ref: objectPath,
      raw_text_preview: parsed.raw_text_preview,
      contact: {
        candidate_name: entities.candidate_name || null,
        email: entities.email || null,
        phone: entities.phone || null,
        github: entities.github || null,
        linkedin: entities.linkedin || null,
      },
      skills: parsed.skills,
      experience: parsed.experience,
      education: parsed.education,
      projects: parsed.projects,
      project_links: [entities.github, entities.linkedin].filter(Boolean),
      parser_version: PARSER_VERSION,
    });
    if (insertError) {
      console.error('[assessment] on-demand resume parse not persisted:', insertError.message);
    } else {
      console.log(`[assessment] parsed stored resume on demand for candidate=${candidateId} file=${fileName}`);
    }
  } catch (insertErr) {
    console.error('[assessment] on-demand resume insert threw:', insertErr?.message);
  }
  return parsed;
};

// Resolve the resume text for assessment generation from Supabase: the
// latest stored parse result, parsed on demand from the uploaded file when
// there is none yet (or the file was updated after it). Returns
// { resume, resumeText } on success or { error: { status, message } }.
const resolveResumeForAssessment = async (candidateId, job) => {
  const { data: row, error: resumeError } = await supabase
    .from('resumes')
    .select('skills, experience, projects, raw_text_preview, created_at')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (resumeError) {
    return { error: { status: 500, message: 'Failed to load your resume' } };
  }

  let resume = row;
  let resumeText = (row?.raw_text_preview || '').trim();

  const { data: files, error: listError } = await supabase.storage
    .from(RESUME_BUCKET)
    .list(`candidates/${candidateId}`, { limit: 20 });
  const storedFile = Array.isArray(files) ? files.find((f) => (f.name || '').startsWith('resume')) : null;
  const fileIsNewer = Boolean(storedFile)
    && (!row?.created_at || new Date(storedFile.updated_at || 0) > new Date(row.created_at));

  if (storedFile && (!resumeText || fileIsNewer)) {
    try {
      resume = await parseStoredResume(candidateId, job, storedFile.name);
      resumeText = (resume.raw_text_preview || '').trim();
    } catch (parseErr) {
      if (resumeText) {
        // A stale stored parse still beats blocking the candidate.
        console.warn('[assessment] on-demand resume parse failed; using stored result:', parseErr.message);
      } else {
        console.error('[assessment] on-demand resume parse failed:', parseErr.message);
        return {
          error: {
            status: 502,
            message: 'Could not read your resume — start the NLP parser service (port 8000) and try again.',
          },
        };
      }
    }
  }

  if (!resumeText) {
    if (listError) {
      return { error: { status: 500, message: 'Failed to check your resume. Please try again.' } };
    }
    return { error: { status: 400, message: 'Upload a resume first — assessments are generated from it.' } };
  }
  return { resume, resumeText: resumeText.slice(0, 20000) };
};

/**
 * POST /api/assessment/generate  { jobId }
 *
 * Builds the AssessmentInput from the stored job + the candidate's latest
 * resume, forwards it to the assessment service, and persists the result.
 *
 * One assessment per candidate per job (T-0025 scope):
 * - a completed attempt answers with 409 + the stored score;
 * - an open ('generated') attempt is resumed: its stored questions are
 *   returned instead of burning a new LLM generation.
 */
export const generateAssessment = async (req, res) => {
  try {
    const candidateId = req.session.userId;
    const { jobId } = req.body || {};
    if (!jobId) {
      return res.status(400).json({ message: 'jobId is required' });
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, description, required_skills, preferred_skills, experience_level')
      .eq('id', String(jobId))
      .eq('status', 'published')
      .maybeSingle();
    if (jobError || !job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // T-0027: up to 5 attempts per candidate per job. An open attempt is
    // always resumed; a new one may be generated while fewer than 5 are
    // completed. The credibility score folds in the LATEST attempt.
    const { data: openAttempt, error: openError } = await supabase
      .from('assessments')
      .select('id, questions')
      .eq('candidate_id', candidateId)
      .eq('job_id', job.id)
      .eq('status', 'generated')
      .maybeSingle();
    if (openError) {
      return res.status(500).json({ message: 'Failed to load your assessment attempt', error: openError.message });
    }
    if (openAttempt) {
      // Resume the open attempt rather than regenerating.
      console.log(`[assessment] resume open attempt ${openAttempt.id} for candidate=${candidateId} job=${job.id}`);
      return res.json({ assessmentId: openAttempt.id, ...openAttempt.questions });
    }

    const MAX_ATTEMPTS = 5;
    const { data: completed, error: completedError } = await supabase
      .from('assessments')
      .select('id, score, completed_at')
      .eq('candidate_id', candidateId)
      .eq('job_id', job.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });
    if (completedError) {
      return res.status(500).json({ message: 'Failed to load your attempts', error: completedError.message });
    }
    if (completed.length >= MAX_ATTEMPTS) {
      const latest = completed[0];
      return res.status(409).json({
        message: `You have used all ${MAX_ATTEMPTS} attempts for this assessment.`,
        assessmentId: latest.id,
        score: Number(latest.score),
        attempts_used: completed.length,
        max_attempts: MAX_ATTEMPTS,
      });
    }

    const resolved = await resolveResumeForAssessment(candidateId, job);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ message: resolved.error.message });
    }
    const { resume, resumeText } = resolved;

    const payload = {
      candidate_id: String(candidateId),
      job_id: String(job.id),
      job_title: job.title,
      job_description: job.description,
      required_skills: job.required_skills ?? [],
      preferred_skills: job.preferred_skills ?? [],
      resume_text: resumeText,
      resume_skills: Array.isArray(resume?.skills) ? resume.skills : [],
      resume_projects: Array.isArray(resume?.projects) ? resume.projects : [],
      experience_level: job.experience_level ?? 'unspecified',
    };

    let response;
    try {
      response = await fetch(`${ASSESSMENT_SERVICE_URL}/generate-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // T-0027: free-tier LLM needs 2-4 min; the old 120 s abort cut slow
        // generations with a misleading 502.
        signal: AbortSignal.timeout(300000),
      });
    } catch {
      return res.status(502).json({
        message: 'Assessment service is unavailable. Start it (assessment-service) and try again.',
      });
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return res.status(502).json({
        message: 'Assessment generation failed',
        error: detail.slice(0, 500),
      });
    }

    // The service wraps the payload: questions = { assessment_id,
    // model_used, prompt_version, questions: [...] }, answer_key =
    // { assessment_id, answers: [...] }.
    const data = await response.json();
    const questionBundle = data.questions || {};
    const answerBundle = data.answer_key || {};
    const assessmentId = questionBundle.assessment_id;

    if (!assessmentId || !Array.isArray(questionBundle.questions) || !Array.isArray(answerBundle.answers)) {
      console.error('[assessment] malformed service payload:', Object.keys(data));
      return res.status(502).json({ message: 'Assessment service returned an unexpected payload. Please retry.' });
    }

    // Persist so the answer key is available at submit time (T-0025). If the
    // insert races another attempt, fall back to the stored open row.
    const { data: inserted, error: insertError } = await supabase
      .from('assessments')
      .insert({
        id: assessmentId,
        candidate_id: candidateId,
        job_id: job.id,
        questions: questionBundle,
        answer_key: answerBundle,
        model_used: questionBundle.model_used ?? null,
        prompt_version: questionBundle.prompt_version ?? null,
        status: 'generated',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[assessment] insert failed:', insertError.message);
      const { data: stored } = await supabase
        .from('assessments')
        .select('id, questions')
        .eq('candidate_id', candidateId)
        .eq('job_id', job.id)
        .eq('status', 'generated')
        .maybeSingle();
      if (stored) {
        return res.json({ assessmentId: stored.id, ...stored.questions });
      }
      return res.status(500).json({
        message: 'Assessment generated but could not be saved. Please retry.',
        error: insertError.message,
      });
    }

    console.log(`[assessment] generated ${inserted.id} model=${questionBundle.model_used ?? 'unknown'}`);
    return res.json({ assessmentId: inserted.id, ...stripKey(data) });
  } catch (err) {
    console.error('[assessment] unhandled failure:', err);
    return res.status(500).json({ message: 'Assessment generation failed', error: String(err?.message || err) });
  }
};

/**
 * POST /api/assessment/evaluate  { assessmentId, answers: [{question_id, response}] }
 *
 * Loads the stored questions + answer key, scores them server-side in the
 * assessment service (MCQs deterministic, short answers rubric-graded),
 * persists the result, and folds it into the candidate's latest credibility
 * score so the recruiter dashboard shows the assessment pillar.
 */
export const evaluateAssessment = async (req, res) => {
  try {
    const candidateId = req.session.userId;
    const { assessmentId, answers } = req.body || {};

    if (!assessmentId || typeof assessmentId !== 'string') {
      return res.status(400).json({ message: 'assessmentId is required' });
    }
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: 'answers must be a non-empty array' });
    }
    const invalid = answers.find(
      (a) => !a || typeof a.question_id !== 'string' || typeof a.response !== 'string' || !a.response.trim()
    );
    if (invalid) {
      return res.status(400).json({ message: 'Each answer needs a question_id and a non-empty response' });
    }

    const { data: assessment, error: loadError } = await supabase
      .from('assessments')
      .select('id, candidate_id, job_id, questions, answer_key, status, score')
      .eq('id', assessmentId)
      .maybeSingle();
    if (loadError) {
      return res.status(500).json({ message: 'Failed to load the assessment', error: loadError.message });
    }
    if (!assessment || assessment.candidate_id !== candidateId) {
      return res.status(404).json({ message: 'Assessment not found' });
    }
    if (assessment.status === 'completed') {
      return res.status(409).json({ message: 'This assessment is already submitted.', score: Number(assessment.score) });
    }

    const questions = assessment.questions?.questions ?? [];
    const answerKey = assessment.answer_key?.answers ?? [];
    if (!questions.length || !answerKey.length) {
      return res.status(500).json({ message: 'Stored assessment is incomplete' });
    }

    let response;
    try {
      response = await fetch(`${ASSESSMENT_SERVICE_URL}/evaluate-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment_id: assessment.id,
          questions,
          answer_key: answerKey,
          answers,
        }),
        signal: AbortSignal.timeout(120000),
      });
    } catch {
      return res.status(502).json({
        message: 'Assessment service is unavailable, so your answers were not graded. Start it (assessment-service) and try again.',
      });
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return res.status(502).json({
        message: 'Assessment evaluation failed',
        error: detail.slice(0, 500),
      });
    }

    const evaluation = await response.json();

    const { error: updateError } = await supabase
      .from('assessments')
      .update({
        answers,
        score: evaluation.score,
        evaluation,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', assessment.id)
      .eq('status', 'generated');
    if (updateError) {
      return res.status(500).json({ message: 'Graded but could not save the result. Please retry.', error: updateError.message });
    }
    console.log(`[assessment] completed ${assessment.id} score=${evaluation.score} short_answer_graded=${evaluation.short_answer_graded}`);

    // Fold the assessment into the latest credibility score for this
    // candidate/job (CHECKLIST 3.7 / 4.1). If no analysis row exists yet the
    // score will include the assessment whenever the résumé is analysed.
    try {
      const { data: scoreRow } = await supabase
        .from('scores')
        .select('id, subscores')
        .eq('candidate_id', candidateId)
        .eq('job_id', assessment.job_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scoreRow) {
        const rebuilt = rebuildScoreRecord(scoreRow.subscores, evaluation);
        const { error: scoreError } = await supabase
          .from('scores')
          .update({
            composite_score: rebuilt.composite,
            subscores: rebuilt.subscores,
            weights: rebuilt.weights,
            explanation: rebuilt.explanation,
            evidence_limited: rebuilt.evidence_limited,
          })
          .eq('id', scoreRow.id);
        if (scoreError) {
          console.warn('[assessment] score row update failed:', scoreError.message);
        } else {
          console.log(`[assessment] score ${scoreRow.id} rebuilt composite=${rebuilt.composite}`);
        }
      }
    } catch (scoreErr) {
      // Never fail the candidate's submission because of a score refresh.
      console.warn('[assessment] score rebuild skipped:', scoreErr?.message);
    }

    return res.json({
      assessmentId: assessment.id,
      score: evaluation.score,
      points_earned: evaluation.points_earned,
      points_possible: evaluation.points_possible,
      short_answer_graded: evaluation.short_answer_graded,
      results: evaluation.results,
    });
  } catch (err) {
    console.error('[assessment] unhandled failure:', err);
    return res.status(500).json({ message: 'Assessment evaluation failed', error: String(err?.message || err) });
  }
};
