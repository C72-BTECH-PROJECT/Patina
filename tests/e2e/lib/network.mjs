// R-19: read what the page itself received from the API, so the specs can compare the numbers a
// page shows with the response that carried them, and scan the bodies for answer-key fields.
// Observation only: nothing here intercepts, changes or fakes a request (no page.route).

/** Path of a response URL ('/api/jobs/123/apply'), or '' when it cannot be parsed. */
export const pathOf = (url) => {
  try { return new URL(url).pathname; } catch { return ''; }
};

/**
 * A predicate for page.waitForResponse: method plus a pathname regex (anchored by the caller).
 *   apiResponse('POST', /^\/api\/jobs$/)
 */
export const apiResponse = (method, pathRe) => (res) =>
  res.request().method() === method && pathRe.test(pathOf(res.url()));

/**
 * Run `action` and return the first response matching (method, pathRe) that it caused, with
 * its parsed JSON body: { res, status, body }. The wait starts before the action, so a fast
 * answer is never missed.
 */
export async function actAndWait(page, method, pathRe, action, { timeout } = {}) {
  const [res] = await Promise.all([
    page.waitForResponse(apiResponse(method, pathRe), timeout ? { timeout } : undefined),
    action(),
  ]);
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { res, status: res.status(), body };
}

/**
 * Record every API response a browser context receives (all its pages, across reloads):
 * { url, path, method, status, body, bodyError }. `settle()` waits until every body read
 * that has started has finished. A body that could not be read is kept with `bodyError`,
 * never dropped, so a scan can refuse to call an unread body clean.
 */
export function recordApiResponses(context, { pathPrefix = '/api/' } = {}) {
  const entries = [];
  const pending = [];
  const onResponse = (res) => {
    const method = res.request().method();
    const path = pathOf(res.url());
    if (method === 'OPTIONS' || !path.startsWith(pathPrefix)) return;
    const entry = { url: res.url(), path, method, status: res.status(), body: undefined, bodyError: null };
    entries.push(entry);
    pending.push(res.text().then(
      (text) => {
        if (!text) { entry.body = null; return; }
        try { entry.body = JSON.parse(text); } catch { entry.bodyError = 'not JSON'; }
      },
      (err) => { entry.bodyError = String(err?.message || err).split('\n')[0]; },
    ));
  };
  context.on('response', onResponse);
  return {
    entries,
    settle: () => Promise.all(pending),
    stop: () => context.off('response', onResponse),
  };
}

// Field names that would mean answer-key material reached the candidate (D§6.2, R-17).
export const ANSWER_KEY_FIELDS = Object.freeze([
  'correct_option', 'correct_answer', 'ideal_answer', 'key_points', 'recruiter_feedback', 'answer_key',
]);

/** Every place in `value` where an object key is one of `fields`: ['$.results[0].ideal_answer', ...]. */
export function findFieldNames(value, fields = ANSWER_KEY_FIELDS, path = '$', out = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => findFieldNames(v, fields, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (fields.includes(k)) out.push(`${path}.${k}`);
      findFieldNames(v, fields, `${path}.${k}`, out);
    }
  }
  return out;
}
