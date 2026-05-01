import { candidates } from "../Config/Candidate.js";
import { recruiters } from "../Config/Recruiter.js";

// LOGIN
export const login = (req, res) => {
  const { role, email, password } = req.body;

  let user = null;
  
  if (role === "candidate") {
    user = candidates.find(c => c.email === email && c.password === password);
  } else if (role === "recruiter") {
    user = recruiters.find(r => r.email === email && r.password === password);
  } else {
    // If no role is provided strictly, find in either (as requested by prompt initially, but prompt also had email and name mix, let's stick to email/password since that's what frontend sends)
    user = candidates.find(c => c.email === email && c.password === password) ||
           recruiters.find(r => r.email === email && r.password === password);
  }

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // detect role again if not strictly provided
  const detectedRole = candidates.includes(user) ? "candidate" : "recruiter";

  res.json({ message: "Login successful", user, role: detectedRole });
};

// SIGNUP
export const signup = (req, res) => {
  const { role, ...data } = req.body;

  if (role === "candidate") {
    candidates.push({
      _id: `cand${candidates.length + 1}`,
      ...data
    });
  } else if (role === "recruiter") {
    recruiters.push({
      _id: `rec${recruiters.length + 1}`,
      ...data,
      isVerified: data.isVerified || false
    });
  } else {
     return res.status(400).json({ message: "Role is required" });
  }

  res.status(201).json({ message: "Signup successful" });
};