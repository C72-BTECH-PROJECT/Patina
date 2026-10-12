// Small HTTP helpers for the live tests: log in as a test account and call the
// backend with that session cookie.
import assert from 'node:assert/strict';
import { backendBaseUrl } from './env.mjs';

const BASE = backendBaseUrl();

export async function login(username, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(r.status, 200, `login failed for ${username}: HTTP ${r.status} ${await r.text()}`);
  const cookie = (r.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('patina_session='));
  assert.ok(cookie, `login for ${username} did not set patina_session`);
  return cookie;
}

// cookie may be null for an unauthenticated call. Returns { status, body, text }.
export async function api(cookie, method, path, json) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${BASE}${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: r.status, body, text };
}
