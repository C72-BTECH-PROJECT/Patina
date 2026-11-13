// R-19: a failure at the LLM provider (the assessment pool never became ready, or grading stayed
// pending until the bound) is reported apart from a product failure: its own error prefix, its
// own test annotation (`provider-failure`) and a line in output/provider-failures.jsonl that
// global-teardown.mjs prints after the leftover rows. The run still fails (exit 1): a provider
// failure is not a pass, it only says where to look.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUT_DIR } from './env.mjs';

export const PROVIDER_FAILURE_FILE = join(OUTPUT_DIR, 'provider-failures.jsonl');
export const PROVIDER_FAILURE_PREFIX = 'PROVIDER FAILURE (not a product failure):';

export function resetProviderFailures() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(PROVIDER_FAILURE_FILE, '');
}

/** Record and throw. `testInfo` is test.info(); `what` one sentence; `detail` optional facts. */
export function providerFailure(testInfo, what, detail = '') {
  const message = `${PROVIDER_FAILURE_PREFIX} ${what}${detail ? ` ${detail}` : ''}`;
  testInfo.annotations.push({ type: 'provider-failure', description: message });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  appendFileSync(PROVIDER_FAILURE_FILE, `${JSON.stringify({ test: testInfo.title, message, at: new Date().toISOString() })}\n`);
  console.log(`\n${message}\n`);
  throw new Error(message);
}

export function formatProviderFailures() {
  if (!existsSync(PROVIDER_FAILURE_FILE)) return '';
  const rows = readFileSync(PROVIDER_FAILURE_FILE, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  if (!rows.length) return '';
  return [
    `e2e: ${rows.length} provider failure(s); the product steps before them passed, the LLM provider did not answer in time:`,
    ...rows.map((r) => `  - [${r.test}] ${r.message}`),
  ].join('\n');
}
