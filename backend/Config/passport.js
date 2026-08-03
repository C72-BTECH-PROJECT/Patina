import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import bcrypt from 'bcrypt';
import pool from './pg.js';
import dotenv from 'dotenv';

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001";
const ALLOWED_ROLES = ["CANDIDATE", "RECRUITER"];

// The role the user picked (candidate/recruiter) travels through OAuth as
// the `state` query param set in auth.routes.js. Only used on first signup;
// existing users keep whatever role they already have.
function roleFromState(req) {
  try {
    const role = (JSON.parse(req.query.state || "{}").role || "candidate").toUpperCase();
    return ALLOWED_ROLES.includes(role) ? role : "CANDIDATE";
  } catch {
    return "CANDIDATE";
  }
}

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (rows.length > 0) {
      done(null, rows[0]);
    } else {
      done(new Error('User not found'), null);
    }
  } catch (error) {
    done(error, null);
  }
});

// Local Strategy
passport.use(
  new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (rows.length === 0) {
          return done(null, false, { message: 'Invalid credentials' });
        }
        
        const user = rows[0];
        
        if (!user.password) {
            return done(null, false, { message: 'User registered via OAuth' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${BACKEND_URL}/api/auth/google/callback`,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const googleId = profile.id;
        const name = profile.displayName;

        // Check if user exists
        let { rows } = await pool.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleId, email]);
        
        if (rows.length > 0) {
          let user = rows[0];
          // If user exists with email but no google_id, update it
          if (!user.google_id) {
             const updateRes = await pool.query(
                'UPDATE users SET google_id = $1 WHERE email = $2 RETURNING *',
                [googleId, email]
             );
             user = updateRes.rows[0];
          }
          return done(null, user);
        } else {
          // Create new user with the role they picked before starting OAuth
          const role = roleFromState(req);
          const insertRes = await pool.query(
            'INSERT INTO users (name, email, google_id, role) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, email, googleId, role]
          );
          return done(null, insertRes.rows[0]);
        }
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// GitHub Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${BACKEND_URL}/api/auth/github/callback`,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // GitHub might not return an email if it's private, but passport-github2 with user:email scope attempts to get it
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : `${profile.username}@github.nomail`;
        const githubId = profile.id;
        const name = profile.displayName || profile.username;

        let { rows } = await pool.query('SELECT * FROM users WHERE github_id = $1 OR email = $2', [githubId, email]);
        
        if (rows.length > 0) {
          let user = rows[0];
          // Update github_id if they already have an account with this email
          if (!user.github_id) {
             const updateRes = await pool.query(
                'UPDATE users SET github_id = $1 WHERE email = $2 RETURNING *',
                [githubId, email]
             );
             user = updateRes.rows[0];
          }
          return done(null, user);
        } else {
          // Create new user, storing the OAuth access token and the role
          // they picked before starting the flow
          const role = roleFromState(req);
          const insertRes = await pool.query(
            'INSERT INTO users (name, email, github_id, github_access_token, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, email, githubId, accessToken, role]
          );
          return done(null, insertRes.rows[0]);
        }
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

export default passport;