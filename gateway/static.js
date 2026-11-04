import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

export function mountStatic(app, config) {
  const dir = config.FRONTEND_BUILD_DIR;
  if (!dir || !fs.existsSync(dir)) {
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/') || req.path === '/health') return next();
      return res.status(404).send('Not found');
    });
    return;
  }
  const expressStatic = express.static;
  app.use(expressStatic(dir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') return next();
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(dir, 'index.html'));
  });
}