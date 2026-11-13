// R-19: every run ends by printing the Supabase rows it created (recorded by lib/leftovers.mjs),
// then any provider failure (lib/provider.mjs), so it is not mistaken for a product failure.
import { formatLeftovers } from './lib/leftovers.mjs';
import { formatProviderFailures } from './lib/provider.mjs';

export default async function globalTeardown() {
  console.log(`\n${formatLeftovers()}`);
  const provider = formatProviderFailures();
  if (provider) console.log(`\n${provider}`);
}
