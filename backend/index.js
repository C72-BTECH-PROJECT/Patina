import express from 'express';
import cors from 'cors';

import authRoutes from './Routes/auth.routes.js';
import jobsRoutes from './Routes/jobs.routes.js';
import analysisRoutes from './Routes/analysis.routes.js';
import parseRoutes from './Routes/parse.routes.js';
import adminRoutes from './Routes/admin.routes.js';

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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all
app.use((req, res) => {
  res.status(404).json({ message: `Cannot GET ${req.url}` });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `API endpoints:\n- GET  /api/jobs\n- POST /api/jobs\n- POST /api/analyze\n- GET  /api/candidate-analysis\n- POST /api/parse`
  );
});
