import mongoose from "mongoose";

const recruiterSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,

    companyName: String,

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