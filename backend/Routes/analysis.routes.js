import express from 'express';
import { analyzeResume, getCandidateAnalysis } from '../Controllers/analysis.controller.js';

const router = express.Router();

router.post('/analyze', analyzeResume);
router.get('/candidate-analysis', getCandidateAnalysis);

export default router;

