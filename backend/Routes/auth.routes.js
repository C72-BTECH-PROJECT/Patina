import express from 'express';
import { signup, login, me, logout, resendConfirmation, updatePassword } from '../Controllers/auth.controller.js';
import { requireAuth } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/logout', logout);
router.post('/resend-confirmation', resendConfirmation);
router.post('/update-password', updatePassword);

export default router;
