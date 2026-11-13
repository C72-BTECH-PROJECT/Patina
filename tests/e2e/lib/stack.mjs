// R-19: is the stack from scripts/start-all.ps1 up? The e2e checks never start it themselves.
import { frontendBaseUrl, gatewayBaseUrl } from './env.mjs';

async function probe(name, url, okStatus) {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    if (okStatus(res.status)) return null;
    return `${name} (${url}) answered HTTP ${res.status}`;
  } catch (err) {
    const why = err?.name === 'TimeoutError' ? 'no answer within 5 s' : (err?.cause?.code || err?.message || 'unreachable');
    return `${name} (${url}) is down: ${why}`;
  }
}

// Returns null when everything asked for answers, otherwise one sentence naming what is down.
// gateway /health answers 200 only when it can reach core (gateway/health.js).
export async function checkStack({ frontend = true, gateway = true } = {}) {
  const checks = [];
  if (frontend) checks.push(probe('the frontend', `${frontendBaseUrl()}/`, (s) => s >= 200 && s < 400));
  if (gateway) checks.push(probe('the gateway', `${gatewayBaseUrl()}/health`, (s) => s === 200));
  const problems = (await Promise.all(checks)).filter(Boolean);
  if (!problems.length) return null;
  return `e2e cannot run: ${problems.join(', and ')}; start the stack with powershell -File scripts\\start-all.ps1 first.`;
}
