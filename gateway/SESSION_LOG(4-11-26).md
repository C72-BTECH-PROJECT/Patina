# Session Log — Gateway Part 1

## Pull
- Fast-forwarded `aditya-ui-work` to `origin/main` (3f53f80 -> 88d03eb).
- Stashed/restored local WIP (`assessment-service/app/llm_client.py`, `tests/.env.example`).

## Files created
- gateway/package.json
- gateway/index.js (createApp, loadConfig)
- gateway/requestId.js
- gateway/public-routes.js
- gateway/forwardAuth.js
- gateway/limits.js
- gateway/cors.js
- gateway/health.js
- gateway/static.js
- gateway/.env.example
- gateway/README.md
- tests/gateway/auth-routing.test.mjs
- tests/gateway/edge.test.mjs

## Files modified (reconciliation to spec)
- gateway/index.js, cors.js, health.js, limits.js, static.js, forwardAuth.js, requestId.js
- tests/gateway/auth-routing.test.mjs, edge.test.mjs

## Verification
- `node --test "tests/gateway/*.mjs"` -> 12 pass, 0 fail.
- `8001` only in health.js default.

## Test coverage added
- auth-routing.test.mjs: allowlist entries reach core; everything else needs a session; forward-auth sends only session cookie; hung auth check fails closed; core down; request id kept/replaced/echoed.
- edge.test.mjs: health aggregates core/nlp/github-evidence/assessment-service; login limit; cors allows only frontend; auth/me never limited; serves the build; non-api paths 404 without build dir.

## Remaining
- Full T-0022 test coverage.
- Git branches/PRs.
- Remove extra PLAN.md (not done per instruction).