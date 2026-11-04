# Patina API Gateway (Part 1)

Standalone gateway service. Runs against stub servers in tests.

## Routes
- /health — aggregated health
- /api/* — proxied to core (CORE_URL)
- static files + SPA fallback when FRONTEND_BUILD_DIR exists

## Env
See .env.example. Limits and URLs come from env, never hard-coded.

## Rule
A new public route in core means editing public-routes.js in the same PR. github-evidence gets no gateway route (DEC-5).