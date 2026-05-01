import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,

    location: String,
  },
  { timestamps: true }
);

const Candidate =
  mongoose.models.Candidate ||
  mongoose.model("Candidate", candidateSchema);

export default Candidate;