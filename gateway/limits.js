import rateLimit from 'express-rate-limit';

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
    skip: (req) => req.path === '/api/auth/me',
    message: { error: 'too_many_requests' },
  });

  const resetLimiter = rateLimit({
    windowMs: resetWindow,
    max: resetMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/auth/me',
    message: { error: 'too_many_requests' },
  });

  const globalLimiter = rateLimit({
    windowMs: globalWindow,
    max: globalMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/auth/me',
    message: { error: 'too_many_requests' },
  });

  app.use((req, res, next) => {
    const p = req.path;
    if (p === '/api/auth/request-password-reset') return resetLimiter(req, res, next);
    if (p === '/api/auth/login' || p === '/api/auth/signup') return authLimiter(req, res, next);
    next();
  });

  app.use(globalLimiter);
}