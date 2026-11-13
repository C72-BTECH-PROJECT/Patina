// R-19: an image-only resume (fixture f6, no text layer) is reported as unreadable, and the
// resume already on the profile stays as it was (backend: an unreadable upload stores nothing).
// File order: Playwright runs the spec files of this serial, one-worker run in path order, so this
// file runs after spine.spec.mjs; the spine also uploads its own resume before applying, so this
// spec can never leave the spine without a readable resume either way.
import { test, expect } from '@playwright/test';
import { newRoleContext } from './lib/auth.mjs';
import { actAndWait } from './lib/network.mjs';
import { chooseResumeFile } from './lib/pages.mjs';
import { fixturePath } from './fixtures/index.mjs';

test('image-only resume: "unreadable" is shown and the earlier resume stays', async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  const { context, page: p } = await newRoleContext(browser, 'candidate');

  const { status: s0, body: before } = await actAndWait(p, 'GET', /^\/api\/resume\/status$/, () => p.goto('/candidate/upload'));
  expect(s0, 'the resume status loads').toBe(200);
  // Upload.jsx: "Current resume, used for all jobs[ · uploaded <date>]" or "No resume uploaded yet".
  const current = p.getByText(/^Current resume, used for all jobs/);
  const none = p.getByText('No resume uploaded yet', { exact: true });
  let currentText = null;
  if (before?.hasResume) {
    await expect(current).toBeVisible();
    currentText = (await current.innerText()).trim();
  } else {
    await expect(none).toBeVisible();
  }

  await chooseResumeFile(p, fixturePath('imageOnlyPdf'));
  const { status, body } = await actAndWait(p, 'POST', /^\/api\/resume\/upload$/,
    () => p.getByTestId('resume-upload-button').click(), { timeout: 120_000 });
  expect(status, `the upload answered ${status} ${body?.error || ''}`).toBe(422);
  expect(body?.error).toBe('unreadable_document');
  expect(body?.stored, 'nothing was stored').toBe(false);

  const notice = p.getByTestId('resume-unreadable');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("We can't read this file.");
  await expect(notice).toContainText('Nothing was kept from this upload.');
  if (before?.hasResume) await expect(notice).toContainText('Your earlier resume is still on your profile, unchanged.');
  await expect(p.getByTestId('resume-parsed')).toHaveCount(0);

  // After a reload the page shows the same resume on file as before the upload.
  const { body: after } = await actAndWait(p, 'GET', /^\/api\/resume\/status$/, () => p.reload());
  expect(after?.hasResume, 'whether a resume is on file did not change').toBe(Boolean(before?.hasResume));
  expect(after?.updatedAt ?? null, 'the resume on file was not replaced').toBe(before?.updatedAt ?? null);
  expect(after?.fileName ?? null).toBe(before?.fileName ?? null);
  if (before?.hasResume) await expect(current).toHaveText(currentText);
  else await expect(none).toBeVisible();

  await context.close();
});
