// R-19: Playwright Test config for the scripted browser checks.
// It does NOT start the stack: start it with `powershell -File scripts\start-all.ps1` first.
// global-setup.mjs fails in one sentence if the frontend or the gateway is down.
import { defineConfig, devices } from '@playwright/test';
import { frontendBaseUrl } from './lib/env.mjs';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.mjs$/,
  outputDir: './output/test-results',
  globalSetup: './global-setup.mjs',
  globalTeardown: './global-teardown.mjs',

  // Serial, one browser, no retries: the spine is one story against shared live data, and a
  // retry would hide a flaky step instead of reporting it.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,

  // Bounded but generous. A spec that waits on something slow (the assessment pool going from
  // preparing to ready) raises its own limit with test.setTimeout(), never this default.
  timeout: 3 * 60_000,
  globalTimeout: 45 * 60_000,
  expect: { timeout: 20_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: './output/report', open: 'never' }],
  ],

  use: {
    baseURL: frontendBaseUrl(),
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
