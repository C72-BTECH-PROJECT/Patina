import FormData from 'form-data';
import fetch from 'node-fetch';

import supabase from '../Config/supabase.js';
import { rebuildScoreRecord } from '../Services/explainability.js';
import { GradeError, gradeOnce } from '../Services/gradingClaim.js';
import {
  assessmentFailure,
  evaluateAnswers,
  generateAssessment as requestAssessment,
} from '../Services/assessmentService.js';
import { InternalHttpError, resolveRequestId } from '../Services/internalHttp.js';
import { isUuid } from '../Services/validation.js';
import { fetchGithubEvidence, normaliseGithubLogin } from '../Services/githubEvidence.js';

// Standalone generation service (T-0024/T-0025). The service holds the LLM
// key and mints the answer key; this proxy forwards the candidate/job
// context, persists the assessment row, and returns candidate questions
// only — the key never reaches the browser.
// T-0029 (I-0066): keys live in public.assessment_keys (RLS on, no policy, no
// anon/authenticated grant), never in public.assessments, which candidates can
// read through PostgREST.

// T-0029 (I-0069): a 'grading' claim older than this may be taken over, so a
// crashed grader never leaves an attempt stuck. Far above the 120 s evaluate
// abort (EVALUATE_TIMEOUT_MS in Services/assessmentService.js), so a live grader
// is never treated as stale.
const GRADING_STALE_AFTER = '10 minutes';

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
    const requestId = resolveRequestId(req);
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
    // T-0029: an attempt being graded is still open; it is not handed out again.
    const { data: openAttempt, error: openError } = await supabase
      .from('assessments')
      .select('id, questions, status')
      .eq('candidate_id', candidateId)
      .eq('job_id', job.id)
      .in('status', ['generated', 'grading'])
      .maybeSingle();
    if (openError) {
      return res.status(500).json({ message: 'Failed to load your assessment attempt', error: openError.message });
    }
    if (openAttempt?.status === 'grading') {
      return res.status(409).json({
        error: 'grading_in_progress',
        message: 'Your last submission for this assessment is still being graded. Try again in a moment.',
      });
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

    // Fetch GitHub evidence (if a GitHub link is present in the resume) so the
    // assessment can include github-sourced questions.
    let githubData = null;
    let includeGithub = false;
    const githubLink = resume?.contact?.github || null;
    if (githubLink && normaliseGithubLogin(githubLink)) {
      try {
        const ev = await fetchGithubEvidence({ githubLink, claimedSkills: resume?.skills ?? [], requestId: req.requestId });
        if (ev?.ok) {
          githubData = ev.evidence;
          includeGithub = true;
        }
      } catch (e) {
        console.warn('[assessment] github evidence fetch failed:', e?.message);
      }
    }

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
      include_github: includeGithub,
      github_data: githubData,
    };

    let data;
    try {
      data = await requestAssessment(payload, { requestId });
    } catch (err) {
      if (!(err instanceof InternalHttpError)) throw err;
      console.error(`[assessment] generate failed: request_id=${requestId} kind=${err.kind} status=${err.status ?? '-'}`);
      const failure = assessmentFailure(err, 'Assessment generation failed');
      return res.status(failure.status).json(failure.body);
    }

    // The service wraps the payload: questions = { assessment_id,
    // model_used, prompt_version, questions: [...] }, answer_key =
    // { assessment_id, answers: [...] }.
    const questionBundle = data.questions || {};
    const answerBundle = data.answer_key || {};
    const assessmentId = questionBundle.assessment_id;

    if (!assessmentId || !Array.isArray(questionBundle.questions) || !Array.isArray(answerBundle.answers)) {
      console.error('[assessment] malformed service payload:', Object.keys(data));
      return res.status(502).json({ message: 'Assessment service returned an unexpected payload. Please retry.' });
    }

    // Persist the attempt, then its key in the separate key table (T-0029).
    // If the insert races another attempt, fall back to the stored open row.
    const { data: inserted, error: insertError } = await supabase
      .from('assessments')
      .insert({
        id: assessmentId,
        candidate_id: candidateId,
        job_id: job.id,
        questions: questionBundle,
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

    // No attempt may exist without its key: if the key cannot be stored, remove
    // the attempt and let the candidate generate again.
    const { error: keyError } = await supabase
      .from('assessment_keys')
      .insert({ assessment_id: inserted.id, answer_key: answerBundle });
    if (keyError) {
      console.error('[assessment] answer key insert failed:', keyError.message);
      const { error: cleanupError } = await supabase.from('assessments').delete().eq('id', inserted.id);
      if (cleanupError) console.error('[assessment] could not remove the keyless attempt:', cleanupError.message);
      return res.status(502).json({ message: 'Assessment generated but could not be saved. Please retry.' });
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
    const requestId = resolveRequestId(req);
    const { assessmentId, answers } = req.body || {};

    if (!assessmentId || typeof assessmentId !== 'string') {
      return res.status(400).json({ message: 'assessmentId is required' });
    }
    if (!isUuid(assessmentId)) {
      return res.status(400).json({ error: 'invalid_assessment_id', message: 'assessmentId must be a UUID.' });
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
      .select('id, candidate_id, job_id, status, score')
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

    // T-0029 (I-0069): claim ('generated' -> 'grading', atomic in the database),
    // grade, then complete only while this claim still holds; release on failure.
    const outcome = await gradeOnce({
      claim: async () => {
        const { data, error } = await supabase.rpc('claim_assessment_for_grading', {
          p_assessment_id: assessment.id,
          p_candidate_id: candidateId,
          p_stale_after: GRADING_STALE_AFTER,
        });
        if (error) throw new Error(`grading claim failed: ${error.message}`);
        return Array.isArray(data) && data.length ? data[0] : null;
      },
      grade: async (claimed) => {
        const questions = claimed.questions?.questions ?? [];
        const { data: keyRow, error: keyError } = await supabase
          .from('assessment_keys')
          .select('answer_key')
          .eq('assessment_id', claimed.id)
          .maybeSingle();
        if (keyError) throw new GradeError(500, { message: 'Failed to load the assessment' });
        const answerKey = keyRow?.answer_key?.answers ?? [];
        if (!keyRow) {
          throw new GradeError(409, {
            error: 'key_unavailable',
            message: 'This assessment cannot be graded right now. Please try again shortly.',
          });
        }
        if (!questions.length || !answerKey.length) {
          throw new GradeError(500, { message: 'Stored assessment is incomplete' });
        }

        try {
          return await evaluateAnswers(
            { assessment_id: claimed.id, questions, answer_key: answerKey, answers },
            { requestId }
          );
        } catch (err) {
          if (!(err instanceof InternalHttpError)) throw err;
          console.error(`[assessment] evaluate failed: request_id=${requestId} kind=${err.kind} status=${err.status ?? '-'}`);
          const failure = assessmentFailure(
            err,
            'Assessment evaluation failed',
            'Assessment service is unavailable, so your answers were not graded. Start it (assessment-service) and try again.'
          );
          throw new GradeError(failure.status, failure.body);
        }
      },
      complete: async (claimedAt, evaluation) => {
        const { data, error } = await supabase
          .from('assessments')
          .update({
            answers,
            score: evaluation.score,
            evaluation,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', assessment.id)
          .eq('status', 'grading')
          .eq('grading_started_at', claimedAt)
          .select('id');
        if (error) throw new Error(error.message);
        return Array.isArray(data) && data.length === 1;
      },
      release: async (claimedAt) => {
        const { error } = await supabase
          .from('assessments')
          .update({ status: 'generated', grading_started_at: null })
          .eq('id', assessment.id)
          .eq('status', 'grading')
          .eq('grading_started_at', claimedAt);
        if (error) throw new Error(error.message);
      },
    });
    if (outcome.status !== 200) {
      return res.status(outcome.status).json(outcome.body);
    }
    const { evaluation } = outcome;
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
