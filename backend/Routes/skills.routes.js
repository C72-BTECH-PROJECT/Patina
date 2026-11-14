import express from 'express';
import { extractSkills, searchSkills } from '../Controllers/skills.controller.js';
import { requireRole } from '../Middlewares/auth.Middleware.js';

// R-32: the job form's skill search and description suggestions. Recruiter-only.
const router = express.Router();

router.get('/', requireRole('RECRUITER'), searchSkills);
router.post('/extract', requireRole('RECRUITER'), extractSkills);

export default router;
