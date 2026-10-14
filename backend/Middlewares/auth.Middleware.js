import supabase from '../Config/supabase.js';

// Authentication is represented by the server-side Express session created after
// Supabase validates a username/password login.
export const requireAuth = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  // Fail closed: supabase-js returns { error } rather than throwing, so a query
  // error and a missing profile row must both be rejected, as must a throw.
  let profile = null;
  let lookupFailed = false;
  try {
    const result = await supabase
      .from('profiles')
      .select('is_suspended')
      .eq('id', req.session.userId)
      .maybeSingle();
    profile = result.data;
    lookupFailed = Boolean(result.error);
  } catch (e) {
    lookupFailed = true;
  }

  if (lookupFailed || !profile) {
    return res.status(401).json({ message: 'Session is no longer valid.' });
  }

  if (profile.is_suspended) {
    req.session.destroy(() => {});
    return res.status(403).json({
      code: 'ACCOUNT_SUSPENDED',
      message: 'Your account has been suspended. Please contact support for help restoring access.',
    });
  }

  next();
};

export const requireRole = (...roles) => async (req, res, next) => {
  return requireAuth(req, res, () => {
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  });
};
