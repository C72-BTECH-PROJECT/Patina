import express from 'express';
import { analyzeResume, getCandidateAnalysis, getAllCandidates, getAllApplicants, getMyResumeStatus, uploadResume } from '../Controllers/analysis.controller.js';
import { requireRole } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

router.post('/analyze', requireRole('CANDIDATE'), analyzeResume);
router.get('/candidate-analysis', requireRole('CANDIDATE'), getCandidateAnalysis);
router.get('/candidates', requireRole('RECRUITER'), getAllCandidates);
router.get('/recruiter/applicants', requireRole('RECRUITER'), getAllApplicants);
router.get('/resume/status', requireRole('CANDIDATE'), getMyResumeStatus);
router.post('/resume/upload', requireRole('CANDIDATE'), uploadResume);

export default router;
