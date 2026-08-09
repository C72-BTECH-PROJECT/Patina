import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { candidates } from './Candidate.js';
import { recruiters } from './Recruiter.js';

const users = () => [
  ...candidates.map((candidate) => ({ ...candidate, role: 'CANDIDATE' })),
  ...recruiters.map((recruiter) => ({ ...recruiter, role: 'RECRUITER' })),
];

passport.serializeUser((user, done) => done(null, user._id));

passport.deserializeUser((id, done) => {
  const user = users().find((entry) => entry._id === id);
  done(user ? null : new Error('User not found'), user || null);
});

passport.use(
  new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    const user = users().find(
      (entry) => entry.email.toLowerCase() === email.toLowerCase()
    );

    if (!user || user.password !== password) {
      return done(null, false, { message: 'Invalid credentials' });
    }

    return done(null, user);
  })
);

export default passport;
