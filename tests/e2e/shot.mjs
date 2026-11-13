#!/usr/bin/env node
// R-19: screenshot tool for verifiers' browser passes.
//
//   node tests/e2e/shot.mjs --role candidate|recruiter|none --path /some/route --out <file.png> [--wait <selector>] [--timeout <seconds>]
//
// Logs in through the real login page when a role is given (test accounts from tests/.env),
// opens the route on the running frontend (E2E_BASE_URL, default http://localhost:3000), and
// saves a full-page screenshot to --out plus a text file next to it (<out>.txt) with the final
// URL, console errors, uncaught page errors, failed requests and HTTP >= 400 responses.
// --wait takes any Playwright selector (CSS, [data-testid=x], text=..., role=button[name="x"])
// and must become visible before the screenshot. It does not start the stack.
// Exit: 0 screenshot taken; 1 the check failed (stack down, login failed, --wait timed out);
// 2 bad arguments. On failure after the page opened, the screenshot of that state is still saved.
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { frontendBaseUrl, ROLES } from './lib/env.mjs';
import { checkStack } from './lib/stack.mjs';
import { loginAs } from './lib/auth.mjs';
import { attachDiagnostics, formatDiagnostics } from './lib/diagnostics.mjs';

const USAGE =
  'usage: node tests/e2e/shot.mjs --role candidate|recruiter|none --path /some/route --out <file.png> [--wait <selector>] [--timeout <seconds>]';

function usage(msg) {
  if (msg) console.error(`shot: ${msg}`);
  console.error(USAGE);
  process.exit(2);
}

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      role: { type: 'string' },
      path: { type: 'string' },
      out: { type: 'string' },
      wait: { type: 'string' },
      timeout: { type: 'string', default: '30' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  }));
} catch (err) {
  usage(err.message);
}
if (args.help) { console.log(USAGE); process.exit(0); }
if (!args.role || !['none', ...ROLES].includes(args.role)) usage('--role must be candidate, recruiter or none');
if (!args.path || !args.path.startsWith('/')) usage('--path must be a route starting with / (in Git Bash, prefix the command with MSYS_NO_PATHCONV=1 so /route is not rewritten to a Windows path)');
if (!args.out || !/\.png$/i.test(args.out)) usage('--out must be a .png file path');
const timeoutMs = Number(args.timeout) * 1000;
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) usage('--timeout must be a positive number of seconds');

const outPng = resolve(args.out);
const outTxt = outPng.replace(/\.png$/i, '.txt');
const role = args.role === 'none' ? null : args.role;

/** Scroll down one viewport at a time to the bottom (the page may grow), then back to the top. */
async function scrollThrough(page) {
  const step = await page.evaluate(() => window.innerHeight);
  for (let i = 0; i < 200; i += 1) {
    const atBottom = await page.evaluate((dy) => {
      window.scrollBy({ top: dy, behavior: 'instant' }); // index.css sets smooth scrolling
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
    }, step);
    await page.waitForTimeout(150);
    if (atBottom) break;
  }
  await page.waitForTimeout(400); // let the last in-view animations finish
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(300);
}

// process.exitCode, not process.exit(): exiting while fetch sockets close trips a libuv
// assertion on Windows (Node 24) and turns exit 1 into 127.
async function run() {
  // A logged-in shot needs the gateway (login goes through it); an anonymous one needs only the frontend.
  const down = await checkStack({ frontend: true, gateway: Boolean(role) });
  if (down) { console.error(down); return 1; }

  const base = frontendBaseUrl();
  const browser = await chromium.launch({ headless: true });
  let failure = null;
  let diag;
  let page;
  try {
    const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(Math.max(timeoutMs, 45_000));
    diag = attachDiagnostics(page);
    // Login.jsx and others use window.alert(); record the text and dismiss so nothing hangs.
    page.on('dialog', (d) => { diag.consoleErrors.push(`[dialog ${d.type()}] ${d.message()}`); d.dismiss().catch(() => {}); });

    if (role) await loginAs(page, role);
    await page.goto(args.path);
    if (args.wait) {
      await page.locator(args.wait).first().waitFor({ state: 'visible', timeout: timeoutMs });
    } else {
      await page.waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 15_000) }).catch(() => {});
    }
    await page.waitForTimeout(500); // let entry animations settle
  } catch (err) {
    failure = err?.message?.split('\n')[0] || String(err);
  }

  try {
    mkdirSync(dirname(outPng), { recursive: true });
    let shotTaken = false;
    if (page) {
      // Sections that animate in on scroll (framer-motion whileInView) stay invisible in a
      // full-page shot unless they were scrolled into view once: step to the bottom, then back.
      try { await scrollThrough(page); } catch (err) {
        diag?.consoleErrors.push(`[shot] scroll-through failed: ${err.message.split('\n')[0]}`);
      }
      try { await page.screenshot({ path: outPng, fullPage: true }); shotTaken = true; } catch (err) {
        failure = failure || `screenshot failed: ${err.message.split('\n')[0]}`;
      }
    }
    const header = [
      `shot: ${failure ? 'FAILED' : 'OK'}`,
      `when: ${new Date().toISOString()}`,
      `role: ${args.role}`,
      `requested: ${base}${args.path}`,
      `final url: ${page ? page.url() : '(page never opened)'}`,
      `wait: ${args.wait || '(none; waited for network idle, max 15 s)'}`,
      `screenshot: ${shotTaken ? outPng : '(not saved)'}`,
      ...(failure ? [`failure: ${failure}`] : []),
      '',
    ].join('\n');
    writeFileSync(outTxt, `${header}\n${diag ? formatDiagnostics(diag) : ''}`);
    const counts = diag
      ? `console errors ${diag.consoleErrors.length}, page errors ${diag.pageErrors.length}, failed requests ${diag.failedRequests.length}, HTTP>=400 ${diag.errorResponses.length}`
      : 'no diagnostics';
    console.log(`shot: ${failure ? `FAILED: ${failure}` : 'OK'}`);
    console.log(`  png: ${shotTaken ? outPng : '(not saved)'}`);
    console.log(`  txt: ${outTxt}  (${counts})`);
  } finally {
    await browser.close();
  }
  return failure ? 1 : 0;
}

process.exitCode = await run();
