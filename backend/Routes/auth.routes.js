import express from "express";
import {
  login,
  signup,
  githubAuth,
  githubCallback,
  googleAuth,
  googleCallback,
  me,
  logout,
} from "../Controllers/auth.controller.js";

const router = express.Router();

router.post("/login", login);
router.post("/signup", signup);
router.get("/me", me);
router.post("/logout", logout);
router.get("/github", githubAuth);
router.get("/github/callback", githubCallback);
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

export default router;