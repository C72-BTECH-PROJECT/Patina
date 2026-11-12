import http from 'node:http';
import { isPublicRoute, normalizePath } from './public-routes.js';

// R-04 (D§2): the session pre-check calls core's GET /api/auth/session, which
// answers from core's in-memory session store only (no database call). A slow
// database therefore cannot turn every request into a 503 here. Core remains the
// enforcement point: on the real request it still checks that the profile exists
// and is not suspended (backend/Middlewares/auth.Middleware.js requireAuth).
const SESSION_CHECK_PATH = '/api/auth/session';

export function createForwardAuth(config) {
  const coreUrl = config.CORE_URL || 'http://127.0.0.1:5001';
  return async function forwardAuth(req, res, next) {
    const p = normalizePath(req.path);
    // Core answers these two itself (401 without a session); a pre-check adds nothing.
    if (req.method === 'GET' && (p === '/api/auth/me' || p === SESSION_CHECK_PATH)) return next();

    if (!isPublicRoute(req.method, req.path)) {
      const cookieHeader = req.headers.cookie || '';
      const match = cookieHeader.match(/(?:^|;\s*)patina_session=([^;]+)/);
      if (!match) {
        return res.status(401).json({ source: 'gateway' });
      }
      const sessionValue = match[1];
      const url = new URL(SESSION_CHECK_PATH, coreUrl);
      // Only the session cookie and the request id go to core.
      const headers = { Cookie: `patina_session=${sessionValue}` };
      if (req.requestId) headers['X-Request-ID'] = req.requestId;
      let status;
      try {
        status = await checkAuth(url, headers, 2000);
      } catch {
        status = 0;
      }
      if (status === 200) {
        // proceed
      } else if (status === 401) {
        return res.status(401).json({ source: 'gateway' });
      } else if (status === 403) {
        // pass through to proxy
      } else {
        return res.status(503).json({ error: 'auth_unavailable' });
      }
    }
    next();
  };
}

function checkAuth(url, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'GET', headers, timeout: timeoutMs }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}
