# Gateway Part 1 — Implementation Plan

Owner: single agent building both Aaron (auth/routing) and Aditya (edge/ops) halves.

## Scope (Part 1 only)
Only files under `gateway/` and `tests/gateway/`. No changes to backend/, nlp-engine/, frontend/.

## File ownership
Aaron side:
- gateway/package.json (done)
- gateway/index.js (createApp + direct-run listen, wires all modules)
- gateway/public-routes.js (allowlist)
- gateway/forwardAuth.js (DEC-2 forward auth)
- gateway/requestId.js (X-Request-ID validation)
- tests/gateway/auth-routing.test.mjs

Aditya side:
- gateway/limits.js (rate limits, /api/auth/me exempt)
- gateway/cors.js (FRONTEND_URL + credentials)
- gateway/health.js (aggregated health)
- gateway/static.js (SPA fallback)
- gateway/.env.example
- gateway/README.md
- tests/gateway/edge.test.mjs

## Middleware order (index.js)
1. requestId
2. CORS
3. GET /health
4. rate limits (with /api/auth/me exempt)
5. public-route check + forward-auth
6. /api proxy (pathFilter)
7. static files

## Implementation order
1. requestId.js + test (valid/invalid/none)
2. public-routes.js (allowlist)
3. forwardAuth.js (5 constraints) + tests
4. limits.js, cors.js
5. health.js
6. static.js
7. index.js wiring
8. tests (auth-routing + edge) written test-first
9. .env.example + README.md
10. Run `node --test tests/gateway/`, verify `git grep -n "8001" -- gateway` only health default.

## Test-first discipline
Write test → run → see fail → implement → run → pass.

## Acceptance (Part 1 tests)
- auth-routing: allowlist reaches core; everything else 401; forward-auth only cookie; hung auth → 503 within 2.5s; core down → 502/503; request id kept/replaced/echoed.
- edge: health aggregates; login limit; serves build; CORS only frontend; auth/me never limited.

## Notes
- No body parser before proxy.
- cors origin as function (not string).
- /api/auth/me exempt from all limiters.
- github-evidence never routed (DEC-5); only health checks port 8001.