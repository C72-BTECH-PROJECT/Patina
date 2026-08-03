// Require any authenticated session, regardless of role.
export const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

// Require authentication AND one of the given roles.
// Usage: router.get("/recruiter-only", requireRole("RECRUITER"), handler)
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};