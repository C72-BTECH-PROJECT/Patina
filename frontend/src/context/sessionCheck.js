// What one GET /api/auth/me answer means for the app. Only an answer that says
// "no session" signs the user out: core's /me sends 401 when there is no session or
// the session no longer matches a profile, and 403 ACCOUNT_SUSPENDED (after
// destroying the session) for a suspended account (backend/Middlewares/auth.Middleware.js,
// backend/Controllers/auth.controller.js `me`). Anything else (a network error, the
// gateway's 503 auth_unavailable, a 5xx, an unreadable answer) says nothing about the
// session, so it is reported as `unreachable` and the user is not sent to the login form.
//
//   { status: 'signed_in',   user }
//   { status: 'signed_out',  user: null }
//   { status: 'unreachable', user: null }

export const SIGNED_OUT_STATUSES = [401, 403];

export async function checkSession(getMe) {
  try {
    const data = await getMe();
    const user = data?.user || null;
    return user ? { status: 'signed_in', user } : { status: 'signed_out', user: null };
  } catch (err) {
    if (SIGNED_OUT_STATUSES.includes(err?.status)) return { status: 'signed_out', user: null };
    return { status: 'unreachable', user: null };
  }
}
