import express from 'express';
import { analyzeResume, getCandidateAnalysis, getAllCandidates } from '../Controllers/analysis.controller.js';

const router = express.Router();

router.post('/analyze', analyzeResume);
router.get('/candidate-analysis', getCandidateAnalysis);
router.get('/candidates', getAllCandidates);

export default router;
