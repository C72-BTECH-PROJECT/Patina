import passport from 'passport';
import { candidates } from '../Config/Candidate.js';
import { recruiters } from '../Config/Recruiter.js';

const ALLOWED_ROLES = ['CANDIDATE', 'RECRUITER'];

const sanitizeUser = (user) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

export const me = (req, res) => {
  if (!req.isAuthenticated?.()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  return res.status(200).json({ user: sanitizeUser(req.user) });
};

export const logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((sessionErr) => {
      if (sessionErr) return res.status(500).json({ message: 'Could not log out session' });
      res.clearCookie('patina_session');
      return res.status(200).json({ message: 'Logged out successfully' });
    });
  });
};

export const signup = (req, res) => {
  const { role, email, password, name, companyName } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const formattedRole = role ? role.toUpperCase() : 'CANDIDATE';
  if (!ALLOWED_ROLES.includes(formattedRole)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  if ([...candidates, ...recruiters].some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ message: 'Account already exists with this email' });
  }

  const isCandidate = formattedRole === 'CANDIDATE';
  const createdUser = {
    _id: `${isCandidate ? 'cand' : 'rec'}-${Date.now()}`,
    name,
    email,
    password,
    ...(isCandidate ? { location: '' } : { companyName: companyName || '', isVerified: false }),
  };
  (isCandidate ? candidates : recruiters).push(createdUser);

  req.login({ ...createdUser, role: formattedRole }, (err) => {
    if (err) return res.status(500).json({ message: 'Account created, but failed to establish session' });
    return res.status(201).json({ message: 'Signup successful', user: sanitizeUser({ ...createdUser, role: formattedRole }) });
  });
};

export const login = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return res.status(500).json({ message: 'Internal server error during login' });
    if (!user) return res.status(401).json({ message: info?.message || 'Invalid credentials' });
    req.login(user, (loginErr) => {
      if (loginErr) return res.status(500).json({ message: 'Failed to establish login session' });
      return res.status(200).json({ message: 'Login successful', user: sanitizeUser(user) });
    });
  })(req, res, next);
};
