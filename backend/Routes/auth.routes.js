import express from "express";
import passport from "passport";
import { signup, login, me, logout } from "../Controllers/auth.controller.js";
import { requireAuth } from "../Middlewares/auth.Middleware.js";

const router = express.Router();

// Must match the port your frontend dev server actually runs on.
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// --- Local Auth ---
router.post("/signup", signup);
router.post("/login", login);

// --- Session Verification & Logout ---
router.get("/me", requireAuth, me);
router.post("/logout", logout);

// --- Google OAuth ---
// Passing 'state' allows frontend to indicate if user is logging in as 'candidate' or 'recruiter'
router.get("/google", (req, res, next) => {
  const role = req.query.role || "candidate";
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: JSON.stringify({ role }),
  })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    // Redirect based on role
    const dashboard = req.user.role === "RECRUITER" ? "/recruiter/dashboard" : "/candidate/dashboard";
    res.redirect(`${FRONTEND_URL}${dashboard}`);
  }
);

// --- GitHub OAuth ---
router.get("/github", (req, res, next) => {
  const role = req.query.role || "candidate";
  passport.authenticate("github", {
    scope: ["user:email"],
    state: JSON.stringify({ role }),
  })(req, res, next);
});

router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: "/login" }),
  (req, res) => {
    const dashboard = req.user.role === "RECRUITER" ? "/recruiter/dashboard" : "/candidate/dashboard";
    res.redirect(`${FRONTEND_URL}${dashboard}`);
  }
);

export default router;