import express from 'express';
import {
  getAllJobs,
  getMyJobs,
  createJob,
  getJobById,
  applyToJob,
  getAllApplications,
  shortlistCandidate,
} from '../Controllers/jobs.controller.js';
import { requireRole } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

router.get('/', requireRole('CANDIDATE', 'RECRUITER', 'ADMIN'), getAllJobs);
router.get('/mine', requireRole('RECRUITER'), getMyJobs);
router.post('/', requireRole('RECRUITER'), createJob);
router.get('/applications', requireRole('RECRUITER'), getAllApplications);
router.post('/applications/shortlist', requireRole('RECRUITER'), shortlistCandidate);
// Must come after specific routes so Express does not treat "mine"/"applications" as an :id
router.get('/:id', requireRole('CANDIDATE', 'RECRUITER', 'ADMIN'), getJobById);
router.post('/:id/apply', requireRole('CANDIDATE'), applyToJob);

export default router;
