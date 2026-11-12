// Explicit public allowlist. Deny by default. Adding a public route in core
// means adding it here in the same PR.
const ALLOWLIST = [
  { method: 'POST', path: '/api/auth/signup' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/logout' },
  { method: 'POST', path: '/api/auth/resend-confirmation' },
  { method: 'POST', path: '/api/auth/request-password-reset' },
  { method: 'POST', path: '/api/auth/reset-password' },
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/health' },
];

// R-04: core's router matches paths case-insensitively and ignores one trailing
// slash, so the gateway compares the same normalised form (`/api/auth/Login/`
// is `/api/auth/login`), here and in the rate limiter (limits.js).
export function normalizePath(pathname) {
  const p = String(pathname || '').toLowerCase().replace(/\/+$/, '');
  return p || '/';
}

export function isPublicRoute(method, pathname) {
  const m = String(method).toUpperCase();
  // OPTIONS preflight always public (handled by CORS)
  if (m === 'OPTIONS') return true;
  const p = normalizePath(pathname);
  // anything outside /api/ is static/frontend
  if (!p.startsWith('/api/')) return true;
  return ALLOWLIST.some((e) => e.method === m && e.path === p);
}

export { ALLOWLIST };