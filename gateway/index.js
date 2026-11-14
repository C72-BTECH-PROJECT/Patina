import express from 'express';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { errorContract, errorHandler, notFoundHandler, requestIdMiddleware } from './requestId.js';
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
    // Core binds 127.0.0.1 only (R-02); the literal address avoids "localhost" resolving to ::1.
    CORE_URL: env.CORE_URL || 'http://127.0.0.1:5001',
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
    // R-03 proxy timeouts (ms of upstream silence before the gateway answers 504).
    // Each sits just above core's own budget for that route, so core's JSON error
    // arrives first whenever core is alive: assessment generation 300 s
    // (backend/Services/assessmentService.js) -> 310 s; grading 120 s -> 130 s;
    // everything else (parse + score, Supabase calls at 10 s each) -> 60 s.
    PROXY_TIMEOUT_MS: env.PROXY_TIMEOUT_MS || '60000',
    PROXY_TIMEOUT_GENERATE_MS: env.PROXY_TIMEOUT_GENERATE_MS || '310000',
    PROXY_TIMEOUT_EVALUATE_MS: env.PROXY_TIMEOUT_EVALUATE_MS || '130000',
  };
}

function createCoreProxy(cfg, timeoutMs) {
  return createProxyMiddleware({
    target: cfg.CORE_URL,
    changeOrigin: true,
    proxyTimeout: timeoutMs,
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.on('timeout', () => { req.gatewayProxyTimedOut = true; });
      },
      error: (err, req, res) => {
        // `res` is a socket for upgrade requests; only answer real HTTP responses.
        if (typeof res?.status !== 'function') { res?.destroy?.(); return; }
        if (res.headersSent) { res.destroy(); return; }
        if (req.gatewayProxyTimedOut) {
          // R-33: the gateway stopped waiting, but core did not stop working: an apply,
          // score or grade can still complete and be saved after this answer. The body
          // says so, so a client reads the real state instead of reporting a failure.
          console.error(`[gateway] request_id=${req.requestId || '-'} core did not answer within ${timeoutMs} ms`);
          res.status(504).json({
            error: 'upstream_timeout',
            message: 'The server did not answer in time, but it may still be completing this request. Check the current state before trying again.',
            service: 'core',
            may_still_complete: true,
          });
          return;
        }
        console.error(`[gateway] request_id=${req.requestId || '-'} core unreachable: ${err?.code || err?.message || 'error'}`);
        res.status(502).json({
          error: 'upstream_unavailable',
          message: 'The server is not reachable right now. Please try again shortly.',
          service: 'core',
        });
      },
    },
  });
}

export function createApp(config = {}) {
  const cfg = { ...loadConfig({}), ...config };
  const app = express();
  app.disable('x-powered-by');

  // 1. requestId (+ one log line per request) and the JSON error contract
  app.use(requestIdMiddleware);
  app.use(errorContract);

  // 1b. security headers (D§10). helmet defaults, except upgrade-insecure-requests:
  // the demo runs on plain http://localhost (D§10), where it would break a build
  // served from FRONTEND_BUILD_DIR.
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));

  // 2. CORS
  mountCors(app, cfg);

  // 3. /health
  mountHealth(app, cfg);

  // 4. rate limits
  mountLimits(app, cfg);

  // 5. public-route check + forward-auth
  const forwardAuth = createForwardAuth(cfg);
  app.use(forwardAuth);

  // 6. /api proxy, with a per-route timeout (see loadConfig)
  const proxies = {
    generate: createCoreProxy(cfg, Number(cfg.PROXY_TIMEOUT_GENERATE_MS)),
    evaluate: createCoreProxy(cfg, Number(cfg.PROXY_TIMEOUT_EVALUATE_MS)),
    standard: createCoreProxy(cfg, Number(cfg.PROXY_TIMEOUT_MS)),
  };
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) return next();
    const p = req.path.toLowerCase().replace(/\/+$/, '');
    if (p === '/api/assessment/generate') return proxies.generate(req, res, next);
    if (p === '/api/assessment/evaluate') return proxies.evaluate(req, res, next);
    return proxies.standard(req, res, next);
  });

  // 7. static
  mountStatic(app, cfg);

  // 8. JSON 404 and the final JSON error handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '');
if (isMain) {
  const cfg = loadConfig();
  const app = createApp(cfg);
  const port = Number(cfg.PORT || 5000);
  app.listen(port, () => console.log(`gateway listening on ${port}`));
}
