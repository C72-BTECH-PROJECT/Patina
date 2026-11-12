// R-03 (REBUILD/DECISIONS.md §9): one JSON error contract for core.
//
// Every error response is JSON shaped { error, message, requestId }:
//   error      a stable machine code (^[a-z][a-z0-9_]*$)
//   message    a fixed human sentence; never Supabase, NLP, upstream or exception text
//   requestId  the X-Request-ID of the request (the gateway's, or one core made)
// The detail behind an error goes to the server log only, tagged with the request id.
//
// Pieces, in the order backend/index.js mounts them:
//   errorContract     per request: a context (request id, database-timeout flag) and a
//                     res.json guard that fills in the contract for any status >= 400
//   ...routes...
//   notFoundHandler   JSON 404 for unknown routes
//   errorHandler      final handler: malformed JSON -> 400, database timeout -> 503,
//                     anything else -> 500; never a stack trace or exception text
// createHealthHandler builds GET /api/health from a database probe.
import { AsyncLocalStorage } from 'node:async_hooks';

const requestContext = new AsyncLocalStorage();

/** The current request's context, or null outside a request. */
export const currentRequestContext = () => requestContext.getStore() || null;

/**
 * Called by the Supabase fetch wrapper (Config/supabase.js) when a call hits its
 * timeout. Any error response of that request then becomes a 503 database_timeout.
 */
export function markDatabaseTimeout() {
  const ctx = currentRequestContext();
  if (ctx) ctx.databaseTimedOut = true;
}

const CODE_RE = /^[a-z][a-z0-9_]{0,63}$/;

export const DATABASE_TIMEOUT = Object.freeze({
  status: 503,
  error: 'database_timeout',
  message: 'The database did not respond in time. Please try again.',
});

const DEFAULTS = {
  400: ['bad_request', 'The request is not valid.'],
  401: ['unauthorized', 'You need to sign in.'],
  403: ['forbidden', 'You do not have access to this.'],
  404: ['not_found', 'Not found.'],
  405: ['method_not_allowed', 'This method is not allowed here.'],
  409: ['conflict', 'The request conflicts with the current state.'],
  413: ['payload_too_large', 'The request is too large.'],
  415: ['unsupported_media_type', 'This content type is not supported.'],
  422: ['unprocessable', 'The request could not be processed.'],
  429: ['too_many_requests', 'Too many requests. Please wait and try again.'],
  500: ['internal_error', 'Something went wrong on our side. Please try again.'],
  502: ['bad_gateway', 'A service this request depends on failed. Please try again.'],
  503: ['service_unavailable', 'The service is temporarily unavailable. Please try again.'],
  504: ['upstream_timeout', 'A service this request depends on did not respond in time.'],
};

const defaultsFor = (status) => {
  const d = DEFAULTS[status] || (status >= 500 ? DEFAULTS[500] : DEFAULTS[400]);
  return { error: d[0], message: d[1] };
};

/** Server-side description of an error: code, status, message, details, hint (no response ever sees it). */
export function describeError(err) {
  if (err == null) return 'unknown error';
  if (typeof err !== 'object') return String(err);
  const parts = [];
  if (err.name && err.name !== 'Error') parts.push(`name=${err.name}`);
  const code = err.code ?? err.statusCode;
  if (code != null && code !== '') parts.push(`code=${code}`);
  if (err.status != null) parts.push(`status=${err.status}`);
  if (err.message) parts.push(`message=${err.message}`);
  if (err.details) parts.push(`details=${err.details}`);
  if (err.hint) parts.push(`hint=${err.hint}`);
  return parts.join(' | ') || String(err);
}

/** Log an error with the request id. `detail` stays in the server log. */
export function logError(req, context, detail) {
  const id = req?.requestId || currentRequestContext()?.requestId || '-';
  console.error(`[core] request_id=${id} ${context}${detail !== undefined ? `: ${describeError(detail)}` : ''}`);
}

/**
 * Send a contract error: logs `cause` (if given) with the request id, answers
 * { error, message, requestId } (requestId is added by errorContract).
 */
export function sendError(req, res, { status, error, message, cause, context }) {
  if (cause !== undefined) {
    logError(req, `${context || `${req.method} ${req.path}`} -> ${status} ${error}`, cause);
    if (status >= 500 && cause instanceof Error && cause.stack) console.error(cause.stack);
  }
  return res.status(status).json({ error, message });
}

function shapeErrorBody(req, res, body) {
  if (req.context?.databaseTimedOut) {
    res.status(DATABASE_TIMEOUT.status);
    return { error: DATABASE_TIMEOUT.error, message: DATABASE_TIMEOUT.message, requestId: req.requestId };
  }
  const base = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const d = defaultsFor(res.statusCode);
  let { error } = base;
  if (typeof error !== 'string' || !CODE_RE.test(error)) {
    // A free-text `error` field is how raw Supabase/NLP text used to leak (I-0036).
    if (error !== undefined) logError(req, `dropped a non-code "error" field from a ${res.statusCode} response`, String(error).slice(0, 500));
    error = d.error;
  }
  const message = typeof base.message === 'string' && base.message ? base.message : d.message;
  return { ...base, error, message, requestId: req.requestId };
}

/** Mount right after the request-id middleware. */
export function errorContract(req, res, next) {
  const ctx = { requestId: req.requestId, databaseTimedOut: false };
  req.context = ctx;
  const json = res.json.bind(res);
  res.json = (body) => json(res.statusCode >= 400 ? shapeErrorBody(req, res, body) : body);
  requestContext.run(ctx, next);
}

/** JSON 404 for any route nothing else answered. */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'not_found', message: `Cannot ${req.method} ${req.path}` });
}

/** Final error handler (Express recognises it by its four parameters). */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    logError(req, `${req.method} ${req.path} failed after the response started`, err);
    return next(err);
  }
  let status;
  let error;
  let message;
  const explicit = Number(err?.status ?? err?.statusCode);
  if (err?.type === 'entity.parse.failed') {
    [status, error, message] = [400, 'invalid_json', 'The request body is not valid JSON.'];
  } else if (err?.type === 'entity.too.large') {
    [status, error, message] = [413, 'payload_too_large', 'The request body is too large.'];
  } else if (err?.code === 'SUPABASE_TIMEOUT' || req.context?.databaseTimedOut) {
    ({ status, error, message } = DATABASE_TIMEOUT);
  } else if (Number.isInteger(explicit) && explicit >= 400 && explicit < 500 && err?.expose !== false) {
    status = explicit;
    ({ error, message } = defaultsFor(explicit));
  } else {
    status = 500;
    ({ error, message } = defaultsFor(500));
  }
  if (status >= 500) {
    logError(req, `${req.method} ${req.path} -> ${status} ${error}`, err);
    if (err?.stack) console.error(err.stack);
  } else {
    logError(req, `${req.method} ${req.path} -> ${status} ${error}`, err?.type || err?.name || 'client error');
  }
  return res.status(status).json({ error, message });
}

/**
 * GET /api/health. `probe(signal)` resolves true when the database answered; it
 * gets `timeoutMs` (2 s) and an abort signal. HTTP 200 either way: core itself is
 * up; the body says `ok` or `degraded` and which check failed, never why.
 */
export function createHealthHandler({ probe, timeoutMs = 2000 }) {
  return async (req, res) => {
    const controller = new AbortController();
    let timer;
    let outcome;
    try {
      outcome = await Promise.race([
        Promise.resolve()
          .then(() => probe(controller.signal))
          .then((ok) => (ok === true ? 'ok' : 'failed'), () => 'failed'),
        new Promise((resolve) => {
          timer = setTimeout(() => { controller.abort(); resolve('timeout'); }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    if (outcome !== 'ok') logError(req, `health: database check ${outcome}`);
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      status: outcome === 'ok' ? 'ok' : 'degraded',
      checks: { database: outcome === 'ok' ? 'ok' : 'unavailable' },
      timestamp: new Date().toISOString(),
    });
  };
}
