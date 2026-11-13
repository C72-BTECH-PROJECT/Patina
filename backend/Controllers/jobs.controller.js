import supabase from '../Config/supabase.js';
import { isUuid } from '../Services/validation.js';
import { sendNotification } from '../Controllers/notification.controller.js';
import { logError, sendError } from '../Middlewares/errorHandler.js';
import { resolveRequestId } from '../Services/internalHttp.js';
import { ResumePipelineError, findStoredResume } from '../Services/resumePipeline.js';
import { scoreApplication, scoringSummary } from '../Services/scoringPipeline.js';
import { prepareOnApply, triggerPreparation } from '../Services/assessmentService.js';
import { scoreBand } from '../Services/explainability.js';

const formatJob = (job) => ({
  id: job.id,
  _id: job.id,
  title: job.title,
  description: job.description,
  skills: job.required_skills,
  requiredSkills: job.required_skills,
  preferredSkills: job.preferred_skills,
  experienceLevel: job.experience_level,
  location: job.location,
  status: job.status,
  recruiter: job.recruiter_id,
  createdAt: job.created_at,
});

export const getAllJobs = async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: 'Could not load jobs.' });
  return res.json(data.map(formatJob));
};

// R-13: each of the recruiter's jobs carries `applicationCount`, the real number of
// `applications` rows for it (one batched query). A count lookup error is an error,
// never a count of 0.
export const getMyJobs = async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('recruiter_id', req.session.userId)
    .order('created_at', { ascending: false });

  if (error) {
    return sendError(req, res, { status: 500, error: 'database_error', message: 'Could not load your jobs.', cause: error, context: 'my jobs' });
  }
  const jobs = data || [];
  const counts = new Map(jobs.map((j) => [j.id, 0]));
  if (jobs.length) {
    const { data: appRows, error: countError } = await supabase
      .from('applications')
      .select('job_id')
      .in('job_id', jobs.map((j) => j.id));
    if (countError) {
      return sendError(req, res, { status: 500, error: 'database_error', message: 'Could not load your jobs.', cause: countError, context: 'my jobs: application counts' });
    }
    for (const a of appRows || []) {
      if (counts.has(a.job_id)) counts.set(a.job_id, counts.get(a.job_id) + 1);
    }
  }
  return res.json(jobs.map((j) => ({ ...formatJob(j), applicationCount: counts.get(j.id) })));
};

export const createJob = async (req, res) => {
  const { title, skills, description, experienceLevel, location, preferredSkills = [], status = 'published' } = req.body || {};

  if (!title || !description || !Array.isArray(skills) || skills.length === 0 || !experienceLevel || !location) {
    return res.status(400).json({
      message: 'Missing required fields: title, skills[], description, experienceLevel, location'
    });
  }

  const normalizedSkills = skills.map((skill) => String(skill).trim()).filter(Boolean);
  const normalizedPreferredSkills = Array.isArray(preferredSkills)
    ? preferredSkills.map((skill) => String(skill).trim()).filter(Boolean)
    : [];

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      recruiter_id: req.session.userId,
      title: String(title).trim(),
      description: String(description).trim(),
      required_skills: normalizedSkills,
      preferred_skills: normalizedPreferredSkills,
      experience_level: String(experienceLevel).trim(),
      location: String(location).trim(),
      status,
    })
    .select()
    .single();

  // R-03: status stays 400 (bad field values are the usual cause); the database's
  // own text goes to the log only.
  if (error) {
    return sendError(req, res, { status: 400, error: 'job_not_created', message: 'Could not create the job. Check the fields and try again.', cause: error, context: 'create job' });
  }

  return res.status(201).json(formatJob(data));
};

export const getJobById = async (req, res) => {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', req.params.id)
    .eq('status', 'published')
    .maybeSingle();

  if (error || !job) {
    return res.status(404).json({ message: 'Job not found.' });
  }

  // Candidates also learn whether they already applied, so the UI can render
  // the job as applied instead of leaving the Apply button clickable.
  let applied = false;
  if (req.session?.role === 'CANDIDATE') {
    const { data: existing } = await supabase
      .from('applications')
      .select('id, status, submitted_at')
      .eq('candidate_id', req.session.userId)
      .eq('job_id', job.id)
      .maybeSingle();
    applied = Boolean(existing);
  }

  return res.json({ ...formatJob(job), applied });
};
// R-10 (D§4.1, Y1): apply saves the application first, then scores it in the same
// request. Condition of Y1: a scoring failure of any kind never undoes or blocks
// the application. The response is always 201 once the row is saved:
//   201 { ...application row, scoring: { status: 'scored' | 'failed', reason } }
// `reason` is a stable code (scoringPipeline.js SCORING_FAILURE_REASONS), never
// upstream text, and it is not stored: afterwards the application reads as
// `pending` until a score row exists, and POST /api/applications/:id/score retries.
// R-11: after the response, the assessment pool is prepared in the background.
export const applyToJob = async (req, res) => {
  const jobId = req.params.id;
  const candidateId = req.session.userId;
  if (!isUuid(jobId)) {
    return res.status(404).json({ message: 'Job not found or no longer accepting applications.' });
  }

  // Only allow applying if the candidate has a resume on file. A storage error is
  // an error, never "upload your resume first" (B9).
  let resumeFile;
  try {
    resumeFile = await findStoredResume(candidateId);
  } catch (err) {
    if (err instanceof ResumePipelineError) {
      return sendError(req, res, { status: 500, error: 'storage_error', message: 'Could not check your resume. Please try again.', cause: err.cause, context: 'apply: resume check' });
    }
    throw err;
  }
  if (!resumeFile) {
    return res.status(400).json({
      code: 'RESUME_REQUIRED',
      message: 'Please upload your resume first before applying.',
    });
  }

  // Only accept applications for a job that is currently published.
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, recruiter_id, description, required_skills, preferred_skills')
    .eq('id', jobId)
    .eq('status', 'published')
    .maybeSingle();

  if (jobError) {
    return sendError(req, res, { status: 500, error: 'database_error', message: 'Could not submit application.', cause: jobError, context: 'apply: job lookup' });
  }
  if (!job) {
    return res.status(404).json({ message: 'Job not found or no longer accepting applications.' });
  }

  // 1. Save the application. Nothing after this point can undo it.
  const { data: application, error } = await supabase
    .from('applications')
    .insert({
      candidate_id: candidateId,
      job_id: jobId,
      status: 'submitted',
    })
    .select()
    .single();

  if (error) {
    // Postgres error 23505 = unique (candidate_id, job_id) violated -> already applied
    if (error.code === '23505') {
      return res.status(409).json({ message: 'You have already applied for this job.' });
    }
    return sendError(req, res, { status: 500, error: 'database_error', message: 'Could not submit application.', cause: error, context: 'apply: insert' });
  }

  // 2. Score it. scoreApplication never throws; the guard is for the Y1 condition.
  let result;
  try {
    result = await scoreApplication({
      candidateId,
      job,
      requestId: req.requestId || resolveRequestId(req),
    });
  } catch (err) {
    logError(req, '[apply] scoring threw', err);
    result = { status: 'failed', reason: 'internal_error' };
  }

  res.status(201).json({ ...application, scoring: scoringSummary(result) });

  // 3. R-11 (D§0 A1): prepare the assessment pool in the background, after the
  // response is decided and sent. Fire-and-forget: its outcome never affects apply.
  // ASSESSMENT_PREPARE_ON_APPLY=false skips it (status and start still prepare lazily).
  try {
    if (prepareOnApply()) triggerPreparation(candidateId, jobId, { requestId: req.requestId || resolveRequestId(req) });
  } catch (err) {
    logError(req, '[apply] assessment preparation could not be started', err);
  }
};

export const getMyApplications = async (req, res) => {
  try {
    const candidateId = req.session.userId;

    // R-16: the job title comes with each row (the embed reads closed jobs too).
    const { data: applicationRows, error: applicationsError } = await supabase
      .from('applications')
      .select('id, job_id, status, submitted_at, job:jobs(title)')
      .eq('candidate_id', candidateId)
      .order('submitted_at', { ascending: false });

    if (applicationsError) {
      return sendError(req, res, { status: 500, error: 'database_error', message: 'Failed to load applications', cause: applicationsError, context: 'my applications' });
    }

    // R-10 (Y1): the scoring state is derived from whether a score row exists for
    // this candidate and job: `scored` or `pending` ("not scored yet"). No failure
    // reason is stored, so none is shown here. A lookup error is an error, never
    // "pending". R-16: `score` is { composite, band } of the NEWEST row for that job,
    // from one query for all rows, or null.
    const rows = applicationRows || [];
    const newestByJob = new Map();
    if (rows.length) {
      const { data: scoreRows, error: scoresError } = await supabase
        .from('scores')
        .select('id, job_id, composite_score, created_at')
        .eq('candidate_id', candidateId)
        .in('job_id', rows.map((r) => r.job_id))
        .order('created_at', { ascending: false });
      if (scoresError) {
        return sendError(req, res, { status: 500, error: 'database_error', message: 'Failed to load applications', cause: scoresError, context: 'my applications: scores' });
      }
      const stamp = (v) => Date.parse(v || '') || 0;
      const newestFirst = [...(scoreRows || [])].sort((a, b) => stamp(b.created_at) - stamp(a.created_at)
        || String(b.id).localeCompare(String(a.id)));
      for (const s of newestFirst) if (!newestByJob.has(s.job_id)) newestByJob.set(s.job_id, s);
    }

    return res.json(rows.map((r) => {
      const newest = newestByJob.get(r.job_id);
      return {
        id: r.id,
        job_id: r.job_id,
        status: r.status,
        submitted_at: r.submitted_at,
        job_title: r.job?.title ?? null,
        scoring: { state: newest ? 'scored' : 'pending' },
        score: newest ? { composite: Number(newest.composite_score), band: scoreBand(newest.composite_score) } : null,
      };
    }));
  } catch (err) {
    return sendError(req, res, { status: 500, error: 'internal_error', message: 'Failed to load applications', cause: err, context: 'my applications' });
  }
};

// POST /api/jobs/applications/shortlist { applicationId, status }  (RECRUITER)
// Status actions, unchanged in R-13: `shortlisted` or `rejected`, from any current
// status, only on an application to a job this recruiter owns (404 otherwise, so ids
// cannot be probed). The candidate is notified; R-13 reports whether that insert
// succeeded as `notified` instead of assuming it.
//   200 { id, candidate_id, job_id, status, notified }
//   400 missing or invalid field · 404 not found / not yours · 500 database_error
export const shortlistCandidate = async (req, res) => {
  const { applicationId, status } = req.body || {};

  if (!applicationId || !status) {
    return res.status(400).json({ message: 'applicationId and status are required.' });
  }
  if (!isUuid(applicationId)) {
    return res.status(400).json({ error: 'invalid_application_id', message: 'applicationId must be a UUID.' });
  }

  const allowed = ['shortlisted', 'rejected'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  // The application must belong to a job this recruiter owns. A missing row and
  // someone else's row look the same (404) so ids can't be probed.
  const { data: owned, error: lookupError } = await supabase
    .from('applications')
    .select('id, job:jobs!inner(recruiter_id, title)')
    .eq('id', applicationId)
    .maybeSingle();

  if (lookupError) {
    return sendError(req, res, { status: 500, error: 'database_error', message: 'Could not update application status.', cause: lookupError, context: 'shortlist: lookup' });
  }
  if (!owned || owned.job?.recruiter_id !== req.session.userId) {
    return res.status(404).json({ message: 'Application not found.' });
  }

  const { data, error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', applicationId)
    .select('id, candidate_id, job_id, status')
    .single();

  if (error) {
    return sendError(req, res, { status: 500, error: 'database_error', message: 'Could not update application status.', cause: error, context: 'shortlist: update' });
  }

  let notified = false;
  if (status === 'shortlisted') {
    notified = await sendNotification(
      data.candidate_id,
      'shortlisted',
      `You have been shortlisted for ${owned.job.title}.`,
      { applicationId: data.id, jobId: data.job_id }
    );
  }

  if (status === 'rejected') {
    notified = await sendNotification(
      data.candidate_id,
      'rejected',
      `The recruiter has decided not to move forward with your application for ${owned.job.title}.`,
      { applicationId: data.id, jobId: data.job_id }
    );
  }

  return res.status(200).json({ ...data, notified: notified === true });
};
