// Authentication is represented by the server-side Express session created after
// Supabase validates a username/password login.
export const requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  if (!roles.includes(req.session.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};
