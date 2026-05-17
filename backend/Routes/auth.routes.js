import express from "express";
import { login, signup, githubAuth, githubCallback } from "../Controllers/auth.controller.js";

const router = express.Router();

router.post("/login", login);
router.post("/signup", signup);
router.get("/github", githubAuth);
router.get("/github/callback", githubCallback);

export default router;