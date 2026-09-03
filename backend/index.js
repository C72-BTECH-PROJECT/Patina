import express from 'express';
import cors from 'cors';

import authRoutes from './Routes/auth.routes.js';
import jobsRoutes from './Routes/jobs.routes.js';
import analysisRoutes from './Routes/analysis.routes.js';
import parseRoutes from './Routes/parse.routes.js';
import adminRoutes from './Routes/admin.routes.js';
import notificationRoutes from './Routes/notification.routes.js';

import session from 'express-session';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

app.use(session({
  name: 'patina_session', // must match res.clearCookie("patina_session") in auth.controller.js logout
  secret: process.env.SESSION_SECRET || 'patina-development-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  },
}));


// Debug routing (safe)
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);

// analysisRoutes defines:
// POST /analyze
// GET  /candidate-analysis
app.use('/api', analysisRoutes);

// parseRoutes defines POST / (mounted at /api/parse)
app.use('/api/parse', parseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all
app.use((req, res) => {
  res.status(404).json({ message: `Cannot GET ${req.url}` });
});

// Keep a module-level reference and register success/error separately. Passing
// the callback directly to Express can invoke it for a listen error as well,
// which previously printed a false "Server running" message on EADDRINUSE.
const server = app.listen(PORT);

server.once('listening', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `API endpoints:\n- GET  /api/jobs\n- POST /api/jobs\n- POST /api/analyze\n- GET  /api/candidate-analysis\n- POST /api/parse`
  );
});

server.once('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Could not start: port ${PORT} is already in use. Stop the existing backend process and try again.`);
  } else {
    console.error('HTTP server failed:', error);
  }
  process.exitCode = 1;
});
// ---------------------------------------------------------------------------
// Crash guards: log unhandled rejections and uncaught exceptions so the
// process never shuts down silently and the log always explains what happened.
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  console.error(error?.stack || '');
});

// ---------------------------------------------------------------------------
// Watchdog: if the listener ever stops, log it and rebind automatically so the
// backend heals without a manual restart. Also keeps the event loop alive,
// which a running HTTP server needs anyway.
// ---------------------------------------------------------------------------
let rebindAttempts = 0;

setInterval(() => {
  if (server.listening) {
    rebindAttempts = 0;
    process.exitCode = 0;
    return;
  }

  rebindAttempts += 1;
  console.error(`[watchdog] Server not listening - rebinding on port ${PORT} (attempt ${rebindAttempts})...`);

  try {
    server.listen(PORT);
  } catch (error) {
    console.error('[watchdog] Rebinding failed:', error.message);
  }
}, 15000);

// ---------------------------------------------------------------------------
// Graceful shutdown: release the port immediately on Ctrl+C / SIGTERM so the
// next start never sees a stale socket. Open connections get up to 10 seconds
// to drain before we force-exit.
// ---------------------------------------------------------------------------
const shutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGINT', () => shutdown('Ctrl+C (SIGINT)'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
