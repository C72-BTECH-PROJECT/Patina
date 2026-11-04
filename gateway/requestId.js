import { randomUUID } from 'node:crypto';

const VALID = /^[A-Za-z0-9-]{1,64}$/;

export function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && VALID.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  console.log(`[gateway] request_id=${id} ${req.method} ${req.url}`);
  next();
}

export { VALID };