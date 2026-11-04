import cors from 'cors';

export function mountCors(app, config) {
  const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000';
  app.use(cors({
    origin: (origin, cb) => cb(null, origin === frontendUrl),
    credentials: true,
  }));
}