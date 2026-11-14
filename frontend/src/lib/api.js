// The one API client for the frontend (REBUILD/DECISIONS.md §8.1, card R-14).
// Every page and component talks to the backend through this file; nothing else
// builds an API URL or calls `fetch`.
//
// Usage:
//   import { api, ApiError, isNetworkError } from '../../lib/api';
//
//   const jobs = await api.get('/api/jobs');                   // parsed JSON body (null if empty)
//   await api.post('/api/jobs', { title, skills });            // plain object -> JSON body
//   await api.post('/api/resume/upload', formData);            // FormData -> multipart (browser sets the boundary)
//   await api.put(path, body); await api.patch(path, body); await api.del(path);
//   const { status, data } = await api.request('POST', path, body);   // when the success status matters (201 vs 202)
//   Options (last argument): { signal } to cancel, { headers } to add headers, { cache: 'no-store' }.
//
//   try { ... } catch (err) {
//     // Every failure is an ApiError: { status, error, message, requestId, body }
//     //   status     HTTP status, or 0 when no HTTP answer arrived
//     //   error      the backend's machine code (e.g. 'not_found', 'attempts_used'),
//     //              or one of the client's own codes below
//     //   message    a sentence safe to show the user
//     //   requestId  the backend's request id when it sent one, else null
//     //   body       the parsed error body (extra fields such as `code`, `fileKept`), or null
//     if (isNetworkError(err)) { /* server unreachable: show an error state, not an empty list */ }
//   }
//
// Client-side error codes (status 0 unless noted):
//   'network_error'    the request never got an HTTP answer (server down, CORS, offline)
//   'aborted'          the caller's AbortSignal cancelled the request; usually ignore it
//   'invalid_response' (any status) the server answered with a body that is not JSON
// An error answer without a JSON `error` field gets one by status: 'unauthorized' (401),
// 'forbidden' (403), 'not_found' (404), 'server_error' (5xx), 'request_failed' (other).
// Note: with the gateway up and core down, the gateway answers 502 'upstream_unavailable'
// (an ApiError with a status, not a network error). Any ApiError on a list load is an
// error state, never an empty list. Also exported: isAborted(err).
// R-33: a 504 or a dropped connection on apply, score-again, evaluate or reset is "Still
// working", not a failure: isStillWorking(err) and pollServerState(...) at the end of this file.
//
// Base URL: REACT_APP_API_BASE_URL, read once at build time by Create React App.
// The only default is the local gateway on port 5000 (gateway/index.js). Credentials
// (the session cookie) are always included.

// Not exported on purpose: pages pass paths, never full URLs.
const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

const NETWORK_MESSAGE = 'Could not reach the server. Check that it is running and try again.';
const ABORTED_MESSAGE = 'The request was cancelled.';
const INVALID_MESSAGE = 'The server sent a response that could not be read.';

export class ApiError extends Error {
  constructor({ status, error, message, requestId = null, body = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
    this.requestId = requestId;
    this.body = body;
  }
}

/** True when the request never reached the server (as opposed to an error the server sent). */
export const isNetworkError = (err) => err instanceof ApiError && err.error === 'network_error';

/** True when the caller cancelled the request through its AbortSignal. */
export const isAborted = (err) => err instanceof ApiError && err.error === 'aborted';

const isFormData = (body) => typeof FormData !== 'undefined' && body instanceof FormData;

// Fallback code and sentence for an error response without a usable JSON body.
const fallbackFor = (status) => {
  if (status === 401) return ['unauthorized', 'You need to sign in.'];
  if (status === 403) return ['forbidden', 'You do not have access to this.'];
  if (status === 404) return ['not_found', 'Not found.'];
  if (status >= 500) return ['server_error', `The server could not complete the request (status ${status}).`];
  return ['request_failed', `The request failed (status ${status}).`];
};

async function readBody(response) {
  const text = await response.text();
  if (!text) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

/**
 * Send one request. Resolves to { status, data } for a 2xx answer; throws an
 * ApiError for everything else.
 */
async function request(method, path, body, options = {}) {
  const { signal, headers: extraHeaders, cache } = options;
  const headers = { Accept: 'application/json', ...(extraHeaders || {}) };
  const init = { method, headers, credentials: 'include', signal };
  if (cache) init.cache = cache;

  if (body !== undefined && body !== null) {
    if (isFormData(body)) {
      init.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new ApiError({ status: 0, error: 'aborted', message: ABORTED_MESSAGE });
    }
    throw new ApiError({ status: 0, error: 'network_error', message: NETWORK_MESSAGE });
  }

  let parsed;
  try {
    parsed = await readBody(response);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new ApiError({ status: 0, error: 'aborted', message: ABORTED_MESSAGE });
    }
    throw new ApiError({ status: 0, error: 'network_error', message: NETWORK_MESSAGE });
  }

  if (response.ok) {
    if (!parsed.ok) {
      throw new ApiError({ status: response.status, error: 'invalid_response', message: INVALID_MESSAGE });
    }
    return { status: response.status, data: parsed.value };
  }

  const errBody = parsed.ok && parsed.value && typeof parsed.value === 'object' ? parsed.value : null;
  const [fallbackError, fallbackMessage] = fallbackFor(response.status);
  throw new ApiError({
    status: response.status,
    error: typeof errBody?.error === 'string' && errBody.error ? errBody.error : fallbackError,
    message: typeof errBody?.message === 'string' && errBody.message ? errBody.message : fallbackMessage,
    requestId: typeof errBody?.requestId === 'string' ? errBody.requestId : null,
    body: errBody,
  });
}

const dataOf = (promise) => promise.then((result) => result.data);

// ---------------------------------------------------------------------------
// R-33: "Still working" after a gateway timeout or a dropped connection.
//
// The gateway answers 504 `upstream_timeout` when core is silent for its proxy timeout
// (60 s; 130 s on evaluate), but core keeps working: the application, score, grade or
// reset can still be saved after that answer. So for apply, score-again, evaluate and the
// recruiter's reset, such an error is not shown as a failure. The page says "Still
// working" and reads the real state from the server every STILL_WORKING_POLL_MS for at
// most STILL_WORKING_LIMIT_MS, then shows what the server holds. Nothing is assumed:
// what is shown always comes from a read.
// ---------------------------------------------------------------------------

/** How often the real state is read while a page shows "Still working". */
export const STILL_WORKING_POLL_MS = 3000;
/** How long it is read before the page shows what the server holds (3 minutes). */
export const STILL_WORKING_LIMIT_MS = 180000;

/**
 * True when the request's outcome is unknown and may still complete on the server:
 * a gateway timeout (504) or a connection that dropped before any HTTP answer.
 */
export const isStillWorking = (err) =>
  err instanceof ApiError && (err.status === 504 || err.error === 'upstream_timeout' || err.error === 'network_error');

const wait = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new ApiError({ status: 0, error: 'aborted', message: ABORTED_MESSAGE }));
    return;
  }
  const onAbort = () => {
    clearTimeout(t);
    reject(new ApiError({ status: 0, error: 'aborted', message: ABORTED_MESSAGE }));
  };
  const t = setTimeout(() => {
    signal?.removeEventListener?.('abort', onAbort);
    resolve();
  }, ms);
  signal?.addEventListener?.('abort', onAbort, { once: true });
});

/**
 * Read the server's state until `isSettled(value)` or the time runs out.
 * The first read is immediate; then one read every `intervalMs`, while the elapsed
 * time plus one interval stays within `limitMs`. A read error does not stop it.
 * Resolves to:
 *   { settled: true,  value, hasValue: true,  error: null, reads }
 *   { settled: false, value (the last successful read, or undefined), hasValue,
 *     error (the last read's error, or null if the last read succeeded), reads }
 * Rejects only with an 'aborted' ApiError when `signal` aborts.
 * `now` and `sleep` are injectable for tests.
 */
export async function pollServerState(read, isSettled, {
  signal, intervalMs = STILL_WORKING_POLL_MS, limitMs = STILL_WORKING_LIMIT_MS,
  now = () => Date.now(), sleep = wait,
} = {}) {
  const started = now();
  let value;
  let hasValue = false;
  let error = null;
  let reads = 0;
  for (;;) {
    if (signal?.aborted) throw new ApiError({ status: 0, error: 'aborted', message: ABORTED_MESSAGE });
    try {
      const v = await read(signal);
      reads += 1;
      value = v;
      hasValue = true;
      error = null;
      if (isSettled(v)) return { settled: true, value: v, hasValue: true, error: null, reads };
    } catch (err) {
      if (isAborted(err) || signal?.aborted) throw new ApiError({ status: 0, error: 'aborted', message: ABORTED_MESSAGE });
      reads += 1;
      error = err;
    }
    if (now() - started + intervalMs > limitMs) {
      return { settled: false, value: hasValue ? value : undefined, hasValue, error, reads };
    }
    await sleep(intervalMs, signal);
  }
}

/** Whole seconds, for "checked for N s" texts. */
export const stillWorkingSeconds = (ms = STILL_WORKING_LIMIT_MS) => Math.round(ms / 1000);

export const api = {
  request,
  get: (path, options) => dataOf(request('GET', path, undefined, options)),
  post: (path, body, options) => dataOf(request('POST', path, body, options)),
  put: (path, body, options) => dataOf(request('PUT', path, body, options)),
  patch: (path, body, options) => dataOf(request('PATCH', path, body, options)),
  del: (path, options) => dataOf(request('DELETE', path, undefined, options)),
};

export default api;
