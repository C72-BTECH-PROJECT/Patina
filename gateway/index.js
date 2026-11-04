import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { requestIdMiddleware } from './requestId.js';
import { mountCors } from './cors.js';
import { mountHealth } from './health.js';
import { mountLimits } from './limits.js';
import { mountStatic } from './static.js';
import { createForwardAuth } from './forwardAuth.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function loadConfig(env = process.env) {
  return {
    PORT: env.PORT || '5000',
    CORE_URL: env.CORE_URL || 'http://localhost:5001',
    NLP_URL: env.NLP_URL || 'http://localhost:8000',
    GITHUB_EVIDENCE_URL: env.GITHUB_EVIDENCE_URL || 'http://localhost:8001',
    ASSESSMENT_URL: env.ASSESSMENT_URL || 'http://localhost:8002',
    FRONTEND_URL: env.FRONTEND_URL || 'http://localhost:3000',
    FRONTEND_BUILD_DIR: env.FRONTEND_BUILD_DIR,
    GLOBAL_RATE_LIMIT_MAX: env.GLOBAL_RATE_LIMIT_MAX || '300',
    GLOBAL_RATE_LIMIT_WINDOW_MS: env.GLOBAL_RATE_LIMIT_WINDOW_MS || '60000',
    AUTH_RATE_LIMIT_MAX: env.AUTH_RATE_LIMIT_MAX || '20',
    AUTH_RATE_LIMIT_WINDOW_MS: env.AUTH_RATE_LIMIT_WINDOW_MS || '900000',
    PASSWORD_RESET_RATE_LIMIT_MAX: env.PASSWORD_RESET_RATE_LIMIT_MAX || '5',
    PASSWORD_RESET_RATE_LIMIT_WINDOW_MS: env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS || '900000',
  };
}

export function createApp(config = {}) {
  const cfg = { ...loadConfig({}), ...config };
  const app = express();

  // 1. requestId
  app.use(requestIdMiddleware);

  // 2. CORS
  mountCors(app, cfg);

  // 3. /health
  mountHealth(app, cfg);

  // 4. rate limits
  mountLimits(app, cfg);

  // 5. public-route check + forward-auth
  const forwardAuth = createForwardAuth(cfg);
  app.use(forwardAuth);

  // 6. /api proxy
  const proxy = createProxyMiddleware({
    target: cfg.CORE_URL,
    changeOrigin: true,
    pathFilter: (pathname) => pathname.startsWith('/api'),
    on: {
      error: (err, req, res) => {
        if (!res.headersSent) {
          res.status(502).json({ error: 'upstream_unavailable', service: 'core' });
        }
      },
    },
  });
  app.use(proxy);

  // 7. static
  mountStatic(app, cfg);

  return app;
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '');
if (isMain) {
  const cfg = loadConfig();
  const app = createApp(cfg);
  const port = Number(cfg.PORT || 5000);
  app.listen(port, () => console.log(`gateway listening on ${port}`));
}