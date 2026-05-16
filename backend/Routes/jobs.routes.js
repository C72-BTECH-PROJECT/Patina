import express from 'express';
import {
  getAllJobs,
  createJob,
} from '../Controllers/jobs.controller.js';

const router = express.Router();

router.get('/', getAllJobs);
router.post('/', createJob);

export default router;

