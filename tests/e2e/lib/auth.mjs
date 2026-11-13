// R-19: log in through the real login page (frontend/src/pages/public/Login.jsx), never by
// calling the API or injecting a cookie, so every e2e check also exercises the login form.
//
// Selectors prefer data-testid (the frontend cards are asked to add them), then the accessible
// label, then the current markup. The current Login.jsx labels are not tied to their inputs
// (no htmlFor/id), so today the last fallback is what matches; it goes away once the test ids exist.
import { account, frontendBaseUrl } from './env.mjs';

const LOGIN_TIMEOUT_MS = 30_000;

// Where each role lands after a successful login (Login.jsx getDashboardPath).
const ROLE_AREA = { candidate: '/candidate', recruiter: '/recruiter' };

export function loginForm(page) {
  return {
    username: page.getByTestId('login-username')
      .or(page.getByLabel('Username', { exact: true }))
      .or(page.locator('form input[type="text"]'))
      .first(),
    password: page.getByTestId('login-password')
      .or(page.getByLabel('Password', { exact: true }))
      .or(page.locator('form input[type="password"]'))
      .first(),
    submit: page.getByTestId('login-submit')
      .or(page.getByRole('button', { name: /^sign in/i }))
      .first(),
  };
}

// Logs `page` in as the test candidate or test recruiter and waits until the app has left
// /login for that role's area. Throws one sentence on failure, with the page's own error text
// when it showed one. Never includes the username or password in a message.
export async function loginAs(page, role) {
  const area = ROLE_AREA[role];
  if (!area) throw new Error(`loginAs: unknown role "${role}"; expected candidate or recruiter`);
  const { username, password } = account(role);

  // Login.jsx reports some failures with window.alert(); capture the text instead of hanging.
  let dialogText = null;
  const onDialog = (dialog) => {
    dialogText = dialog.message();
    dialog.dismiss().catch(() => {});
  };
  page.on('dialog', onDialog);
  try {
    await page.goto('/login');
    const form = loginForm(page);
    await form.username.waitFor({ state: 'visible', timeout: LOGIN_TIMEOUT_MS });
    await form.username.fill(username);
    await form.password.fill(password);
    await form.submit.click();

    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const path = new URL(page.url()).pathname;
      if (path === area || path.startsWith(`${area}/`)) return;
      if (dialogText) throw new Error(`loginAs(${role}): the login page said "${dialogText}"`);
      const alert = page.getByTestId('login-error').or(page.getByRole('alert')).first();
      if (await alert.isVisible().catch(() => false)) {
        const text = (await alert.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        throw new Error(`loginAs(${role}): the login page showed an error: "${text}"`);
      }
      await page.waitForTimeout(250);
    }
    throw new Error(
      `loginAs(${role}): still on ${new URL(page.url()).pathname} after ${LOGIN_TIMEOUT_MS / 1000} s, expected ${area}/...`,
    );
  } finally {
    page.off('dialog', onDialog);
  }
}

// A fresh browser context logged in as `role`. The spine needs the recruiter and the candidate
// side by side, so each gets its own context (own cookies). Caller closes the context.
export async function newRoleContext(browser, role, contextOptions = {}) {
  const context = await browser.newContext({ baseURL: frontendBaseUrl(), ...contextOptions });
  const page = await context.newPage();
  try {
    await loginAs(page, role);
  } catch (err) {
    await context.close();
    throw err;
  }
  return { context, page };
}
