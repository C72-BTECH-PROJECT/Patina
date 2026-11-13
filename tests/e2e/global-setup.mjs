// R-19: refuse to run unless the stack from scripts/start-all.ps1 is up. One sentence names what
// is down. E2E_SKIP_GATEWAY_CHECK=1 checks the frontend only, for trying a spec that needs no API
// (e.g. smoke.spec.mjs while only the dev server runs); the run-suite e2e suite never sets it.
import { checkStack } from './lib/stack.mjs';
import { resetLeftovers } from './lib/leftovers.mjs';
import { resetProviderFailures } from './lib/provider.mjs';

export default async function globalSetup() {
  resetLeftovers(); // first, so a failed start never prints an earlier run's rows
  resetProviderFailures();
  const skipGateway = process.env.E2E_SKIP_GATEWAY_CHECK === '1';
  const problem = await checkStack({ frontend: true, gateway: !skipGateway });
  if (problem) throw new Error(problem);
  if (skipGateway) console.log('e2e: E2E_SKIP_GATEWAY_CHECK=1, gateway not checked (specs that call the API will fail).');
}
