import supabase from '../Config/supabase.js';

const ALLOWED_ROLES = new Set(['candidate', 'recruiter']);
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

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

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: String(email).trim().toLowerCase(),
    options: { emailRedirectTo: `${FRONTEND_URL}/email-confirmed` },
  });

  if (error) return res.status(400).json({ message: error.message });
  return res.status(200).json({ message: 'Confirmation email sent. Check your inbox and spam folder.' });
};

export const updatePassword = async (req, res) => {
  const { username, newPassword } = req.body || {};
  if (!username || !newPassword) {
    return res.status(400).json({ message: 'Username and new password are required.' });
  }

  const trimmedUsername = String(username).trim();

  let profile = null;
  let profileError = null;

  try {
    const profileResult = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('username', trimmedUsername)
      .maybeSingle();
    profile = profileResult.data;
    profileError = profileResult.error;
  } catch (e) {
    profileError = e;
  }

  if (!profile && !profileError) {
    const { data: authUsersList } = await supabase.auth.admin.listUsers();
    const matchedAuthUser = (authUsersList?.users || []).find((u) => {
      const metaUsername = u.user_metadata?.username || u.raw_user_meta_data?.username;
      return String(metaUsername || '').toLowerCase() === trimmedUsername.toLowerCase();
    });

    if (matchedAuthUser) {
      profile = {
        id: matchedAuthUser.id,
        email: matchedAuthUser.email,
      };
    }
  }

  if (!profile) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const authEmail = profile.email;
  if (!authEmail) {
    return res.status(400).json({ message: 'Auth email not found for this user.' });
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, {
    password: newPassword,
    email_confirm: true,
  });

  if (updateError) {
    console.error('Password update failed:', updateError.message);
    return res.status(400).json({ message: updateError.message });
  }

  return res.status(200).json({ message: 'Password updated successfully. You can now log in.' });
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

  const { data, error } = await supabase.auth.signUp({
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

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: authUser.user.email,
    password,
  });
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
