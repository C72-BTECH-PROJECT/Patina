import express from 'express';
import cors from 'cors';

import authRoutes from './Routes/auth.routes.js';
import jobsRoutes from './Routes/jobs.routes.js';
import analysisRoutes from './Routes/analysis.routes.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Debug routing
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api', analysisRoutes);

// Backward compatible candidate endpoints (still mock)
const mockCandidate = {
  name: 'Rohit Sharma',
  email: 'rohit.sharma@example.com',
  phone: '+1 (555) 123-4567',
  location: 'Mumbai, India',
  credibilityScore: 82,
  skills: [
    { name: 'Python', verified: true, level: 'Advanced' },
    { name: 'React', verified: true, level: 'Advanced' },
    { name: 'Node.js', verified: true, level: 'Intermediate' },
    { name: 'Machine Learning', verified: false, level: 'Beginner' },
    { name: 'TypeScript', verified: true, level: 'Intermediate' },
  ],
  github: {
    username: 'rohitsharma-dev',
    commits: 450,
    repos: 18,
    languages: ['JavaScript', 'Python', 'TypeScript', 'Go'],
    totalStars: 264,
    totalForks: 45,
    contributions: 892,
    joinDate: '2021-03-15',
  },
  assessment: {
    score: 78,
    difficulty: 'Medium',
    questionsAnswered: 25,
    correctAnswers: 19,
    timeTaken: '12:34',
    categories: [
      { name: 'Technical Skills', score: 85 },
      { name: 'Problem Solving', score: 72 },
      { name: 'System Design', score: 75 },
      { name: 'Code Quality', score: 80 },
    ],
  },
  resume: {
    fileName: 'rohit_sharma_resume.pdf',
    uploadedAt: new Date().toISOString(),
    parseStatus: 'success',
  },
  flaggedInconsistencies: [
    {
      id: 1,
      type: 'warning',
      description:
        "Resume claims 'Expert' level in Machine Learning but assessment shows beginner level",
      severity: 'medium',
    },
    {
      id: 2,
      type: 'info',
      description: 'GitHub activity increased 40% compared to last 6 months',
      severity: 'low',
    },
  ],
  verificationStatus: {
    resumeParsed: true,
    githubConnected: true,
    assessmentCompleted: true,
    backgroundCheck: 'pending',
  },
};

app.get('/api/candidate', (req, res) => {
  res.json(mockCandidate);
});

app.get('/api/candidate/:id', (req, res) => {
  res.json(mockCandidate);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all
app.use((req, res) => {
  res.status(404).json({ message: `Cannot GET ${req.url}` });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `API endpoints:\n- GET  /api/jobs\n- POST /api/jobs\n- POST /api/analyze\n- GET  /api/candidate-analysis`
  );
});

