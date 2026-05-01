import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: String,
    description: String,

    requiredSkills: [String],
    experienceLevel: String,

    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recruiter",
    },

    candidates: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Candidate",
      },
    ],
  },
  { timestamps: true }
);

const Job =
  mongoose.models.Job ||
  mongoose.model("Job", jobSchema);

export default Job;