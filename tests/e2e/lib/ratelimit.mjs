// The gateway's global limiter (gateway/limits.js) is keyed per client IP: express-rate-limit's
// default key is req.ip and the gateway sets no `trust proxy`. Every e2e request comes from
// 127.0.0.1, so a fast spine run can use most of the 300-per-minute window before the next spec
// starts (ISSUES.md, D-10 e2e run of 2026-11-15: `unreadable.spec.mjs` got 429).
//
// waitForRateLimitHeadroom() reads the limiter's standard headers with one cheap request and,
// when fewer than `need` requests are left, waits for the window to reset. It never retries a
// request inside a spec and never hides a 429 a spec receives: it only starts the spec with
// headroom. The probe itself counts as one request.
import { gatewayBaseUrl } from './env.mjs';

export async function waitForRateLimitHeadroom({ need = 100, maxWaitMs = 70_000 } = {}) {
  const probe = async () => {
    const r = await fetch(`${gatewayBaseUrl()}/api/jobs`, { headers: { Accept: 'application/json' } });
    await r.arrayBuffer();
    return {
      remaining: Number(r.headers.get('ratelimit-remaining')),
      resetSec: Number(r.headers.get('ratelimit-reset')),
    };
  };
  const first = await probe();
  if (!Number.isFinite(first.remaining) || first.remaining >= need) return { waitedMs: 0, ...first };
  const waitMs = Math.min(maxWaitMs, (Number.isFinite(first.resetSec) ? first.resetSec : 60) * 1000 + 1000);
  console.log(`e2e: gateway limiter has ${first.remaining} requests left; waiting ${Math.round(waitMs / 1000)} s for its window to reset`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return { waitedMs: waitMs, ...(await probe()) };
}
