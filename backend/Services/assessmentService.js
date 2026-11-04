// Core's client for assessment-service (T-0031, I-0062).
//
//   ASSESSMENT_SERVICE_URL  default http://localhost:8002, read on every call
//
// Both calls go through postJson, so they get the request id, one retry on a
// connection error, and errors that never carry the upstream body (I-0036).
import { postJson } from './internalHttp.js';

const DEFAULT_URL = 'http://localhost:8002';

// T-0027: a free-tier LLM needs 2-4 minutes; a 120 s abort cut slow generations
// with a misleading 502.
export const GENERATE_TIMEOUT_MS = 300000;
export const EVALUATE_TIMEOUT_MS = 120000;

const serviceUrl = (path) => `${(process.env.ASSESSMENT_SERVICE_URL || DEFAULT_URL).replace(/\/+$/, '')}${path}`;

export const generateAssessment = (payload, { requestId, timeoutMs = GENERATE_TIMEOUT_MS } = {}) =>
  postJson(serviceUrl('/generate-assessment'), payload, { requestId, timeoutMs });

export const evaluateAnswers = (payload, { requestId, timeoutMs = EVALUATE_TIMEOUT_MS } = {}) =>
  postJson(serviceUrl('/evaluate-assessment'), payload, { requestId, timeoutMs });

const UNAVAILABLE_MESSAGE = 'Assessment service is unavailable. Start it (assessment-service) and try again.';

/**
 * The client answer for an InternalHttpError: always a 502, never the upstream body.
 * `failedMessage` is for an HTTP error from the service; `unavailableMessage` is for
 * a timeout or a connection failure.
 */
export const assessmentFailure = (err, failedMessage, unavailableMessage = UNAVAILABLE_MESSAGE) => {
  if (err.kind === 'bad_status') return { status: 502, body: { message: failedMessage } };
  if (err.kind === 'bad_body') {
    return { status: 502, body: { message: 'Assessment service returned an unexpected payload. Please retry.' } };
  }
  return { status: 502, body: { message: unavailableMessage } };
};
