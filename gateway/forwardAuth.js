import http from 'node:http';
import { isPublicRoute } from './public-routes.js';

export function createForwardAuth(config) {
  const coreUrl = config.CORE_URL || 'http://localhost:5001';
  return async function forwardAuth(req, res, next) {
    if (req.method === 'GET' && req.path === '/api/auth/me') return next();

    if (!isPublicRoute(req.method, req.path)) {
      const cookieHeader = req.headers.cookie || '';
      const match = cookieHeader.match(/(?:^|;\s*)patina_session=([^;]+)/);
      if (!match) {
        return res.status(401).json({ source: 'gateway' });
      }
      const sessionValue = match[1];
      const url = new URL('/api/auth/me', coreUrl);
      const headers = { Cookie: `patina_session=${sessionValue}` };
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
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}