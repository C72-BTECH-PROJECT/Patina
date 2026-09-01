import express from 'express';
import { getOverview, getUsers, updateSuspension } from '../Controllers/admin.controller.js';
import { requireRole } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

router.use(requireRole('ADMIN'));
router.get('/overview', getOverview);
router.get('/users', getUsers);
router.patch('/users/:userId/suspension', updateSuspension);

export default router;
