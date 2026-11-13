import express from 'express';
import {
  getCandidateAnalysis,
  getMyResumeStatus,
  uploadResume,
  getCandidateResume,
  rescoreApplication,
  getApplicationResult,
  listRecruiterApplications,
  getRecruiterApplication,
} from '../Controllers/analysis.controller.js';
import { requireRole } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

// R-10 (Y1): POST /analyze is removed; scoring runs on apply and on score-again.
router.get('/candidate-analysis', requireRole('CANDIDATE'), getCandidateAnalysis);
// R-13 (Y2): one recruiter applications API. GET /candidates and
// GET /recruiter/applicants are removed (404).
router.get('/recruiter/applications', requireRole('RECRUITER'), listRecruiterApplications);
router.get('/recruiter/applications/:id', requireRole('RECRUITER'), getRecruiterApplication);
router.get('/resume/status', requireRole('CANDIDATE'), getMyResumeStatus);
router.post('/resume/upload', requireRole('CANDIDATE'), uploadResume);
router.get('/resume/candidate/:candidateId', requireRole('RECRUITER'), getCandidateResume);
// The owning candidate or the job's recruiter; ownership is checked in the handler.
router.post('/applications/:id/score', requireRole('CANDIDATE', 'RECRUITER'), rescoreApplication);
// R-16: the owning candidate's result for one application (404 for anyone else's).
router.get('/applications/:id/result', requireRole('CANDIDATE'), getApplicationResult);

export default router;
