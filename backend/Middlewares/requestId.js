// Shared request-ID middleware (moved here from analysis.controller.js in T-0031).
// Logs request_id, method, path, status, ms and client IP; echoes the ID.
import { randomUUID } from 'node:crypto';

const VALID = /^[A-Za-z0-9-]{1,64}$/;

export function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && VALID.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  req.headers['x-request-id'] = id;
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[core] request_id=${id} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms ${req.ip || req.socket?.remoteAddress}`);
  });
  res.setHeader('X-Request-ID', id);
  next();
}

export { VALID };