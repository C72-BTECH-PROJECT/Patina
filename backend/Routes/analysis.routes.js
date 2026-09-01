import express from 'express';
import { analyzeResume, getCandidateAnalysis, getAllCandidates } from '../Controllers/analysis.controller.js';
import { requireRole } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

router.post('/analyze', requireRole('CANDIDATE'), analyzeResume);
router.get('/candidate-analysis', requireRole('CANDIDATE'), getCandidateAnalysis);
router.get('/candidates', requireRole('RECRUITER'), getAllCandidates);

export default router;
