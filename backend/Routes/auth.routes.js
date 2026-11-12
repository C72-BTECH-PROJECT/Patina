import express from 'express';
import {
  signup,
  login,
  me,
  session,
  logout,
  resendConfirmation,
  requestPasswordReset,
  resetPassword,
} from '../Controllers/auth.controller.js';
import { requireAuth } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, me);
// R-04: the gateway's pre-check. In-memory session only, no Supabase call.
router.get('/session', session);
router.post('/logout', logout);
router.post('/resend-confirmation', resendConfirmation);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

export default router;
