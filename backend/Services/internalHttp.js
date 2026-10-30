// JSON-over-HTTP for calls from core to internal services (T-0014).
//
// One helper so every internal call gets the same behaviour:
//   * a timeout (AbortController) over the whole call, both attempts and the body;
//   * one retry on connection errors only. A timeout or any HTTP answer is never
//     retried: the service did receive the request;
//   * the caller's X-Request-ID forwarded;
//   * typed errors that never carry the upstream body or URL (the lesson of
//     I-0036: core used to echo the NLP service's raw error text to the client).
//
// Used for github-evidence now; ROADMAP P2-1 reuses it for the NLP call.
import fetch from 'node-fetch';

export class InternalHttpError extends Error {
  /**
   * kind: 'timeout' | 'unreachable' | 'bad_status' | 'bad_body'
   * status: the HTTP status for bad_status / bad_body, else null
   * errorCode: the body's `error` field when it is a plain token (`^[a-z_]{1,64}$`),
   *   which is how internal services name an error; else null. Nothing else of
   *   the body is kept.
   */
  constructor(kind, { status = null, errorCode = null } = {}) {
    super(`internal call failed: ${kind}${status != null ? ` (HTTP ${status})` : ''}`);
    this.name = 'InternalHttpError';
    this.kind = kind;
    this.status = status;
    this.errorCode = errorCode;
  }
}

const RETRY_DELAY_MS = 100;
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE',
]);
const ERROR_CODE_RE = /^[a-z_]{1,64}$/;

const isConnectionError = (err) =>
  CONNECTION_ERROR_CODES.has(err?.code) ||
  CONNECTION_ERROR_CODES.has(err?.errno) ||
  /socket hang up/i.test(err?.message || '');

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });

const safeErrorCode = (text) => {
  try {
    const code = JSON.parse(text)?.error;
    return typeof code === 'string' && ERROR_CODE_RE.test(code) ? code : null;
  } catch {
    return null;
  }
};

/**
 * POST `body` as JSON to `url` and return the parsed 2xx JSON body.
 * Throws InternalHttpError on anything else.
 */
export async function postJson(url, body, { timeoutMs, requestId } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (requestId) headers['X-Request-ID'] = requestId;

  try {
    for (let attempt = 1; ; attempt += 1) {
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) throw new InternalHttpError('timeout');
        if (isConnectionError(err) && attempt === 1) {
          console.warn(`[internal-http] request_id=${requestId || '-'} connection error (${err.code || 'unknown'}); retrying once`);
          await sleep(RETRY_DELAY_MS, controller.signal);
          if (controller.signal.aborted) throw new InternalHttpError('timeout');
          continue;
        }
        throw new InternalHttpError('unreachable');
      }

      let text;
      try {
        text = await response.text();
      } catch {
        if (controller.signal.aborted) throw new InternalHttpError('timeout');
        throw new InternalHttpError('bad_body', { status: response.status });
      }

      if (!response.ok) {
        throw new InternalHttpError('bad_status', { status: response.status, errorCode: safeErrorCode(text) });
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new InternalHttpError('bad_body', { status: response.status });
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
