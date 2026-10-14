import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, ShieldCheck, ShieldOff, Users, UserRoundCheck, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const cards = [
  ['candidates', 'Candidates', Users, 'text-foreground'],
  ['recruiters', 'Recruiters', UserRoundCheck, 'text-foreground'],
  ['jobs', 'Jobs posted', BriefcaseBusiness, 'text-foreground'],
  ['suspended', 'Access suspended', ShieldOff, 'text-destructive'],
];

function AdminDashboard() {
  const { user, loading, logout, authFetch } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('candidate');
  const [overview, setOverview] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [syncInfo, setSyncInfo] = useState(null);
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    if (!loading && user?.role !== 'ADMIN') navigate('/login', { replace: true });
  }, [loading, navigate, user]);

  // Fetch overview once — no dependency on `tab` so switching tabs never triggers a re-fetch.
  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    const load = async () => {
      setBusy(true);
      try {
        const response = await authFetch(`${API_BASE_URL}/api/admin/overview`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not load dashboard.');
        setOverview(data);
        setSyncInfo({
          source: data.source || 'unknown server',
          project: data.project || 'unknown project',
          generatedAt: data.generatedAt || null,
          recruitersReceived: (data.users?.recruiters || []).length,
        });
      } catch (error) { setNotice(error.message); } finally { setBusy(false); }
    };
    load();
  }, [authFetch, user]);

  // Derive the visible account list from cached overview whenever tab or overview changes.
  useEffect(() => {
    if (!overview) return;
    const candidateAccounts = overview.users?.candidates || [];
    const recruiterAccounts = overview.users?.recruiters || [];
    setAccounts(tab === 'recruiter' ? recruiterAccounts : candidateAccounts);
  }, [tab, overview]);

  const selectTab = (role) => { setNotice(''); setTab(role); };
  const updateAccess = async (account) => {
    setSavingId(account.id); setNotice('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/admin/users/${account.id}/suspension`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuspended: !account.isSuspended }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update access.');
      setAccounts((items) => items.map((item) => item.id === data.user.id ? data.user : item));
      setOverview((stats) => stats && ({ ...stats, suspended: stats.suspended + (data.user.isSuspended ? 1 : -1) }));
      setNotice(`${data.user.username} has been ${data.user.isSuspended ? 'suspended' : 'reactivated'}.`);
    } catch (error) { setNotice(error.message); } finally { setSavingId(''); }
  };
  const signOut = async () => { await logout(); navigate('/login', { replace: true }); };
  if (loading || user?.role !== 'ADMIN') return null;

  return (
    <main className="min-h-screen bg-background px-5 py-7 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 border-b border-border pb-6">
          <Link to="/" className="flex items-center gap-2 text-xl font-extrabold no-underline text-foreground">
            <Zap className="h-5 w-5" /> PATINA
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:block">{user.username}</span>
            <button onClick={signOut} className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors">Sign out</button>
          </div>
        </header>
        <section className="py-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-foreground">Platform control</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl text-foreground">Administrator dashboard</h1>
          <p className="mt-2 text-muted-foreground">Monitor activity and manage access without deleting accounts.</p>
          {syncInfo && <p className="mt-3 text-xs text-muted-foreground">Live sync: {syncInfo.source} · {syncInfo.project} · recruiter records received: {syncInfo.recruitersReceived}{syncInfo.generatedAt ? ` · ${new Date(syncInfo.generatedAt).toLocaleTimeString()}` : ''}</p>}
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([key, label, Icon, color]) => (
            <div key={key} className="card p-5">
              <Icon className={`h-5 w-5 ${color}`} />
              <p className="mt-5 text-3xl font-bold text-foreground">{overview?.[key] ?? '—'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>
        <section className="mt-9 card">
          <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold text-foreground">Account access</h2>
              <p className="mt-1 text-sm text-muted-foreground">Suspended accounts stay in the database and can be reactivated any time.</p>
            </div>
            <ShieldCheck className="h-6 w-6 text-success" />
          </div>
          <div className="flex gap-2 border-b border-border px-5 pt-4">
            {['candidate', 'recruiter'].map((role) => (
              <button key={role} onClick={() => selectTab(role)} className={`border-b-2 px-4 pb-3 text-sm font-semibold capitalize ${tab === role ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {role}s
              </button>
            ))}
          </div>
          {notice && <div className="mx-5 mt-5 rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">{notice}</div>}
          <div className="divide-y divide-border">
            {busy ? <p className="p-6 text-sm text-muted-foreground">Loading accounts…</p> : accounts.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No {tab}s have registered yet.</p> : accounts.map((account) => (
              <div key={account.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{account.username}</p>
                    {account.isSuspended && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Suspended</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{account.name || 'No name'}{account.companyName ? ` · ${account.companyName}` : ''}</p>
                </div>
                <button disabled={savingId === account.id} onClick={() => updateAccess(account)} className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${account.isSuspended ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'}`}>
                  {savingId === account.id ? 'Saving…' : account.isSuspended ? 'Reactivate' : 'Suspend'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default AdminDashboard;
