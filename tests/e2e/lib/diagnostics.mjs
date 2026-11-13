// R-19: collect what a page complained about while a check ran: console errors, uncaught
// page errors, requests that failed at the network level and responses with HTTP >= 400.
// Used by shot.mjs (written next to each screenshot) and available to specs.

export function attachDiagnostics(page) {
  const d = { consoleErrors: [], pageErrors: [], failedRequests: [], errorResponses: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const loc = msg.location();
      d.consoleErrors.push(loc?.url ? `${msg.text()}  (${loc.url}:${loc.lineNumber})` : msg.text());
    }
  });
  page.on('pageerror', (err) => d.pageErrors.push(err?.stack || String(err)));
  page.on('requestfailed', (req) => {
    d.failedRequests.push(`${req.method()} ${req.url()}  ${req.failure()?.errorText || 'failed'}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) d.errorResponses.push(`${res.request().method()} ${res.url()}  HTTP ${res.status()}`);
  });
  return d;
}

export function formatDiagnostics(d) {
  const section = (title, items) =>
    `${title} (${items.length})\n${items.length ? items.map((i) => `  - ${i}`).join('\n') : '  (none)'}\n`;
  return [
    section('Console errors', d.consoleErrors),
    section('Uncaught page errors', d.pageErrors),
    section('Failed network requests', d.failedRequests),
    section('HTTP error responses (>= 400)', d.errorResponses),
  ].join('\n');
}
