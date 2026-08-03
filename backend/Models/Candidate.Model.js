import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, default: "" },
    googleId: { type: String, default: null },
    githubId: { type: String, default: null },
    location: String,
  },
  { timestamps: true }
);

const Candidate =
  mongoose.models.Candidate ||
  mongoose.model("Candidate", candidateSchema);

export default Candidate;