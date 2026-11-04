import http from 'node:http';

function check(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.request(url, { method: 'GET', timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

export function mountHealth(app, config) {
  const coreUrl = config.CORE_URL || 'http://localhost:5001';
  const nlpUrl = config.NLP_URL || 'http://localhost:8000';
  const ghUrl = config.GITHUB_EVIDENCE_URL || 'http://localhost:8001';
  const asmUrl = config.ASSESSMENT_URL || 'http://localhost:8002';

  app.get('/health', async (_req, res) => {
    const [coreOk, nlpOk, ghOk, asmOk] = await Promise.all([
      check(new URL('/api/health', coreUrl).toString()),
      check(new URL('/', nlpUrl).toString()),
      check(new URL('/health', ghUrl).toString()),
      check(new URL('/', asmUrl).toString()),
    ]);
    const services = { core: coreOk, nlp: nlpOk, 'github-evidence': ghOk, 'assessment-service': asmOk };
    if (!coreOk) return res.status(503).json({ status: 'error', services });
    const degraded = !nlpOk || !ghOk || !asmOk;
    return res.status(200).json({ status: degraded ? 'degraded' : 'ok', services });
  });
}