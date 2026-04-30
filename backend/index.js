const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Mock candidate data
const mockCandidate = {
  name: "Rohit Sharma",
  email: "rohit.sharma@example.com",
  phone: "+1 (555) 123-4567",
  location: "Mumbai, India",
  credibilityScore: 82,
  skills: [
    { name: "Python", verified: true, level: "Advanced" },
    { name: "React", verified: true, level: "Advanced" },
    { name: "Node.js", verified: true, level: "Intermediate" },
    { name: "Machine Learning", verified: false, level: "Beginner" },
    { name: "TypeScript", verified: true, level: "Intermediate" }
  ],
  github: {
    username: "rohitsharma-dev",
    commits: 450,
    repos: 18,
    languages: ["JavaScript", "Python", "TypeScript", "Go"],
    totalStars: 264,
    totalForks: 45,
    contributions:892,
    joinDate: "2021-03-15"
  },
  assessment: {
    score: 78,
    difficulty: "Medium",
    questionsAnswered: 25,
    correctAnswers: 19,
    timeTaken: "12:34",
    categories: [
      { name: "Technical Skills", score: 85 },
      { name: "Problem Solving", score: 72 },
      { name: "System Design", score: 75 },
      { name: "Code Quality", score: 80 }
    ]
  },
  resume: {
    fileName: "rohit_sharma_resume.pdf",
    uploadedAt: new Date().toISOString(),
    parseStatus: "success"
  },
  flaggedInconsistencies: [
    {
      id: 1,
      type: "warning",
      description: "Resume claims 'Expert' level in Machine Learning but assessment shows beginner level",
      severity: "medium"
    },
    {
      id: 2,
      type: "info",
      description: "GitHub activity increased 40% compared to last 6 months",
      severity: "low"
    }
  ],
  verificationStatus: {
    resumeParsed: true,
    githubConnected: true,
    assessmentCompleted: true,
    backgroundCheck: "pending"
  }
};

// API Routes

// Get candidate data
app.get('/api/candidate', (req, res) => {
  res.json(mockCandidate);
});

// Get candidate by ID (optional)
app.get('/api/candidate/:id', (req, res) => {
  res.json(mockCandidate);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/candidate`);
});