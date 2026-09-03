import mongoose from "mongoose";

const recruiterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, default: "" },
    googleId: { type: String, default: null },
    githubId: { type: String, default: null },
    companyName: String,
    verificationInfo: String,

    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Recruiter =
  mongoose.models.Recruiter ||
  mongoose.model("Recruiter", recruiterSchema);

export default Recruiter;