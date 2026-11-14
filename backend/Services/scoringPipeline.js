// R-10 (REBUILD/DECISIONS.md §4.1, §5, §7): the one scoring function.
//
// Used by apply (jobs.controller.js), by score-again
// (POST /api/applications/:id/score, analysis.controller.js) and, from R-11, after
// an assessment is graded. Every call runs the same chain and INSERTS a new
// `scores` row; a row is never updated in place (D§3: the newest row is the score
// of record, older rows are its history).
//
//   resume pipeline (parse the stored resume against the job)
//     -> GitHub evidence (optional; any failure is a reason code, weight 0)
//     -> the score-of-record assessment: FIRST completed, non-voided attempt (optional)
//     -> composite, band, explanation (explainability.js)
//     -> insert `scores`
//
//   scoreApplication({ candidateId, job? | jobId?, requestId?, assessmentOnlyFallback? }) resolves to
//     { status: 'scored', reason: null, score: { id, composite, band, verification, evidenceLimited, weights, createdAt },
//       scoreRow, resumeId, parserVersion, githubReason, parsingReason }
//   or
//     { status: 'failed', reason }   reason is one of SCORING_FAILURE_REASONS
//
// It never throws and never returns upstream text: `reason` is a stable code.
// A GitHub outage or absence degrades the score (evidence-limited); it does not
// fail scoring. A resume that cannot be parsed, a database error, or no evidence
// at all fails it, and nothing is inserted.
//
// R-11 (lead's ruling 2026-11-14, the GF-4 fallback after grading):
// `assessmentOnlyFallback: true` (used after an attempt is graded) changes one
// thing. When the resume pipeline fails, the new row points at the candidate's
// newest existing `resumes` row (`scores.resume_id` is NOT NULL), parsing is
// unavailable with the pipeline's reason code, and the composite comes from what
// is available (the assessment, and GitHub if it answers for the link on that
// row), marked evidence-limited. With no `resumes` row at all, nothing is
// inserted and scoring fails with the pipeline's reason.
import supabase from '../Config/supabase.js';
import { logError } from '../Middlewares/errorHandler.js';
import { isVoided } from './assessmentService.js';
import { buildScoreRecord } from './explainability.js';
import { fetchGithubEvidence } from './githubEvidence.js';
import { ResumePipelineError, runResumePipeline } from './resumePipeline.js';

export const SCORING_FAILURE_REASONS = Object.freeze([
  // The resume pipeline's codes (resumePipeline.js), passed through unchanged.
  'no_resume',
  'storage_error',
  'unreadable_document',
  'unsupported_file_type',
  'parser_unavailable',
  'parser_failed',
  'database_error',
  // Scoring's own.
  'job_not_found',
  'job_lookup_failed',
  'assessment_lookup_failed',
  'no_evidence',
  'score_insert_failed',
  'internal_error',
]);

const JOB_COLUMNS = 'id, description, required_skills, preferred_skills';

const failed = (reason, { candidateId, jobId, cause, detail } = {}) => {
  const code = SCORING_FAILURE_REASONS.includes(reason) ? reason : 'internal_error';
  logError(null, `[scoring] candidate=${candidateId || '-'} job=${jobId || '-'} -> failed ${code}${detail ? ` (${detail})` : ''}`, cause);
  return { status: 'failed', reason: code };
};

/** The `scoring` object a response carries: { status, reason }. */
export const scoringSummary = (result) => ({
  status: result?.status === 'scored' ? 'scored' : 'failed',
  reason: result?.status === 'scored' ? null : (result?.reason || 'internal_error'),
});

/**
 * The assessment whose evaluation is folded into the score, or null: the score
 * of record is the FIRST completed attempt that is not voided (D§6.2; R-12 writes
 * the void record, isVoided() in assessmentService.js reads it).
 * B7: a lookup error throws; it is never read as "no assessment".
 */
export async function findScoringAssessment(candidateId, jobId) {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, evaluation, completed_at')
    .eq('candidate_id', candidateId)
    .eq('job_id', jobId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true });
  if (error) throw Object.assign(new Error('assessment lookup failed'), { cause: error });
  const stampOf = (r) => Date.parse(r?.completed_at || '') || 0;
  const counted = (data || []).filter((r) => !isVoided(r)).sort((a, b) => stampOf(a) - stampOf(b));
  return counted[0] || null;
}

/** The candidate's newest `resumes` row (any job), or null. Throws on a lookup error. */
async function newestResumeRow(candidateId) {
  const { data, error } = await supabase
    .from('resumes')
    .select('id, contact, skills, parser_version, created_at')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw Object.assign(new Error('resume lookup failed'), { cause: error });
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function loadJob(jobId) {
  const { data, error } = await supabase.from('jobs').select(JOB_COLUMNS).eq('id', jobId).maybeSingle();
  if (error) return { error };
  return { job: data || null };
}

/**
 * Score one candidate for one job and insert a new `scores` row.
 *
 * @param {object}  p
 * @param {string}  p.candidateId  the candidate's profile id
 * @param {object} [p.job]         { id, description, required_skills, preferred_skills }; when
 *                                 omitted, `jobId` is loaded (any job status: a closed job's
 *                                 application can still be re-scored)
 * @param {string} [p.jobId]
 * @param {string} [p.requestId]   forwarded to nlp-engine and github-evidence
 * @param {boolean} [p.assessmentOnlyFallback]  R-11: on a resume-pipeline failure, score from
 *                                 the newest stored `resumes` row with parsing unavailable
 */
export async function scoreApplication({ candidateId, job = null, jobId = null, requestId, assessmentOnlyFallback = false } = {}) {
  const ctx = { candidateId, jobId: job?.id || jobId };
  try {
    if (!candidateId || !ctx.jobId) return failed('internal_error', { ...ctx, detail: 'candidateId and job are required' });

    if (!job) {
      const loaded = await loadJob(jobId);
      if (loaded.error) return failed('job_lookup_failed', { ...ctx, cause: loaded.error });
      if (!loaded.job) return failed('job_not_found', ctx);
      job = loaded.job;
    }

    // 1. Resume pipeline, parsed against this job (similarity included).
    let parsed;
    let parsingReason = null;
    try {
      parsed = await runResumePipeline({ candidateId, job, requestId });
    } catch (err) {
      if (!(err instanceof ResumePipelineError)) throw err;
      if (!assessmentOnlyFallback) {
        return failed(err.code, { ...ctx, cause: err.cause, detail: err.detail || err.reason || undefined });
      }
      // R-11 fallback: the newest stored parse anchors the row; parsing is unavailable.
      let row;
      try {
        row = await newestResumeRow(candidateId);
      } catch (lookupErr) {
        return failed('database_error', { ...ctx, cause: lookupErr.cause || lookupErr, detail: 'fallback resume lookup' });
      }
      if (!row) {
        return failed(err.code, { ...ctx, cause: err.cause, detail: `${err.detail || err.code}; no stored resumes row for the fallback` });
      }
      parsingReason = err.code;
      console.warn(`[scoring] request_id=${requestId || '-'} job=${ctx.jobId} resume pipeline failed (${err.code}); scoring from stored resume ${row.id} with parsing unavailable`);
      parsed = {
        resume: row,
        contact: row.contact && typeof row.contact === 'object' ? row.contact : {},
        semanticAnalysis: null,
        parserVersion: null,
      };
    }

    // 2. GitHub evidence. Never throws; a failure is a reason code with weight 0.
    const github = await fetchGithubEvidence({
      githubLink: parsed.contact?.github,
      claimedSkills: Array.isArray(parsed.resume?.skills) ? parsed.resume.skills : [],
      requestId,
    });

    // 3. The score-of-record assessment. A lookup error fails scoring (B7).
    let assessment;
    try {
      assessment = await findScoringAssessment(candidateId, job.id);
    } catch (err) {
      return failed('assessment_lookup_failed', { ...ctx, cause: err.cause || err });
    }

    // 4. Composite. Nothing measured -> no score row (never an available 0).
    const record = buildScoreRecord(
      { semantic_analysis: parsed.semanticAnalysis },
      { github, assessmentEvaluation: assessment?.evaluation ?? null, parsingUnavailable: parsingReason }
    );
    if (record.composite === null) return failed('no_evidence', ctx);

    // 5. Insert a new row.
    let row;
    let insertError;
    try {
      ({ data: row, error: insertError } = await supabase
        .from('scores')
        .insert({
          resume_id: parsed.resume.id,
          candidate_id: candidateId,
          job_id: job.id,
          composite_score: record.composite,
          subscores: record.subscores,
          weights: record.weights,
          explanation: record.explanation,
          evidence_limited: record.evidence_limited,
        })
        .select()
        .single());
    } catch (err) {
      insertError = err;
    }
    if (insertError || !row) return failed('score_insert_failed', { ...ctx, cause: insertError || 'no row returned' });

    const githubReason = github?.ok ? null : (github?.reasonCode || null);
    console.log(`[scoring] request_id=${requestId || '-'} job=${job.id} scored composite=${record.composite} band=${record.band} verification=${record.verification} weights=${record.weights_version} github=${githubReason || 'ok'} parsing=${parsingReason || 'ok'}`);
    return {
      status: 'scored',
      reason: null,
      score: {
        id: row.id,
        composite: Number(row.composite_score),
        band: record.band,
        // D§7.1 W3: beside the band, wherever the band goes.
        verification: record.verification,
        evidenceLimited: row.evidence_limited,
        weights: row.weights,
        createdAt: row.created_at ?? null,
      },
      scoreRow: row,
      resumeId: parsed.resume.id,
      parserVersion: parsed.parserVersion,
      githubReason,
      parsingReason,
    };
  } catch (err) {
    return failed('internal_error', { ...ctx, cause: err });
  }
}
