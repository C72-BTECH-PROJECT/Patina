import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, ShieldCheck, ShieldOff, Users, UserRoundCheck, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, isAborted } from '../../lib/api';

const cards = [
  ['candidates', 'Candidates', Users, 'text-foreground'],
  ['recruiters', 'Recruiters', UserRoundCheck, 'text-foreground'],
  ['jobs', 'Jobs posted', BriefcaseBusiness, 'text-foreground'],
  ['suspended', 'Access suspended', ShieldOff, 'text-destructive'],
];

// R-15: the visible account list is derived from `overview` on every render, and a
// suspension change is written back into `overview.users`, so switching tabs can
// no longer re-derive a stale list (the change used to "revert" until reload). A
// failed load is an error state, never "No candidates have registered yet".
const replaceUser = (list, updated) => (list || []).map((item) => (item.id === updated.id ? updated : item));

function AdminDashboard() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('candidate');
  const [overview, setOverview] = useState(null);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null); // { ok, message }
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    if (!loading && user?.role !== 'ADMIN') navigate('/login', { replace: true });
  }, [loading, navigate, user]);

  const loadOverview = useCallback(async (signal) => {
    setBusy(true);
    setLoadError('');
    try {
      const data = await api.get('/api/admin/overview', { cache: 'no-store', signal });
      setOverview(data);
    } catch (error) {
      if (isAborted(error)) return;
      setOverview(null);
      setLoadError(error.message);
    }
    setBusy(false);
  }, []);

  // Fetch the overview once per sign-in; switching tabs never re-fetches.
  useEffect(() => {
    if (user?.role !== 'ADMIN') return undefined;
    const controller = new AbortController();
    loadOverview(controller.signal);
    return () => controller.abort();
  }, [user, loadOverview]);

  const accounts = (tab === 'recruiter' ? overview?.users?.recruiters : overview?.users?.candidates) || [];

  const selectTab = (role) => { setNotice(null); setTab(role); };
  const updateAccess = async (account) => {
    setSavingId(account.id); setNotice(null);
    try {
      const data = await api.patch(`/api/admin/users/${account.id}/suspension`, { isSuspended: !account.isSuspended });
      const updated = data.user;
      setOverview((current) => {
        if (!current) return current;
        const changed = Boolean(updated.isSuspended) !== Boolean(account.isSuspended);
        return {
          ...current,
          suspended: changed && typeof current.suspended === 'number'
            ? current.suspended + (updated.isSuspended ? 1 : -1)
            : current.suspended,
          users: {
            candidates: replaceUser(current.users?.candidates, updated),
            recruiters: replaceUser(current.users?.recruiters, updated),
          },
        };
      });
      setNotice({ ok: true, message: `${updated.username} has been ${updated.isSuspended ? 'suspended' : 'reactivated'}.` });
    } catch (error) {
      setNotice({ ok: false, message: error.message });
    } finally { setSavingId(''); }
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
            <button onClick={signOut} className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">Sign out</button>
          </div>
        </header>
        <section className="py-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-foreground">Platform control</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl text-foreground">Administrator dashboard</h1>
          <p className="mt-2 text-muted-foreground">Monitor activity and manage access without deleting accounts.</p>
          {overview?.generatedAt && <p className="mt-3 text-xs text-muted-foreground">Loaded {new Date(overview.generatedAt).toLocaleTimeString()}</p>}
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
          {notice && <div role={notice.ok ? 'status' : 'alert'} className={`mx-5 mt-5 rounded-md border px-4 py-3 text-sm ${notice.ok ? 'border-border bg-muted text-foreground' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>{notice.message}</div>}
          <div className="divide-y divide-border">
            {busy ? <p className="p-6 text-sm text-muted-foreground">Loading accounts…</p> : loadError ? (
              <div role="alert" className="p-6">
                <p className="text-sm font-semibold text-destructive">Could not load accounts.</p>
                <p className="mt-1 text-sm text-destructive">{loadError}</p>
                <button type="button" onClick={() => loadOverview()} className="mt-3 rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">Try again</button>
              </div>
            ) : accounts.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No {tab}s have registered yet.</p> : accounts.map((account) => (
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
