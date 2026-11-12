import http from 'node:http';

// Resolves 'up' (2xx, body not degraded), 'degraded' (2xx whose JSON body says
// status "degraded") or 'down' (anything else, including a 2 s timeout).
function check(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.request(url, { method: 'GET', timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => { if (body.length < 4096) body += c; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return resolve('down');
        let status;
        try { status = JSON.parse(body)?.status; } catch { status = undefined; }
        resolve(status === 'degraded' ? 'degraded' : 'up');
      });
    });
    req.on('timeout', () => { req.destroy(); resolve('down'); });
    req.on('error', () => resolve('down'));
    req.end();
  });
}

export function mountHealth(app, config) {
  // Core binds 127.0.0.1 only (R-02); the literal address avoids "localhost" resolving to ::1.
  const coreUrl = config.CORE_URL || 'http://127.0.0.1:5001';
  const nlpUrl = config.NLP_URL || 'http://localhost:8000';
  const ghUrl = config.GITHUB_EVIDENCE_URL || 'http://localhost:8001';
  const asmUrl = config.ASSESSMENT_URL || 'http://localhost:8002';

  app.get('/health', async (_req, res) => {
    const [core, nlp, gh, asm] = await Promise.all([
      check(new URL('/api/health', coreUrl).toString()),
      check(new URL('/', nlpUrl).toString()),
      check(new URL('/health', ghUrl).toString()),
      check(new URL('/', asmUrl).toString()),
    ]);
    // Booleans: true only when the service answered and did not report itself degraded.
    const services = { core: core === 'up', nlp: nlp === 'up', 'github-evidence': gh === 'up', 'assessment-service': asm === 'up' };
    res.set('Cache-Control', 'no-store');
    // Core unreachable: the gateway cannot serve anything (503). Core reachable but
    // degraded (e.g. its database check failed) or any other service not up: 200 degraded.
    if (core === 'down') return res.status(503).json({ status: 'error', error: 'core_unavailable', message: 'The core service is not reachable.', services });
    const degraded = Object.values(services).some((v) => !v);
    return res.status(200).json({ status: degraded ? 'degraded' : 'ok', services });
  });
}
