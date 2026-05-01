export const fullApplications = [
  {
    _id: "app1",
    candidate: "cand1",
    job: "job1",
    recruiter: "rec1",

    candidateInfo: {
      name: "Rohit Sharma",
      email: "rohit@gmail.com",
      phone: "+91 9876543210",
      location: "Mumbai"
    },

    credibilityScore: 82,

    skills: [
      { name: "React", verified: true, level: "Advanced" },
      { name: "Node.js", verified: true, level: "Intermediate" },
      { name: "Machine Learning", verified: false, level: "Beginner" }
    ],

    github: {
      username: "rohit-dev",
      commits: 450,
      repos: 18,
      languages: ["JavaScript", "Python"],
      totalStars: 200,
      totalForks: 40,
      contributions: 890,
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
        { name: "Problem Solving", score: 72 }
      ]
    },

    resume: {
      fileName: "rohit_resume.pdf",
      uploadedAt: "2026-04-01",
      parseStatus: "success"
    },

    flaggedInconsistencies: [
      {
        type: "warning",
        description: "Claims ML expert but low assessment score",
        severity: "medium"
      }
    ],

    verificationStatus: {
      resumeParsed: true,
      githubConnected: true,
      assessmentCompleted: true,
      backgroundCheck: "pending"
    },

    status: "applied"
  },

  {
    _id: "app2",
    candidate: "cand2",
    job: "job1",
    recruiter: "rec1",
    candidateInfo: {
      name: "Priya Patel",
      email: "priya@gmail.com",
      phone: "+91 9123456780",
      location: "Ahmedabad"
    },
    credibilityScore: 91,
    skills: [
      { name: "React", verified: true, level: "Advanced" },
      { name: "CSS", verified: true, level: "Advanced" }
    ],
    github: {
      username: "priya-dev",
      commits: 520,
      repos: 22,
      languages: ["JavaScript"],
      totalStars: 300,
      totalForks: 50,
      contributions: 1000,
      joinDate: "2020-02-10"
    },
    assessment: {
      score: 88,
      difficulty: "Medium",
      questionsAnswered: 25,
      correctAnswers: 22,
      timeTaken: "11:10",
      categories: [{ name: "Technical Skills", score: 90 }]
    },
    resume: {
      fileName: "priya_resume.pdf",
      uploadedAt: "2026-04-02",
      parseStatus: "success"
    },
    flaggedInconsistencies: [],
    verificationStatus: {
      resumeParsed: true,
      githubConnected: true,
      assessmentCompleted: true,
      backgroundCheck: "clear"
    },
    status: "shortlisted"
  },

  {
    _id: "app3",
    candidate: "cand3",
    job: "job2",
    recruiter: "rec1",
    candidateInfo: {
      name: "Arjun Mehta",
      email: "arjun@gmail.com",
      phone: "+91 9000000000",
      location: "Delhi"
    },
    credibilityScore: 65,
    skills: [
      { name: "Node.js", verified: false, level: "Beginner" }
    ],
    github: {
      username: "arjun-dev",
      commits: 120,
      repos: 5,
      languages: ["JavaScript"],
      totalStars: 20,
      totalForks: 5,
      contributions: 200,
      joinDate: "2022-01-01"
    },
    assessment: {
      score: 60,
      difficulty: "Easy",
      questionsAnswered: 20,
      correctAnswers: 12,
      timeTaken: "14:00",
      categories: [{ name: "Problem Solving", score: 60 }]
    },
    resume: {
      fileName: "arjun_resume.pdf",
      uploadedAt: "2026-04-03",
      parseStatus: "success"
    },
    flaggedInconsistencies: [
      {
        type: "warning",
        description: "Low GitHub activity vs claimed skills",
        severity: "high"
      }
    ],
    verificationStatus: {
      resumeParsed: true,
      githubConnected: true,
      assessmentCompleted: true,
      backgroundCheck: "pending"
    },
    status: "rejected"
  },

  {
    _id: "app4",
    candidate: "cand4",
    job: "job3",
    recruiter: "rec2",
    candidateInfo: {
      name: "Sneha Iyer",
      email: "sneha@gmail.com",
      phone: "+91 9888888888",
      location: "Bangalore"
    },
    credibilityScore: 88,
    skills: [
      { name: "Full Stack", verified: true, level: "Advanced" }
    ],
    github: {
      username: "sneha-dev",
      commits: 430,
      repos: 16,
      languages: ["JS", "Python"],
      totalStars: 150,
      totalForks: 35,
      contributions: 700,
      joinDate: "2021-06-10"
    },
    assessment: {
      score: 85,
      difficulty: "Medium",
      questionsAnswered: 25,
      correctAnswers: 21,
      timeTaken: "12:00",
      categories: [{ name: "System Design", score: 80 }]
    },
    resume: {
      fileName: "sneha_resume.pdf",
      uploadedAt: "2026-04-04",
      parseStatus: "success"
    },
    flaggedInconsistencies: [],
    verificationStatus: {
      resumeParsed: true,
      githubConnected: true,
      assessmentCompleted: true,
      backgroundCheck: "clear"
    },
    status: "shortlisted"
  },

  {
    _id: "app5",
    candidate: "cand5",
    job: "job4",
    recruiter: "rec2",
    candidateInfo: {
      name: "Karan Singh",
      email: "karan@gmail.com",
      phone: "+91 9777777777",
      location: "Pune"
    },
    credibilityScore: 72,
    skills: [
      { name: "Python", verified: true, level: "Intermediate" }
    ],
    github: {
      username: "karan-dev",
      commits: 250,
      repos: 10,
      languages: ["Python"],
      totalStars: 80,
      totalForks: 20,
      contributions: 500,
      joinDate: "2021-09-01"
    },
    assessment: {
      score: 70,
      difficulty: "Medium",
      questionsAnswered: 25,
      correctAnswers: 18,
      timeTaken: "13:20"
    },
    resume: {
      fileName: "karan_resume.pdf",
      uploadedAt: "2026-04-05",
      parseStatus: "success"
    },
    flaggedInconsistencies: [],
    verificationStatus: {
      resumeParsed: true,
      githubConnected: true,
      assessmentCompleted: true,
      backgroundCheck: "pending"
    },
    status: "applied"
  },
   {
    _id: "app6",
    candidate: "cand1",
    job: "job2",
    recruiter: "rec1",
    candidateInfo: {
      name: "Rohit Sharma",
      email: "rohit@gmail.com",
      phone: "+91 9876543210",
      location: "Mumbai"
    },
    credibilityScore: 78,
    skills: [
      { name: "Node.js", verified: true, level: "Intermediate" }
    ],
    github: {
      username: "rohit-dev",
      commits: 320,
      repos: 14,
      languages: ["JavaScript"],
      totalStars: 150,
      totalForks: 30,
      contributions: 700,
      joinDate: "2021-03-15"
    },
    assessment: {
      score: 74,
      difficulty: "Medium",
      questionsAnswered: 25,
      correctAnswers: 18,
      timeTaken: "12:50",
      categories: [{ name: "Backend", score: 75 }]
    },
    resume: {
      fileName: "rohit_backend.pdf",
      uploadedAt: "2026-04-06",
      parseStatus: "success"
    },
    flaggedInconsistencies: [],
    verificationStatus: {
      resumeParsed: true,
      githubConnected: true,
      assessmentCompleted: true,
      backgroundCheck: "pending"
    },
    status: "applied"
  },

  {
    _id: "app7",
    candidate: "cand2",
    job: "job3",
    recruiter: "rec2",
    candidateInfo: {
      name: "Priya Patel",
      email: "priya@gmail.com",
      phone: "+91 9123456780",
      location: "Ahmedabad"
    },
    credibilityScore: 89,
    skills: [
      { name: "React", verified: true, level: "Advanced" },
      { name: "Node.js", verified: true, level: "Intermediate" }
    ],
    github: {
      username: "priya-dev",
      commits: 480,
      repos: 20,
      languages: ["JavaScript"],
      totalStars: 280,
      totalForks: 45,
      contributions: 950,
      joinDate: "2020-02-10"
    },
    assessment: {
      score: 86,
      difficulty: "Medium",
      questionsAnswered: 25,
      correctAnswers: 21,
      timeTaken: "11:45",
      categories: [{ name: "Full Stack", score: 88 }]
    },
    resume: {
      fileName: "priya_fullstack.pdf",
      uploadedAt: "2026-04-07",
      parseStatus: "success"
    },
    flaggedInconsistencies: [],
    verificationStatus: {
      resumeParsed: true,
      githubConnected: true,
      assessmentCompleted: true,
      backgroundCheck: "clear"
    },
    status: "shortlisted"
  },

  {
    _id: "app8",
    candidate: "cand3",
    job: "job3",
    recruiter: "rec2",
    candidateInfo: {
      name: "Arjun Mehta",
      email: "arjun@gmail.com",
      phone: "+91 9000000000",
      location: "Delhi"
    },
    credibilityScore: 60,
    skills: [
      { name: "Node.js", verified: false, level: "Beginner" }
    ],
    github: {
      username: "arjun-dev",
      commits: 100,
      repos: 4,
      languages: ["JavaScript"],
      totalStars: 15,
      totalForks: 3,
      contributions: 150,
      joinDate: "2022-01-01"
    },
    assessment: {
      score: 58,
      difficulty: "Easy",
      questionsAnswered: 20,
      correctAnswers: 11,
      timeTaken: "14:20",
      categories: [{ name: "Problem Solving", score: 58 }]
    },
    resume: {
      fileName: "arjun_fullstack.pdf",
      uploadedAt: "2026-04-08",
      parseStatus: "success"
    },
    flaggedInconsistencies: [
      {
        type: "warning",
        description: "Low assessment vs claimed skill",
        severity: "high"
      }
    ],
    verificationStatus: {
      resumeParsed: true,
      githubConnected: true,
      assessmentCompleted: true,
      backgroundCheck: "pending"
    },
    status: "rejected"
  },

  {
    _id: "app9",
    candidate: "cand4",
    job: "job5",
    recruiter: "rec1",
    candidateInfo: {
      name: "Sneha Iyer",
      email: "sneha@gmail.com",
      phone: "+91 9888888888",
      location: "Bangalore"
    },
    credibilityScore: 87,
    skills: [
      { name: "AWS", verified: true, level: "Advanced" }
    ],
    github: {
      username: "sneha-dev",
      commits: 430,
      repos: 16,
      languages: ["Python", "Shell"],
      totalStars: 140,
      totalForks: 30,
      contributions: 720,
      joinDate: "2021-06-10"
    },
    assessment: {
      score: 84,
      difficulty: "Medium",
      questionsAnswered: 25,
      correctAnswers: 20,
      timeTaken: "12:10",
      categories: [{ name: "DevOps", score: 85 }]
    },
    resume: {
      fileName: "sneha_devops.pdf",
      uploadedAt: "2026-04-09",
      parseStatus: "success"
    },
    flaggedInconsistencies: [],
    verificationStatus: {
      resumeParsed: true,
      githubConnected: true,
      assessmentCompleted: true,
      backgroundCheck: "clear"
    },
    status: "shortlisted"
  },

  {
    _id: "app10",
    candidate: "cand5",
    job: "job5",
    recruiter: "rec1",
    candidateInfo: {
      name: "Karan Singh",
      email: "karan@gmail.com",
      phone: "+91 9777777777",
      location: "Pune"
    },
    credibilityScore: 62,
    skills: [
      { name: "Kubernetes", verified: false, level: "Beginner" }
    ],
    github: {
      username: "karan-dev",
      commits: 150,
      repos: 6,
      languages: ["Docker"],
      totalStars: 40,
      totalForks: 10,
      contributions: 300,
      joinDate: "2021-09-01"
    },
    assessment: {
      score: 60,
      difficulty: "Easy",
      questionsAnswered: 20,
      correctAnswers: 12,
      timeTaken: "13:30",
      categories: [{ name: "Cloud", score: 60 }]
    },
    resume: {
      fileName: "karan_devops.pdf",
      uploadedAt: "2026-04-10",
      parseStatus: "success"
    },
    flaggedInconsistencies: [
      {
        type: "info",
        description: "Low GitHub contributions",
        severity: "low"
      }
    ],
    verificationStatus: {
      resumeParsed: true,
      githubConnected: true,
      assessmentCompleted: true,
      backgroundCheck: "pending"
    },
    status: "rejected"
  }


 ];