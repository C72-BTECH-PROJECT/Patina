import supabase from '../Config/supabase.js';

// Authentication is represented by the server-side Express session created after
// Supabase validates a username/password login.
export const requireAuth = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  let profile = null;
  try {
    const result = await supabase
      .from('profiles')
      .select('is_suspended')
      .eq('id', req.session.userId)
      .maybeSingle();
    profile = result.data;
  } catch (e) {
    profile = null;
  }

  if (profile?.is_suspended) {
    req.session.destroy(() => {});
    return res.status(403).json({
      code: 'ACCOUNT_SUSPENDED',
      message: 'Your account has been suspended. Please contact support for help restoring access.',
    });
  }

  next();
};

export const requireRole = (...roles) => async (req, res, next) => {
  await requireAuth(req, res, () => {
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  });
};
