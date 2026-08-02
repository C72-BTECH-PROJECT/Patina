import crypto from "crypto";
import pool from '../config/pg.js';
import bcrypt from 'bcrypt';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "your_github_client_id";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "your_github_client_secret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "your_google_client_id";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "your_google_client_secret";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001";
const GITHUB_CALLBACK_URL = `${BACKEND_URL}/api/auth/github/callback`;
const GOOGLE_CALLBACK_URL = `${BACKEND_URL}/api/auth/google/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const SESSION_COOKIE_NAME = "patina_session";

const isValidRole = (role) => role === "candidate" || role === "recruiter";
const isOAuthConfigured = (clientId, clientSecret) =>
  !String(clientId).startsWith("your_") && !String(clientSecret).startsWith("your_");


const getStoreByRole = (role) => roleStores[role]?.list || null;

const sanitizeUser = (user, role) => {
  const { password, ...safeUser } = user;
  return { ...safeUser, role };
};

export const me = (req, res) => {
  // Passport automatically populates req.user if the session cookie is valid
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Sanitize password before sending to frontend
  const { password, ...safeUser } = req.user;
  return res.json({ user: safeUser });
};

export const logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    // express-session handles clearing the cookie
    res.json({ message: "Logged out successfully" });
  });
};

export const login = (req, res) => {
  const { role, email, password } = req.body;

  if (!isValidRole(role)) {
    return res.status(400).json({ message: "Role must be candidate or recruiter" });
  }

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const store = getStoreByRole(role);
  const user = store.find((entry) => entry.email === email && entry.password === password);
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials for selected role" });
  }

  createSession(res, user._id, role);
  return res.json({
    message: "Login successful",
    user: sanitizeUser(user, role),
  });
};

export const signup = async (req, res) => {
  const { role, email, password, name } = req.body;
  const upperRole = role ? role.toUpperCase() : 'CANDIDATE';

  if (!email || !password || !name) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  try {
    // 1. Check if user exists
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Account already exists with this email" });
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Insert into PostgreSQL
    const newUser = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, upperRole]
    );

    // 4. Log the user in immediately after signup using Passport
    req.login(newUser.rows[0], (err) => {
      if (err) return res.status(500).json({ message: "Error establishing session" });
      return res.status(201).json({
        message: "Signup successful",
        user: newUser.rows[0],
      });
    });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};