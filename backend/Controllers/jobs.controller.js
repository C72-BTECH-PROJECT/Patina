import supabase from '../Config/supabase.js';

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
