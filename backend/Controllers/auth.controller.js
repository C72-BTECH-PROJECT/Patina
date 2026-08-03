import crypto from "crypto";
import pool from '../config/pg.js';
import bcrypt from 'bcrypt';
import passport from "passport";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "your_github_client_id";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "your_github_client_secret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "your_google_client_id";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "your_google_client_secret";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001";
const GITHUB_CALLBACK_URL = `${BACKEND_URL}/api/auth/github/callback`;
const GOOGLE_CALLBACK_URL = `${BACKEND_URL}/api/auth/google/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const SESSION_COOKIE_NAME = "patina_session";

// Helper to ensure unified users table exists
export const initAuthTables = async () => {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255),
      role VARCHAR(20) NOT NULL DEFAULT 'CANDIDATE' CHECK (role IN ('CANDIDATE', 'RECRUITER')),
      google_id VARCHAR(255) UNIQUE,
      github_id VARCHAR(255) UNIQUE,
      github_access_token TEXT,
      company_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(createUsersTable);
  } catch (err) {
    console.error("Error initializing users table:", err);
  }
};

// Initialize table on startup
initAuthTables();

// Helper to remove sensitive fields
const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, github_access_token, ...safeUser } = user;
  return safeUser;
};

const ALLOWED_ROLES = ["CANDIDATE", "RECRUITER"];

// 1. Get Logged-in Session User (/api/auth/me)
export const me = async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  return res.status(200).json({
    user: sanitizeUser(req.user),
  });
};

// 2. Logout (/api/auth/logout)
export const logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        return res.status(500).json({ message: "Could not log out session" });
      }
      res.clearCookie("patina_session");
      return res.status(200).json({ message: "Logged out successfully" });
    });
  });
};

// 3. Local Registration (/api/auth/signup)
export const signup = async (req, res) => {
  const { role, email, password, name, companyName } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const formattedRole = role ? role.toUpperCase() : "CANDIDATE";

  if (!ALLOWED_ROLES.includes(formattedRole)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  try {
    // Check existing email
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: "Account already exists with this email" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const newUser = await pool.query(
      `INSERT INTO users (name, email, password, role, company_name) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, role, company_name, created_at`,
      [name, email, hashedPassword, formattedRole, companyName || null]
    );

    const createdUser = newUser.rows[0];

    // Establish session immediately
    req.login(createdUser, (err) => {
      if (err) {
        return res.status(500).json({ message: "Account created, but failed to establish session" });
      }
      return res.status(201).json({
        message: "Signup successful",
        user: sanitizeUser(createdUser),
      });
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Internal server error during signup" });
  }
};

// 4. Local Login (/api/auth/login)
export const login = (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: "Internal server error during login" });
    }

    if (!user) {
      return res.status(401).json({ message: info?.message || "Invalid credentials" });
    }

    req.login(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ message: "Failed to establish login session" });
      }

      return res.status(200).json({
        message: "Login successful",
        user: sanitizeUser(user),
      });
    });
  })(req, res, next);
};