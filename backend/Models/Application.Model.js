import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    // 🔗 RELATIONS
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
    },

    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recruiter",
      required: true,
    },

    // 🎯 CORE OUTPUT
    credibilityScore: Number,

    // 🧠 SKILLS (parsed + verified)
    skills: [
      {
        name: String,
        verified: Boolean,
        level: String,
      },
    ],

    // 🐙 GITHUB DATA
    github: {
      username: String,
      commits: Number,
      repos: Number,
      languages: [String],
      totalStars: Number,
      totalForks: Number,
      contributions: Number,
      joinDate: String,
    },

    // 🧪 ASSESSMENT
    assessment: {
      score: Number,
      difficulty: String,
      questionsAnswered: Number,
      correctAnswers: Number,
      timeTaken: String,
      categories: [
        {
          name: String,
          score: Number,
        },
      ],
    },

    // 📄 RESUME
    resume: {
      fileName: String,
      uploadedAt: String,
      parseStatus: String,
    },

    // ⚠️ FLAGS (USP of your project)
    flaggedInconsistencies: [
      {
        type: String,
        description: String,
        severity: String,
      },
    ],

    // ✅ VERIFICATION STATUS
    verificationStatus: {
      resumeParsed: Boolean,
      githubConnected: Boolean,
      assessmentCompleted: Boolean,
      backgroundCheck: String,
    },

    // 📊 PIPELINE STATUS (important for recruiter)
    status: {
      type: String,
      enum: ["applied", "shortlisted", "rejected", "interview"],
      default: "applied",
    },
  },
  { timestamps: true }
);

// ✅ SAFE EXPORT
const Application =
  mongoose.models.Application ||
  mongoose.model("Application", applicationSchema);

export default Application;