import supabase from '../Config/supabase.js';

const ALLOWED_ROLES = new Set(['candidate', 'recruiter']);
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

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

  return res.status(201).json({
    message: data.session ? 'Account created successfully.' : 'Account created. Check your email to confirm the account before signing in.',
  });
};

export const login = async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', String(username).trim())
    .maybeSingle();

  if (profileError || !profile) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(profile.id);
  if (authUserError || !authUser.user?.email) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: authUser.user.email,
    password,
  });
  if (signInError || !signInData.user) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  const fullProfile = await loadProfile(signInData.user.id);
  req.session.userId = signInData.user.id;
  req.session.email = signInData.user.email;
  req.session.role = fullProfile.role.toUpperCase();
  return res.status(200).json({ user: formatProfile(fullProfile, signInData.user.email) });
};
