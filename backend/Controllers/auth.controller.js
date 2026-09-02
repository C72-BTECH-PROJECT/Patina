import { createClient } from '@supabase/supabase-js';

import supabase from '../Config/supabase.js';

const ALLOWED_ROLES = new Set(['candidate', 'recruiter']);
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const RESET_REDIRECT_URL = `${FRONTEND_URL}/reset-password`;
const MIN_PASSWORD_LENGTH = 8;

// A short-lived client carrying only the public anon key, for every GoTrue
// operation that establishes or uses a user session (login, signup, password
// recovery, resend-confirmation).
//
// These must NEVER run on the shared service-role client in Config/supabase.js:
// supabase-js caches the returned session in memory, and from then on every
// query on that singleton is sent with the user's JWT instead of the
// service-role key — so all RLS-bypassing writes (resumes, scores, storage
// uploads) start failing process-wide with "new row violates row-level
// security policy" until the server restarts.
const createUserScopedClient = () => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY is not configured — required for auth flows.');
  }
  return createClient(process.env.SUPABASE_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const formatProfile = (profile, email) => ({
  id: profile.id,
  _id: profile.id,
  username: profile.username,
  firstName: profile.first_name,
  lastName: profile.last_name,
  name: `${profile.first_name} ${profile.last_name}`.trim(),
  email,
  role: profile.role.toUpperCase(),
  phone: profile.phone,
  githubUrl: profile.github_url,
  companyName: profile.company_name,
});

const loadProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw new Error('Could not load user profile.');
  return data;
};

export const me = async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const profile = await loadProfile(req.session.userId);
    return res.status(200).json({ user: formatProfile(profile, req.session.email) });
  } catch (error) {
    return res.status(401).json({ message: 'Session is no longer valid.' });
  }
};

export const logout = (req, res) => {
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ message: 'Could not log out.' });
    res.clearCookie('patina_session');
    return res.status(200).json({ message: 'Logged out successfully' });
  });
};

export const resendConfirmation = async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  let authClient;
  try {
    authClient = createUserScopedClient();
  } catch (err) {
    console.error('resendConfirmation misconfigured:', err?.message || err);
    return res.status(500).json({ message: 'Email confirmation is not available right now.' });
  }

  const { error } = await authClient.auth.resend({
    type: 'signup',
    email: String(email).trim().toLowerCase(),
    options: { emailRedirectTo: `${FRONTEND_URL}/email-confirmed` },
  });

  if (error) return res.status(400).json({ message: error.message });
  return res.status(200).json({ message: 'Confirmation email sent. Check your inbox and spam folder.' });
};

// Step 1 of the password reset: email a recovery link.
//
// Always responds 200 with the same message regardless of whether the account
// exists, so the endpoint can't be used to enumerate usernames or emails. The
// request route is rate-limited in auth.routes.js.
export const requestPasswordReset = async (req, res) => {
  const { username, email } = req.body || {};
  const identifier = String(username || email || '').trim();

  const genericResponse = {
    message:
      'If an account matches that information, a password reset link has been sent to its email address.',
  };

  if (!identifier) {
    return res.status(400).json({ message: 'Enter your username or email address.' });
  }

  try {
    let targetEmail = null;

    if (identifier.includes('@')) {
      targetEmail = identifier.toLowerCase();
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', identifier)
        .maybeSingle();

      if (profile?.id) {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        targetEmail = authUser?.user?.email || null;
      }
    }

    if (targetEmail) {
      const userClient = createUserScopedClient();
      const { error } = await userClient.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: RESET_REDIRECT_URL,
      });
      if (error) {
        console.error('resetPasswordForEmail failed:', error.message);
      }
    }
  } catch (err) {
    // Swallow — the response must not reveal whether anything was found or sent.
    console.error('Password reset request error:', err?.message || err);
  }

  return res.status(200).json(genericResponse);
};

// Step 2 of the password reset: set the new password.
//
// Authorisation comes entirely from the recovery credentials in the emailed
// link (either a `token_hash` for the OTP-style template, or the
// access/refresh token pair from the redirect hash). A raw username is never
// accepted here, and the service-role key is never used to change the password.
export const resetPassword = async (req, res) => {
  const { newPassword, tokenHash, accessToken, refreshToken } = req.body || {};

  if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }
  if (!tokenHash && !(accessToken && refreshToken)) {
    return res
      .status(400)
      .json({ message: 'This reset link is invalid or has expired. Request a new one.' });
  }

  let userClient;
  try {
    userClient = createUserScopedClient();
  } catch (err) {
    console.error('Password reset misconfigured:', err?.message || err);
    return res.status(500).json({ message: 'Password reset is not available right now.' });
  }

  // Turn the emailed recovery token into a session for that user.
  const { error: sessionError } = tokenHash
    ? await userClient.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    : await userClient.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });

  if (sessionError) {
    return res
      .status(400)
      .json({ message: 'This reset link is invalid or has expired. Request a new one.' });
  }

  const { error: updateError } = await userClient.auth.updateUser({ password: newPassword });

  // Never keep the recovery session alive past the password change.
  await userClient.auth.signOut().catch(() => {});

  if (updateError) {
    console.error('Password reset update failed:', updateError.message);
    return res.status(400).json({ message: updateError.message });
  }

  return res
    .status(200)
    .json({ message: 'Password updated. You can now sign in with your new password.' });
};

export const signup = async (req, res) => {
  const { role, email, password, name, username, companyName, verificationInfo } = req.body || {};
  const normalizedRole = String(role || 'candidate').toLowerCase();
  const normalizedUsername = String(username || '').trim();
  const nameParts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || '';
  const lastName = nameParts.join(' ');

  if (!email || !password || !firstName || !lastName || !normalizedUsername) {
    return res.status(400).json({ message: 'First name, last name, username, email, and password are required.' });
  }
  if (!ALLOWED_ROLES.has(normalizedRole)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }
  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return res.status(400).json({ message: 'Username must be 3-30 letters, numbers, or underscores.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  let authClient;
  try {
    authClient = createUserScopedClient();
  } catch (err) {
    console.error('signup misconfigured:', err?.message || err);
    return res.status(500).json({ message: 'Account creation is not available right now.' });
  }

  // Runs on the anon client, not the shared service-role singleton — signUp can
  // return a session and would otherwise poison every later service-role query.
  const { data, error } = await authClient.auth.signUp({
    email: String(email).trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${FRONTEND_URL}/email-confirmed`,
      data: {
        username: normalizedUsername,
        first_name: firstName,
        last_name: lastName,
        role: normalizedRole,
        company_name: companyName || '',
        verification_info: verificationInfo || '',
      },
    },
  });

  // Drop any session signUp may have opened on the throwaway client.
  await authClient.auth.signOut().catch(() => {});

  if (error) return res.status(400).json({ message: error.message });
  if (!data.user) return res.status(500).json({ message: 'Account creation did not return a user.' });

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    username: normalizedUsername,
    first_name: firstName,
    last_name: lastName,
    role: normalizedRole,
    company_name: companyName || '',
    verification_info: verificationInfo || '',
  });

  if (profileError) {
    console.error('Signup profile insert failed:', profileError.message);
  }

  return res.status(201).json({
    message: data.session ? 'Account created successfully.' : 'Account created. Check your email to confirm the account before signing in.',
  });
};

export const login = async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const trimmedUsername = String(username).trim();
  console.log(`Login attempt for username: ${trimmedUsername}`);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, is_suspended')
    .ilike('username', trimmedUsername)
    .maybeSingle();

  if (profileError) {
    console.error('Login profile lookup failed:', profileError.message);
    return res.status(503).json({
      message: 'Authentication setup is incomplete. Apply the Supabase migrations and try again.',
    });
  }

  if (!profile) {
    console.log(`No profile found for username: ${trimmedUsername}`);
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  if (profile.is_suspended) {
    return res.status(403).json({
      code: 'ACCOUNT_SUSPENDED',
      message: 'Your account has been suspended. Please contact support for help restoring access.',
    });
  }

  const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(profile.id);
  if (authUserError) {
    console.error('Login auth-user lookup failed:', authUserError.message);
    return res.status(401).json({ message: 'Invalid username or password.' });
  }
  if (!authUser.user?.email) {
    console.error('Auth user has no email for profile:', profile.id);
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  let authClient;
  try {
    authClient = createUserScopedClient();
  } catch (err) {
    console.error('Login misconfigured:', err?.message || err);
    return res.status(500).json({
      message: 'Authentication is not configured correctly. Set SUPABASE_ANON_KEY in backend/.env.',
    });
  }

  // Verify the password on the anon client, never the shared service-role one
  // (see createUserScopedClient). Discard the session immediately — the app's
  // own Express session is the source of truth from here on.
  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email: authUser.user.email,
    password,
  });
  await authClient.auth.signOut().catch(() => {});

  if (signInError?.message?.toLowerCase().includes('email not confirmed')) {
    return res.status(403).json({ message: 'Please confirm your email before signing in.' });
  }
  if (signInError || !signInData.user) {
    console.error('Login signInWithPassword failed:', signInError?.message);
    return res.status(401).json({ message: 'Invalid username or password. If you just signed up, confirm your email first.' });
  }

  const fullProfile = await loadProfile(signInData.user.id);
  req.session.userId = signInData.user.id;
  req.session.email = signInData.user.email;
  req.session.role = fullProfile.role.toUpperCase();
  return res.status(200).json({ user: formatProfile(fullProfile, signInData.user.email) });
};
