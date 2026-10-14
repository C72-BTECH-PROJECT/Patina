import express from 'express';
import {
  signup,
  login,
  me,
  logout,
  resendConfirmation,
  requestPasswordReset,
  resetPassword,
} from '../Controllers/auth.controller.js';
import { requireAuth } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

// Minimal in-memory per-IP rate limiter. Good enough for a single-instance
// deployment; replace with a shared store (Redis) if this ever runs multi-node.
const createRateLimiter = ({ windowMs, max, message }) => {
  const hits = new Map();

  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message });
    }

    return next();
  };
};

const passwordResetRequestLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please wait a few minutes and try again.',
});

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/logout', logout);
router.post('/resend-confirmation', resendConfirmation);
router.post('/request-password-reset', passwordResetRequestLimiter, requestPasswordReset);
router.post('/reset-password', resetPassword);

export default router;
