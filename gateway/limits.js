import rateLimit from 'express-rate-limit';
import { normalizePath } from './public-routes.js';

// R-04 (D§2):
// - login + signup count FAILED answers only (status >= 400; express-rate-limit's
//   skipSuccessfulRequests), so one laptop switching demo accounts cannot lock
//   itself out; 20 failures per 15 min per IP, configurable.
// - the password-reset request always answers 200 (it must not reveal whether an
//   account exists), so it counts every request: 5 per 15 min per IP.
// - paths are matched in core's normalised form (case-insensitive, trailing slash
//   ignored), so /api/auth/Login and /api/auth/login/ share the login limit.
const isAuthMe = (req) => normalizePath(req.path) === '/api/auth/me';

export function mountLimits(app, config) {
  const authMax = Number(config.AUTH_RATE_LIMIT_MAX || 20);
  const authWindow = Number(config.AUTH_RATE_LIMIT_WINDOW_MS || 900000);
  const resetMax = Number(config.PASSWORD_RESET_RATE_LIMIT_MAX || 5);
  const resetWindow = Number(config.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS || 900000);
  const globalMax = Number(config.GLOBAL_RATE_LIMIT_MAX || 300);
  const globalWindow = Number(config.GLOBAL_RATE_LIMIT_WINDOW_MS || 60000);

  const authLimiter = rateLimit({
    windowMs: authWindow,
    max: authMax,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'too_many_requests' },
  });

  const resetLimiter = rateLimit({
    windowMs: resetWindow,
    max: resetMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
  });

  const globalLimiter = rateLimit({
    windowMs: globalWindow,
    max: globalMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isAuthMe,
    message: { error: 'too_many_requests' },
  });

  app.use((req, res, next) => {
    const p = normalizePath(req.path);
    if (p === '/api/auth/request-password-reset') return resetLimiter(req, res, next);
    if (p === '/api/auth/login' || p === '/api/auth/signup') return authLimiter(req, res, next);
    next();
  });

  app.use(globalLimiter);
}
