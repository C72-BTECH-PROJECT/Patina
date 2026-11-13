import { ApiError } from '../lib/api';
import { checkSession } from './sessionCheck';

const fail = (fields) => () => Promise.reject(new ApiError({ message: 'x', ...fields }));

describe('checkSession: what a /api/auth/me answer means', () => {
  test('a 200 with a user is signed in', async () => {
    const user = { id: 'u1', role: 'CANDIDATE' };
    await expect(checkSession(() => Promise.resolve({ user }))).resolves.toEqual({ status: 'signed_in', user });
  });

  test('401 (no session) and 403 (suspended) are signed out', async () => {
    await expect(checkSession(fail({ status: 401, error: 'unauthorized' }))).resolves.toEqual({ status: 'signed_out', user: null });
    await expect(checkSession(fail({ status: 403, error: 'forbidden', body: { code: 'ACCOUNT_SUSPENDED' } })))
      .resolves.toEqual({ status: 'signed_out', user: null });
  });

  test('a network error, the gateway 503 auth_unavailable or any 5xx is unreachable, not signed out', async () => {
    for (const fields of [
      { status: 0, error: 'network_error' },
      { status: 503, error: 'auth_unavailable' },
      { status: 502, error: 'upstream_unavailable' },
      { status: 500, error: 'server_error' },
      { status: 200, error: 'invalid_response' },
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await expect(checkSession(fail(fields))).resolves.toEqual({ status: 'unreachable', user: null });
    }
  });
});
