import express from 'express';
import {
  evaluateAssessment,
  generateAssessment,
  getAssessmentStatus,
  getAttemptsForRecruiter,
  resetAssessment,
  saveAnswers,
  startAssessment,
} from '../Controllers/assessment.controller.js';
import { requireRole } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

// R-11 (D§0 A1): the pool is prepared in the background; no route waits on the LLM
// for questions. Only evaluate may wait on grading.
router.get('/status', requireRole('CANDIDATE'), getAssessmentStatus);
router.post('/start', requireRole('CANDIDATE'), startAssessment);
// Alias of /start, kept so the current Assessment.jsx call never hangs (it used to
// block on generation for minutes). R-17 moves the page to /status and /start.
router.post('/generate', requireRole('CANDIDATE'), generateAssessment);
router.post('/evaluate', requireRole('CANDIDATE'), evaluateAssessment);
// R-12: saved answers, attempt reset (D§6.2), and the recruiter's attempt read.
router.put('/:id/answers', requireRole('CANDIDATE'), saveAnswers);
router.post('/:id/reset', requireRole('RECRUITER', 'ADMIN'), resetAssessment);
router.get('/attempts', requireRole('RECRUITER', 'ADMIN'), getAttemptsForRecruiter);

export default router;
