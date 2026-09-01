import express from 'express';
import {
  getAllJobs,
  getMyJobs,
  createJob,
} from '../Controllers/jobs.controller.js';
import { requireRole } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

router.get('/', requireRole('CANDIDATE', 'RECRUITER', 'ADMIN'), getAllJobs);
router.get('/mine', requireRole('RECRUITER'), getMyJobs);
router.post('/', requireRole('RECRUITER'), createJob);

export default router;

