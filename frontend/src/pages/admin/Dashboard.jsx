import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, ShieldCheck, ShieldOff, Users, UserRoundCheck, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const cards = [
  ['candidates', 'Candidates', Users, 'text-accent-cyan'],
  ['recruiters', 'Recruiters', UserRoundCheck, 'text-accent-purple'],
  ['jobs', 'Jobs posted', BriefcaseBusiness, 'text-accent-emerald'],
  ['suspended', 'Access suspended', ShieldOff, 'text-rose-300'],
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

  return <main className="min-h-screen bg-background px-5 py-7 text-white sm:px-8"><div className="mx-auto max-w-6xl">
    <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6"><Link to="/" className="flex items-center gap-2 text-xl font-extrabold no-underline text-white"><Zap className="h-5 w-5 text-accent-cyan" /> PATINA</Link><div className="flex items-center gap-4"><span className="hidden text-sm text-white/50 sm:block">{user.username}</span><button onClick={signOut} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10">Sign out</button></div></header>
    <section className="py-10"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-cyan">Platform control</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Administrator dashboard</h1><p className="mt-2 text-white/55">Monitor activity and manage access without deleting accounts.</p>{syncInfo && <p className="mt-3 text-xs text-white/35">Live sync: {syncInfo.source} · {syncInfo.project} · recruiter records received: {syncInfo.recruitersReceived}{syncInfo.generatedAt ? ` · ${new Date(syncInfo.generatedAt).toLocaleTimeString()}` : ''}</p>}</section>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([key, label, Icon, color]) => <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><Icon className={`h-5 w-5 ${color}`} /><p className="mt-5 text-3xl font-bold">{overview?.[key] ?? '—'}</p><p className="mt-1 text-sm text-white/50">{label}</p></div>)}</section>
    <section className="mt-9 rounded-2xl border border-white/10 bg-white/[0.03]"><div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">Account access</h2><p className="mt-1 text-sm text-white/50">Suspended accounts stay in the database and can be reactivated any time.</p></div><ShieldCheck className="h-6 w-6 text-accent-emerald" /></div><div className="flex gap-2 border-b border-white/10 px-5 pt-4">{['candidate', 'recruiter'].map((role) => <button key={role} onClick={() => selectTab(role)} className={`border-b-2 px-4 pb-3 text-sm font-semibold capitalize ${tab === role ? 'border-accent-cyan text-white' : 'border-transparent text-white/45 hover:text-white/75'}`}>{role}s</button>)}</div>{notice && <div className="mx-5 mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">{notice}</div>}<div className="divide-y divide-white/8">{busy ? <p className="p-6 text-sm text-white/50">Loading accounts…</p> : accounts.length === 0 ? <p className="p-6 text-sm text-white/50">No {tab}s have registered yet.</p> : accounts.map((account) => <div key={account.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold">{account.username}</p>{account.isSuspended && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-200">Suspended</span>}</div><p className="mt-1 text-sm text-white/50">{account.name || 'No name'}{account.companyName ? ` · ${account.companyName}` : ''}</p></div><button disabled={savingId === account.id} onClick={() => updateAccess(account)} className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${account.isSuspended ? 'bg-accent-emerald/15 text-accent-emerald hover:bg-accent-emerald/25' : 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'}`}>{savingId === account.id ? 'Saving…' : account.isSuspended ? 'Reactivate access' : 'Suspend access'}</button></div>)}</div></section>
  </div></main>;
}
export default AdminDashboard;
