import { candidates } from "../Config/Candidate.js";
import { recruiters } from "../Config/Recruiter.js";

// GitHub OAuth Config
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "your_github_client_id";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "your_github_client_secret";
const CALLBACK_URL = "http://localhost:5001/api/auth/github/callback";

// LOGIN
export const login = (req, res) => {
  const { role, email, password } = req.body;

  let user = null;

  if (role === "candidate") {
    user = candidates.find(c => c.email === email && c.password === password);
  } else if (role === "recruiter") {
    user = recruiters.find(r => r.email === email && r.password === password);
  } else {
    user = candidates.find(c => c.email === email && c.password === password) ||
           recruiters.find(r => r.email === email && r.password === password);
  }

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

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

// GITHUB AUTH - Redirect to GitHub OAuth
export const githubAuth = (req, res) => {
  const scope = "read:user user:email";
  const state = req.query.role || "candidate"; // Pass role through OAuth flow

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=${scope}&state=${state}`;

  res.redirect(githubAuthUrl);
};

// GITHUB CALLBACK - Handle OAuth callback
export const githubCallback = async (req, res) => {
  const { code, state } = req.query;
  const role = state || "candidate";

  if (!code) {
    return res.redirect("http://localhost:3000/login/candidate?error=no_code");
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("GitHub token error:", tokenData.error);
      return res.redirect("http://localhost:3000/login/candidate?error=token_exchange_failed");
    }

    const accessToken = tokenData.access_token;

    // Get user info from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    const githubUser = await userResponse.json();

    // Get user emails
    const emailsResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    const emails = await emailsResponse.json();
    const primaryEmail = emails.find(e => e.primary) || emails[0];

    // Find or create user
    let user = null;

    if (role === "candidate") {
      user = candidates.find(c => c.githubId === githubUser.id || c.email === primaryEmail?.email);

      if (!user) {
        user = {
          _id: `cand${candidates.length + 1}`,
          name: githubUser.name || githubUser.login,
          email: primaryEmail?.email || `${githubUser.login}@github.nomail`,
          githubId: githubUser.id,
          avatar: githubUser.avatar_url,
          githubUsername: githubUser.login
        };
        candidates.push(user);
      }
    } else {
      user = recruiters.find(r => r.githubId === githubUser.id || r.email === primaryEmail?.email);

      if (!user) {
        user = {
          _id: `rec${recruiters.length + 1}`,
          name: githubUser.name || githubUser.login,
          email: primaryEmail?.email || `${githubUser.login}@github.nomail`,
          githubId: githubUser.id,
          avatar: githubUser.avatar_url,
          githubUsername: githubUser.login,
          isVerified: false
        };
        recruiters.push(user);
      }
    }

    // Redirect to frontend with success
    res.redirect(`http://localhost:3000/login/${role}?github_success=true&user_id=${user._id}`);

  } catch (error) {
    console.error("GitHub OAuth error:", error);
    res.redirect("http://localhost:3000/login/candidate?error=oauth_failed");
  }
};