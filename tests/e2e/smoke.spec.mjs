// R-19 scaffolding smoke: proves the Playwright setup can reach the frontend. It asserts nothing
// about page design (the pages are being rewritten in R-14..R-18), only that they render.
import { test, expect } from '@playwright/test';
import { loginForm } from './lib/auth.mjs';

test('landing page loads without an uncaught error', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  const res = await page.goto('/');
  expect(res, 'no response for /').not.toBeNull();
  expect(res.status(), 'HTTP status of /').toBeLessThan(400);
  // React rendered something into #root.
  await expect(page.locator('#root *').first()).toBeVisible();
  expect(pageErrors, 'uncaught errors on the landing page').toEqual([]);
});

test('login page shows its form', async ({ page }) => {
  await page.goto('/login');
  const form = loginForm(page);
  await expect(form.username).toBeVisible();
  await expect(form.password).toBeVisible();
  await expect(form.submit).toBeVisible();
  await expect(form.submit).toBeEnabled();
});
