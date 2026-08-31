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

