// Request context for the gateway: request id, one log line per request, and the
// JSON error contract (R-03, REBUILD/DECISIONS.md §9).
import { randomUUID } from 'node:crypto';

const VALID = /^[A-Za-z0-9-]{1,64}$/;

// Path only: query strings can carry tokens (e.g. reset links), so they are never logged.
const logPath = (req) => (req.originalUrl || req.url || '').split('?')[0];

export function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && VALID.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  // One line per request: id, method, path, status, latency. Never bodies or cookies.
  const start = process.hrtime.bigint();
  let logged = false;
  const log = (status) => {
    if (logged) return;
    logged = true;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[gateway] request_id=${id} ${req.method} ${logPath(req)} ${status} ${ms.toFixed(0)}ms`);
  };
  res.on('finish', () => log(res.statusCode));
  res.on('close', () => log(res.writableFinished ? res.statusCode : 'aborted'));
  next();
}

// ---------------------------------------------------------------------------
// Error contract: every error the gateway itself answers is
// { error, message, requestId }. Responses proxied from core pass through
// untouched (core follows the same contract).
// ---------------------------------------------------------------------------
const CODE_RE = /^[a-z][a-z0-9_]{0,63}$/;

const DEFAULTS = {
  400: ['bad_request', 'The request is not valid.'],
  401: ['unauthorized', 'You need to sign in.'],
  403: ['forbidden', 'You do not have access to this.'],
  404: ['not_found', 'Not found.'],
  413: ['payload_too_large', 'The request is too large.'],
  429: ['too_many_requests', 'Too many requests. Please wait and try again.'],
  500: ['internal_error', 'Something went wrong on our side. Please try again.'],
  502: ['upstream_unavailable', 'The server is not reachable right now. Please try again shortly.'],
  503: ['service_unavailable', 'The service is temporarily unavailable. Please try again.'],
  504: ['upstream_timeout', 'The server took too long to respond. Please try again.'],
};

// Fixed sentences for the codes the gateway's own middleware already uses.
const MESSAGES = {
  auth_unavailable: 'Sign-in could not be checked right now. Please try again shortly.',
  too_many_requests: 'Too many requests. Please wait and try again.',
};

const defaultsFor = (status) => {
  const d = DEFAULTS[status] || (status >= 500 ? DEFAULTS[500] : DEFAULTS[400]);
  return { error: d[0], message: d[1] };
};

/** Mount right after requestIdMiddleware: shapes every res.json with status >= 400. */
export function errorContract(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400) return json(body);
    const base = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const d = defaultsFor(res.statusCode);
    const error = typeof base.error === 'string' && CODE_RE.test(base.error) ? base.error : d.error;
    const message = typeof base.message === 'string' && base.message ? base.message : (MESSAGES[error] || d.message);
    return json({ ...base, error, message, requestId: req.requestId });
  };
  next();
}

/** JSON 404 for anything no other handler answered. */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'not_found', message: 'Not found.' });
}

/** Final error handler: JSON, never a stack trace or exception text. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const explicit = Number(err?.status ?? err?.statusCode);
  const status = Number.isInteger(explicit) && explicit >= 400 && explicit < 500 ? explicit : 500;
  console.error(`[gateway] request_id=${req.requestId || '-'} ${req.method} ${logPath(req)} -> ${status}: ${err?.name || 'Error'}: ${err?.message || err}`);
  if (status >= 500 && err?.stack) console.error(err.stack);
  if (res.headersSent) return next(err);
  const { error, message } = defaultsFor(status);
  return res.status(status).json({ error, message });
}

export { VALID };
