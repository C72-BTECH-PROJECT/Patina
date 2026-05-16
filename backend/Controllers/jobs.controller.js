import { jobs, upsertJobStore } from '../Config/Job.js';

export const getAllJobs = (req, res) => {
  res.json(jobs);
};

export const createJob = async (req, res) => {
  const { title, skills, description, experienceLevel, location } = req.body || {};

  if (!title || !description || !Array.isArray(skills) || skills.length === 0 || !experienceLevel || !location) {
    return res.status(400).json({
      message: 'Missing required fields: title, skills[], description, experienceLevel, location'
    });
  }

  const newJob = upsertJobStore({
    title,
    skills,
    description,
    experienceLevel,
    location,
  });

  res.status(201).json(newJob);
};

