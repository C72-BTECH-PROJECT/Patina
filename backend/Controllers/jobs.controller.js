import supabase from '../Config/supabase.js';
import { sendNotification } from '../Controllers/notification.controller.js';

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

export const getMyJobs = async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('recruiter_id', req.session.userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: 'Could not load your jobs.' });
  return res.json(data.map(formatJob));
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

  if (error) return res.status(400).json({ message: error.message });

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

  return res.json(formatJob(job));
};
export const applyToJob = async (req, res) => {
  const jobId = req.params.id;

  // Only allow applying if the candidate has a resume in Supabase Storage.
  const { data: resumeFiles } = await supabase.storage
    .from('resumes')
    .list(`candidates/${req.session.userId}`, { limit: 100 });
  const hasResume =
    Array.isArray(resumeFiles) && resumeFiles.some((f) => f.name.startsWith('resume'));

  if (!hasResume) {
    return res.status(400).json({
      code: 'RESUME_REQUIRED',
      message: 'Please upload your resume first before applying.',
    });
  }

  // Only accept applications for a job that is currently published.
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, recruiter_id')
    .eq('id', jobId)
    .eq('status', 'published')
    .maybeSingle();

  if (jobError || !job) {
    return res.status(404).json({ message: 'Job not found or no longer accepting applications.' });
  }

  const { data, error } = await supabase
    .from('applications')
    .insert({
      candidate_id: req.session.userId,
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
    console.error('Apply failed:', error.message);
    return res.status(500).json({ message: 'Could not submit application.' });
  }

  return res.status(201).json(data);
};

export const getAllApplications = async (req, res) => {
  try {
    const recruiterId = req.session.userId;

    const { data: jobRows, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title')
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

    const enriched = await Promise.all((applicationRows || []).map(async (app) => {
      let profile = null;
      let authUser = null;

      try {
        const profileResult = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', app.candidate_id)
          .maybeSingle();
        profile = profileResult.data;
      } catch (e) {
        profile = null;
      }

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
      const email = profile?.email || authUser?.email || meta.email || '';

      return {
        id: app.id,
        candidateId: app.candidate_id,
        jobId: app.job_id,
        jobTitle: jobsById.get(app.job_id)?.title || 'Unknown Job',
        candidateName: fullName,
        candidateEmail: email,
        status: app.status,
        appliedAt: app.submitted_at,
      };
    }));

    return res.json(enriched);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load applications', error: String(err?.message || err) });
  }
};

export const shortlistCandidate = async (req, res) => {
  const { applicationId, status } = req.body || {};

  if (!applicationId || !status) {
    return res.status(400).json({ message: 'applicationId and status are required.' });
  }

  const allowed = ['shortlisted', 'rejected', 'submitted'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  const { data, error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', applicationId)
    .select('id, candidate_id, job_id, status')
    .single();

  if (error) {
    return res.status(500).json({ message: 'Could not update application status.' });
  }

  if (status === 'shortlisted') {
    await sendNotification(
      data.candidate_id,
      'shortlisted',
      'You have been shortlisted for a job!',
      { applicationId: data.id, jobId: data.job_id }
    );
  }

  return res.status(200).json(data);
};
