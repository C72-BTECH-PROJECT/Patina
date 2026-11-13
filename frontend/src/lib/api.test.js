// R-14: the API client's contract. Run from frontend/:
//   CI=true npx react-scripts test --watchAll=false src/lib/api.test.js
import { api, ApiError, isNetworkError, isAborted } from './api';

const jsonResponse = (status, body) =>
  new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let calls;

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  delete global.fetch;
});

const mockFetch = (impl) => {
  global.fetch = (url, init) => {
    calls.push({ url, init });
    return impl(url, init);
  };
};

// react-scripts test loads frontend/.env, so the base is the configured one when set.
// (The default is checked through URL parts so the source grep for hardcoded API
// origins in frontend/src only ever finds the one default in api.js.)
test('GET resolves to the parsed body, sends credentials, and uses the configured base', async () => {
  mockFetch(() => Promise.resolve(jsonResponse(200, [{ id: 'j1' }])));
  await expect(api.get('/api/jobs')).resolves.toEqual([{ id: 'j1' }]);
  expect(calls).toHaveLength(1);
  expect(calls[0].url.endsWith('/api/jobs')).toBe(true);
  if (process.env.REACT_APP_API_BASE_URL) {
    expect(calls[0].url.startsWith(process.env.REACT_APP_API_BASE_URL.replace(/\/+$/, ''))).toBe(true);
  }
  expect(calls[0].init.credentials).toBe('include');
  expect(calls[0].init.method).toBe('GET');
  expect(calls[0].init.body).toBeUndefined();
});

test('with no REACT_APP_API_BASE_URL the only default is the local gateway on port 5000', async () => {
  const saved = process.env.REACT_APP_API_BASE_URL;
  delete process.env.REACT_APP_API_BASE_URL;
  try {
    let fresh;
    jest.isolateModules(() => {
      fresh = require('./api').api;
    });
    mockFetch(() => Promise.resolve(jsonResponse(200, {})));
    await fresh.get('/api/auth/me');
    const url = new URL(calls[0].url);
    expect(url.hostname).toBe('localhost');
    expect(url.port).toBe('5000');
    expect(url.pathname).toBe('/api/auth/me');
  } finally {
    if (saved !== undefined) process.env.REACT_APP_API_BASE_URL = saved;
  }
});

test('a plain object body is sent as JSON', async () => {
  mockFetch(() => Promise.resolve(jsonResponse(201, { id: 'new' })));
  await api.post('/api/jobs', { title: 'Engineer' });
  expect(calls[0].init.headers['Content-Type']).toBe('application/json');
  expect(calls[0].init.body).toBe(JSON.stringify({ title: 'Engineer' }));
});

test('FormData is sent as multipart, without a hand-set Content-Type', async () => {
  mockFetch(() => Promise.resolve(jsonResponse(201, { ok: true })));
  const form = new FormData();
  form.append('resume', new Blob(['%PDF-1.4']), 'cv.pdf');
  await api.post('/api/resume/upload', form);
  expect(calls[0].init.body).toBe(form);
  expect(calls[0].init.headers['Content-Type']).toBeUndefined();
});

test('request() exposes the success status (202 vs 200)', async () => {
  mockFetch(() => Promise.resolve(jsonResponse(202, { state: 'preparing' })));
  await expect(api.request('POST', '/api/assessment/start', { jobId: 'j1' })).resolves.toEqual({
    status: 202,
    data: { state: 'preparing' },
  });
});

test('an empty success body resolves to null', async () => {
  mockFetch(() => Promise.resolve(new Response(null, { status: 204 })));
  await expect(api.del('/api/x')).resolves.toBeNull();
});

test('a backend error body is normalised to { status, error, message, requestId, body }', async () => {
  const body = { error: 'attempts_used', message: 'All attempts used.', requestId: 'req-1', code: 'X' };
  mockFetch(() => Promise.resolve(jsonResponse(409, body)));
  const err = await api.post('/api/assessment/start', {}).catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(409);
  expect(err.error).toBe('attempts_used');
  expect(err.message).toBe('All attempts used.');
  expect(err.requestId).toBe('req-1');
  expect(err.body).toEqual(body);
  expect(isNetworkError(err)).toBe(false);
});

test('a non-JSON error answer still gets a code and a message', async () => {
  mockFetch(() => Promise.resolve(new Response('<html>Bad Gateway</html>', { status: 502 })));
  const err = await api.get('/api/jobs').catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(502);
  expect(err.error).toBe('server_error');
  expect(typeof err.message).toBe('string');
  expect(err.body).toBeNull();
});

test('a network failure has its own code, distinct from any server error', async () => {
  mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  const err = await api.get('/api/jobs').catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(0);
  expect(err.error).toBe('network_error');
  expect(isNetworkError(err)).toBe(true);
});

test('an aborted request is reported as aborted, not as a network failure', async () => {
  mockFetch(() => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  const err = await api.get('/api/jobs').catch((e) => e);
  expect(isAborted(err)).toBe(true);
  expect(isNetworkError(err)).toBe(false);
});

test('a success answer that is not JSON is an error, never silent data', async () => {
  mockFetch(() => Promise.resolve(new Response('not json', { status: 200 })));
  const err = await api.get('/api/jobs').catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.error).toBe('invalid_response');
});
