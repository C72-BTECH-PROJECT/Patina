// R-19: sign-up through the UI as far as O-5(a) allows. Email confirmation is ON in the live
// Supabase project, so the flow ends at the "Account created / confirm your email" screen.
//
// OPT-IN (E2E_SIGNUP=1): every run creates a real, unconfirmed auth user (and sends a
// confirmation email) that an agent cannot delete. The address is clearly marked:
//   E2E_SIGNUP_EMAIL   template with {ts}, default "patina-e2e-signup-{ts}@example.com".
//                      Use a plus-address on a mailbox you own to avoid bounced emails.
// The address and username are printed with the run's leftover rows.
import { randomBytes } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { recordLeftover } from './lib/leftovers.mjs';
import { actAndWait } from './lib/network.mjs';

// R-31: writes nothing (the form is not submitted), so it always runs.
test('recruiter sign-up form: one Create Account button, no verification section', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Account type', { exact: true }).selectOption('recruiter');
  await expect(page.getByText('Sign up as a recruiter to get started')).toBeVisible();
  await expect(page.locator('form button[type="submit"]')).toHaveCount(1);
  await expect(page.getByTestId('signup-submit')).toHaveText(/Create Account/);
  await expect(page.getByText(/Verification Details/i)).toHaveCount(0);
  await expect(page.getByText(/Skip Verification/i)).toHaveCount(0);
  await expect(page.getByLabel(/Company Name|LinkedIn/i)).toHaveCount(0);
});

test('sign-up reaches the "confirm your email" screen', async ({ page }) => {
  const skipReason = 'opt-in: creates a real unconfirmed Supabase auth user that cannot be deleted from here; set E2E_SIGNUP=1 to run it';
  if (process.env.E2E_SIGNUP !== '1') console.log(`e2e: signup.spec.mjs skipped (${skipReason}).`);
  test.skip(process.env.E2E_SIGNUP !== '1', skipReason);

  const ts = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
  const template = process.env.E2E_SIGNUP_EMAIL || 'patina-e2e-signup-{ts}@example.com';
  if (!template.includes('{ts}')) throw new Error('E2E_SIGNUP_EMAIL must contain {ts} so every run uses a new, recognisable address');
  const email = template.replace('{ts}', ts);
  const username = `e2e_signup_${ts}`;
  const password = `E2e-${randomBytes(12).toString('hex')}-9a`; // never printed

  await page.goto('/signup');
  await expect(page.getByTestId('signup-submit')).toBeVisible();
  await page.getByLabel('Account type', { exact: true }).selectOption('candidate');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Full Name', { exact: true }).fill('E2E Signup Check');
  await page.getByLabel('Email Address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);

  const { status, body } = await actAndWait(page, 'POST', /^\/api\/auth\/signup$/, () => page.getByTestId('signup-submit').click());
  // Recorded whatever the answer: a 5xx may still have created the user.
  recordLeftover('auth.users (unconfirmed sign-up)', email, `username ${username}; POST /api/auth/signup answered ${status}`);
  expect(status, `sign-up answered ${status}: ${body?.message || ''}`).toBeLessThan(300);

  const done = page.getByTestId('signup-confirm-email');
  await expect(done).toBeVisible();
  await expect(done).toContainText('Account created');
  expect((await done.innerText()).match(/Account created/gi), 'R-31: "Account created" is said once').toHaveLength(1);
  await expect(done).toContainText(email);
  await expect(page.getByTestId('login-error')).toHaveCount(0);
});
