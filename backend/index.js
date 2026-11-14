import express from 'express';

import authRoutes from './Routes/auth.routes.js';
import jobsRoutes from './Routes/jobs.routes.js';
import analysisRoutes from './Routes/analysis.routes.js';
import adminRoutes from './Routes/admin.routes.js';
import notificationRoutes from './Routes/notification.routes.js';
import assessmentRoutes from './Routes/assessment.routes.js';
import skillsRoutes from './Routes/skills.routes.js';

import session from 'express-session';
import { requestIdMiddleware } from './Middlewares/requestId.js';
import {
  createHealthHandler,
  errorContract,
  errorHandler,
  notFoundHandler,
} from './Middlewares/errorHandler.js';
import { configuredSessionSecret, probeDatabase } from './Config/supabase.js';

// R-04 (D§2): no fallback secret. Core refuses to start unless SESSION_SECRET is
// set and at least 32 characters long. The value is never printed.
const MIN_SESSION_SECRET_LENGTH = 32;
const SESSION_SECRET = configuredSessionSecret();
if (!SESSION_SECRET) {
  console.error(`[core] cannot start: SESSION_SECRET is not set. Set it in backend/.env to a random value of at least ${MIN_SESSION_SECRET_LENGTH} characters.`);
  process.exit(1);
}
if (SESSION_SECRET.length < MIN_SESSION_SECRET_LENGTH) {
  console.error(`[core] cannot start: SESSION_SECRET is too short. It must be at least ${MIN_SESSION_SECRET_LENGTH} characters; set a new random value in backend/.env.`);
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5001;
// R-02 (D§1): loopback by default so core is reachable only through the gateway.
const HOST = process.env.HOST || '127.0.0.1';

app.use(requestIdMiddleware);
// R-03: every error response is { error, message, requestId } from here on.
app.use(errorContract);
app.use(express.json());

app.use(session({
  name: 'patina_session', // must match res.clearCookie("patina_session") in auth.controller.js logout
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  },
}));

// (R-03: the old "[API] METHOD url" debug line is gone; requestIdMiddleware already
// logs one line per request with id, status and latency.)

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
// R-32: GET /api/skills?q= and POST /api/skills/extract (recruiter-only).
app.use('/api/skills', skillsRoutes);

// analysisRoutes defines:
// POST /analyze
// GET  /candidate-analysis
// GET  /candidates
app.use('/api', analysisRoutes);

app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// assessmentRoutes defines:
// POST /generate (T-0024: generate-only, no persistence)
app.use('/api/assessment', assessmentRoutes);

// R-03 (D§9): checks the database within 2 s; 200 with status ok | degraded.
app.get('/api/health', createHealthHandler({ probe: probeDatabase, timeoutMs: 2000 }));

// Catch-all: JSON 404, then the final JSON error handler (malformed JSON -> 400,
// database timeout -> 503, anything thrown -> 500; never a stack trace).
app.use(notFoundHandler);
app.use(errorHandler);

// Keep a module-level reference and register success/error separately. Passing
// the callback directly to Express can invoke it for a listen error as well,
// which previously printed a false "Server running" message on EADDRINUSE.
const server = app.listen(PORT, HOST);

server.once('listening', () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(
    `API endpoints:\n- GET  /api/jobs\n- POST /api/jobs\n- POST /api/analyze\n- GET  /api/candidate-analysis\n- GET  /api/candidates`
  );
});

server.once('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Could not start: port ${PORT} is already in use. Stop the existing backend process and try again.`);
  } else {
    console.error('HTTP server failed:', error);
  }
  // A backend that can't listen is useless; exit so it never lingers as a
  // zombie and a supervisor (or the developer) sees the failure.
  process.exit(1);
});
// ---------------------------------------------------------------------------
// Crash guards: log unhandled rejections and uncaught exceptions so the
// process never shuts down silently and the log always explains what happened.
// After an uncaught exception the process state is unknown, so log and exit.
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  console.error(error?.stack || '');
  process.exit(1);
});

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
