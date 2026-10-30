import express from 'express';
import { generateAssessment, evaluateAssessment } from '../Controllers/assessment.controller.js';
import { requireRole } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

// T-0017 (evaluate loop): candidates generate a technical assessment for a
// job, answer it, and submit it for server-side scoring.
router.post('/generate', requireRole('CANDIDATE'), generateAssessment);
router.post('/evaluate', requireRole('CANDIDATE'), evaluateAssessment);

export default router;
