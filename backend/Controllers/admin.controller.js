import supabase from '../Config/supabase.js';

const USER_FIELDS = 'id, username, first_name, last_name, role, company_name, created_at, is_suspended, suspended_at';

const formatUser = (profile) => ({
  id: profile.id,
  username: profile.username,
  name: `${profile.first_name} ${profile.last_name}`.trim(),
  role: profile.role.toUpperCase(),
  companyName: profile.company_name,
  createdAt: profile.created_at,
  isSuspended: profile.is_suspended,
  suspendedAt: profile.suspended_at,
});

export const getOverview = async (_req, res) => {
  const [profilesResult, jobs, suspended] = await Promise.all([
    supabase
      .from('profiles')
      .select(USER_FIELDS)
      .in('role', ['candidate', 'recruiter'])
      .order('created_at', { ascending: false }),
    supabase.from('jobs').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_suspended', true),
  ]);

  const result = [profilesResult, jobs, suspended];
  if (result.some(({ error }) => error)) {
    console.error('Admin overview failed:', result.find(({ error }) => error).error.message);
    return res.status(500).json({ message: 'Could not load dashboard metrics. Apply the latest Supabase migration first.' });
  }

  const allUsers = (profilesResult.data || []).map(formatUser);
  const candidates = allUsers.filter((profile) => profile.role === 'CANDIDATE');
  const recruiters = allUsers.filter((profile) => profile.role === 'RECRUITER');

  console.log(`[ADMIN OVERVIEW] project=${new URL(process.env.SUPABASE_URL).host} candidates=${candidates.length} recruiters=${recruiters.length}`);

  // Counts and tabs come from one profile query, so they cannot diverge.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return res.json({
    source: 'patina-admin-api',
    project: new URL(process.env.SUPABASE_URL).host,
    generatedAt: new Date().toISOString(),
    candidates: candidates.length,
    recruiters: recruiters.length,
    jobs: jobs.count || 0,
    suspended: suspended.count || 0,
    users: { candidates, recruiters },
  });
};

export const getUsers = async (req, res) => {
  const role = String(req.query.role || '').toLowerCase();
  if (!['candidate', 'recruiter'].includes(role)) {
    return res.status(400).json({ message: 'Role must be candidate or recruiter.' });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(USER_FIELDS)
    .eq('role', role)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: 'Could not load users. Apply the latest Supabase migration first.' });
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return res.json({
    source: 'patina-admin-api',
    generatedAt: new Date().toISOString(),
    users: data.map(formatUser),
  });
};

export const updateSuspension = async (req, res) => {
  const { userId } = req.params;
  const isSuspended = req.body?.isSuspended;
  if (typeof isSuspended !== 'boolean') {
    return res.status(400).json({ message: 'isSuspended must be a boolean.' });
  }

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  if (targetError || !target) return res.status(404).json({ message: 'User not found.' });
  if (target.role === 'admin') return res.status(403).json({ message: 'Administrator accounts cannot be suspended here.' });

  const { data, error } = await supabase
    .from('profiles')
    .update({ is_suspended: isSuspended, suspended_at: isSuspended ? new Date().toISOString() : null })
    .eq('id', userId)
    .select(USER_FIELDS)
    .single();

  if (error) return res.status(500).json({ message: 'Could not update account access. Apply the latest Supabase migration first.' });
  return res.json({ user: formatUser(data) });
};
