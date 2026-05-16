const initialJobs = [
  {
    _id: "job1",
    title: "Frontend Developer",
    description: "Work on React-based UI",
    requiredSkills: ["React", "JavaScript", "CSS"],
    experienceLevel: "0-2 years",
    location: "Remote",
    recruiter: "rec1",
  },
  {
    _id: "job2",
    title: "Backend Developer",
    description: "Node.js + API development",
    requiredSkills: ["Node.js", "Express", "MongoDB"],
    experienceLevel: "2-4 years",
    location: "Bangalore",
    recruiter: "rec1",
  },
  {
    _id: "job3",
    title: "Full Stack Developer",
    description: "React + Node full stack role",
    requiredSkills: ["React", "Node.js"],
    experienceLevel: "1-3 years",
    location: "Hyderabad",
    recruiter: "rec2",
  },
  {
    _id: "job4",
    title: "Machine Learning Engineer",
    description: "ML models + data pipelines",
    requiredSkills: ["Python", "Machine Learning"],
    experienceLevel: "2-5 years",
    location: "Pune",
    recruiter: "rec2",
  },
  {
    _id: "job5",
    title: "DevOps Engineer",
    description: "CI/CD and cloud infra",
    requiredSkills: ["Docker", "AWS", "Kubernetes"],
    experienceLevel: "3-6 years",
    location: "Mumbai",
    recruiter: "rec1",
  },
];

// In-memory store (DO NOT use MongoDB yet)
export const jobs = initialJobs.map((j, idx) => ({
  id: idx + 1,
  title: j.title,
  description: j.description,
  skills: j.requiredSkills || [],
  experienceLevel: j.experienceLevel,
  location: j.location || 'Remote',
  _id: j._id,
  recruiter: j.recruiter,
}));

let nextId = jobs.length + 1;

// Helper to normalize skills array from recruiter form payloads.
const normalizeSkills = (skills) => {
  if (!Array.isArray(skills)) return [];
  return skills.map((s) => String(s).trim()).filter(Boolean);
};

export const upsertJobStore = ({ title, skills, description, experienceLevel, location }) => {
  const normalizedSkills = normalizeSkills(skills);

  const newJob = {
    id: nextId++,
    title,
    skills: normalizedSkills,
    description,
    experienceLevel,
    location,
    _id: `job${nextId - 1}`,
  };

  jobs.push(newJob);
  return newJob;
};

