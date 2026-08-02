import express from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import pool from "../Config/pg.js";
import { githubAuth, githubCallback } from "../Controllers/auth.controller.js";

const router = express.Router();

// Local Signup
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const insertRes = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    res.status(201).json({ message: "Signup successful", user: insertRes.rows[0] });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Local Login
router.post("/login", (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
    
    req.logIn(user, (err) => {
      if (err) return next(err);
      res.json({ message: "Login successful", user: { id: user.id, name: user.name, email: user.email } });
    });
  })(req, res, next);
});

// Logout
router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ message: "Logged out successfully" });
  });
});

// Current User Session
router.get("/me", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

// Google OAuth
router.get('/google', (req, res, next) => {
  const state = req.query.role || 'candidate';
  passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
});

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: 'http://localhost:3000/select-role?error=google_failed' }),
  (req, res) => {
    const role = req.query.state || 'candidate';
    res.redirect(`http://localhost:3000/login/${role}?google_success=true&user_id=${req.user.id}`);
  }
);

// GitHub OAuth
router.get('/github', (req, res, next) => {
  const state = req.query.role || 'candidate';
  passport.authenticate('github', { scope: ['user:email'], state })(req, res, next);
});

router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: 'http://localhost:3000/select-role?error=github_failed' }),
  (req, res) => {
    const role = req.query.state || 'candidate';
    res.redirect(`http://localhost:3000/login/${role}?github_success=true&user_id=${req.user.id}`);
  }
);

export default router;