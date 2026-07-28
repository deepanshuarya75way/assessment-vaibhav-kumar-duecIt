'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CircleUserRound, History, Settings2, Terminal, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api, type MatchHistoryEntry } from '@/lib/api';
import { wsClient } from '@/lib/ws';
import AppNav, { ratingClass } from '@/components/AppNav';

const AVAILABILITY = [6, 11, 8, 14, 19, 25, 18, 9, 5];

function goToMatch(router: ReturnType<typeof useRouter>, data: Record<string, unknown>) {
  const matchId = data.matchId as string;
  sessionStorage.setItem(`match:${matchId}`, JSON.stringify(data));
  router.push(`/duel/${matchId}`);
}

function resultLabel(match: MatchHistoryEntry) {
  if (match.status !== 'finished') return { label: match.phase, className: 'text-[var(--text-muted)]' };
  if (match.isDraw) return { label: 'DRAW', className: 'text-[var(--warning)]' };
  return match.won ? { label: 'WIN', className: 'text-[var(--accent)]' } : { label: 'LOSS', className: 'text-[var(--danger)]' };
}

function Segment({ label, value, selected, onClick, disabled = false, detail }: { label: string; value: string; selected: boolean; onClick: () => void; disabled?: boolean; detail?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} className={`flex min-h-10 flex-1 items-center justify-between gap-2 border px-3 py-2 text-left font-mono text-[11px] transition-colors ${selected ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]' : 'border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'} disabled:cursor-not-allowed disabled:opacity-50`}>
      <span>{label}</span>{detail && <span className="text-[10px] opacity-70">{detail}</span>}
    </button>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [category, setCategory] = useState('dsa');
  const [difficulty, setDifficulty] = useState('easy');
  const [mode, setMode] = useState('competitive');
  const [inQueue, setInQueue] = useState(false);
  const [queueMsg, setQueueMsg] = useState('');
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user?.role === 'admin') router.push('/admin');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || isAdmin) return;
    const token = localStorage.getItem('accessToken');
    if (token) wsClient.connect(token).catch(() => {});

    const restoreSession = async () => {
      try {
        const active = await api.getActiveMatch();
        if (active?.matchId) return goToMatch(router, active as Record<string, unknown>);
      } catch { /* no active match */ }
      try {
        const pending = await api.getPendingMatch();
        if (pending?.matchId) return goToMatch(router, pending as Record<string, unknown>);
      } catch { /* no pending match */ }
      try {
        await api.getQueueStatus();
        setInQueue(true);
        setQueueMsg('Searching for opponent...');
      } catch { /* not in queue */ }
    };

    restoreSession();
    api.getMyMatches().then((items) => setMatches((items || []).slice(0, 6))).catch(() => {});
    const unsubFound = wsClient.on('match:found', (data) => { setInQueue(false); goToMatch(router, data); });
    return () => unsubFound();
  }, [user, isAdmin, router]);

  useEffect(() => {
    if (!inQueue || !user || isAdmin) return;
    const poll = async () => {
      try {
        const match = await api.getPendingMatch();
        if (match?.matchId) { setInQueue(false); goToMatch(router, match); }
      } catch { /* searching */ }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [inQueue, user, isAdmin, router]);

  const joinQueue = async () => {
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      if (token) await wsClient.connect(token);
      const result = await api.joinQueue({ category, difficulty, mode });
      if (result.match?.matchId) return goToMatch(router, result.match as Record<string, unknown>);
      setInQueue(true);
      setQueueMsg('Searching for opponent...');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join queue');
    }
  };

  const leaveQueue = async () => {
    try { await api.leaveQueue(); setInQueue(false); setQueueMsg(''); } catch { /* ignore */ }
  };

  const rating = category === 'db' ? user?.ratingDB ?? 0 : user?.ratingDSA ?? 0;
  const rankProgress = useMemo(() => Math.min(100, Math.max(8, ((rating - 800) / 1200) * 100)), [rating]);

  if (loading || !user) {
    return <div className="terminal-shell flex min-h-screen items-center justify-center gap-3 font-mono text-xs text-[var(--text-muted)]"><span className="run-spinner" /> hydrating /arena data…</div>;
  }

  return (
    <div className="terminal-shell">
      <AppNav />
      <aside className="fixed bottom-0 left-0 top-14 z-20 hidden w-[236px] flex-col border-r border-[var(--border)] bg-[var(--panel)] lg:flex">
        <div className="border-b border-[var(--border)] px-5 py-5"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">workspace</p><p className="mt-2 flex items-center gap-2 font-mono text-[12px] text-[var(--accent)]"><Terminal size={13} /> /arena</p></div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Workspace navigation">
          {[[Activity, '/arena', 'arena'], [History, '#history', 'history'], [CircleUserRound, `/profile/${user.username}`, 'profile'], [Settings2, '#settings', 'settings']].map(([Icon, href, label]) => <Link key={label as string} href={href as string} className={`flex items-center gap-3 border-l-2 px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] no-underline ${label === 'arena' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'}`}><Icon size={14} /> /{label}</Link>)}
        </nav>
        <div className="border-t border-[var(--border)] p-4 font-mono text-[10px] text-[var(--text-muted)]"><p className="flex items-center gap-2 text-[var(--accent)]"><span className="live-dot" /> api connected</p><p className="mt-3">latency 42ms · region iad1</p><p className="mt-4 uppercase tracking-[0.12em]">session</p><p className="mt-1 text-[var(--text)]">@{user.username}</p></div>
      </aside>

      <main className="min-w-0 lg:pl-[236px]">
        <div className="mx-auto max-w-[1050px] px-5 py-8 lg:px-8 lg:py-12">
          <section className="terminal-grid border-b border-[var(--border)] pb-8">
            <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end"><div><p className="terminal-kicker text-[var(--accent)]">matchmaking service / operational</p><h1 className="mt-4 max-w-[690px] text-5xl font-semibold leading-[0.95] tracking-[-0.06em] sm:text-6xl">Find your next<br /><span className="text-[var(--accent)]">worthy opponent.</span></h1></div><p className="max-w-[245px] font-mono text-[11px] leading-5 text-[var(--text-muted)]">A focused arena for engineers who want the pressure of a real clock, a real peer, and a result they can inspect.</p></div>
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <article className="terminal-panel p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]"><span>your current rating</span><span>rank</span></div>
              <div className="mt-5 flex items-end justify-between gap-4"><div><div className={`text-6xl font-semibold tracking-[-0.08em] ${ratingClass(rating)}`}>{rating.toLocaleString()} <span className="text-base tracking-normal">{category.toUpperCase()}</span></div><span className="mt-3 inline-flex border border-[var(--accent)] px-2 py-1 font-mono text-[10px] text-[var(--accent)]">candidate</span><span className="ml-3 font-mono text-[10px] text-[var(--text-muted)]">+18 this week</span></div><div className="text-right font-mono"><div className="text-3xl text-[var(--text)]">#042</div><div className="mt-1 text-[10px] text-[var(--text-muted)]">of 3,842</div></div></div>
              <div className="mt-12"><div className="flex justify-between font-mono text-[10px] text-[var(--text-muted)]"><span>newbie / 800</span><span>master / 1900+</span></div><div className="mt-2 h-1 bg-[var(--panel-raised)]"><div className="h-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${rankProgress}%` }} /></div><div className="mt-2 flex justify-between font-mono text-[9px] text-[var(--text-faint)]"><span>1,000</span><span>1,400</span><span>1,800</span><span>2,200</span><span>2,600</span></div></div>
              <div className="mt-6 flex justify-between border-t border-[var(--border)] pt-4 font-mono text-[10px] text-[var(--text-muted)]"><span>last match / 11m ago</span><span className="text-[var(--accent)]">win · +22 elo</span></div>
            </article>

            <article className="terminal-panel p-5 sm:p-7"><div className="flex items-center justify-between border-b border-[var(--border)] pb-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]"><span>live availability</span><span className="flex items-center gap-2 text-[var(--accent)]"><span className="live-dot" /> accepting</span></div><div className="mt-6 flex items-end justify-between gap-4"><div><div className="text-5xl font-semibold tracking-[-0.06em]">26</div><p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">engineers inside ±200 ELO</p></div><div className="flex h-16 items-end gap-1">{AVAILABILITY.map((point, i) => <span key={i} className={`w-2 bg-[var(--accent)] ${i % 3 === 0 ? 'opacity-40' : i % 2 === 0 ? 'opacity-70' : ''}`} style={{ height: `${point * 2.4}px` }} />)}</div></div><div className="mt-7 divide-y divide-[var(--border)] border-y border-[var(--border)] font-mono text-[10px]"><div className="flex justify-between py-3"><span className="text-[var(--text-muted)]">median wait</span><span>00:18</span></div><div className="flex justify-between py-3"><span className="text-[var(--text-muted)]">active duels</span><span>1,984</span></div><div className="flex justify-between py-3"><span className="text-[var(--text-muted)]">judge uptime</span><span className="text-[var(--accent)]">99.98%</span></div></div></article>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <article id="arena" className="terminal-panel p-5 sm:p-7"><div className="flex items-start justify-between border-b border-[var(--border)] pb-4"><div><p className="terminal-kicker">queue command</p><h2 className="mt-2 text-xl font-medium tracking-[-0.04em]">Configure your arena.</h2></div><span className="terminal-badge">queue/01</span></div>{error && <div className="mt-4 flex items-center gap-2 border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 font-mono text-[11px] text-[var(--danger)]" role="alert">{error}<button className="ml-auto" onClick={() => setError('')} aria-label="Dismiss error"><X size={13} /></button></div>}<div className="mt-6 space-y-5"><div><p className="field-label">category</p><div className="flex gap-2"><Segment label="dsa" detail="01" selected={category === 'dsa'} onClick={() => setCategory('dsa')} disabled={inQueue} /><Segment label="database" detail="02" selected={category === 'db'} onClick={() => setCategory('db')} disabled={inQueue} /></div></div><div><p className="field-label">difficulty</p><div className="flex gap-2"><Segment label="easy" selected={difficulty === 'easy'} onClick={() => setDifficulty('easy')} disabled={inQueue} /><Segment label="medium" selected={difficulty === 'medium'} onClick={() => setDifficulty('medium')} disabled={inQueue} /><Segment label="hard" selected={difficulty === 'hard'} onClick={() => setDifficulty('hard')} disabled={inQueue} /></div></div><div><p className="field-label">mode</p><div className="flex gap-2"><Segment label="competitive" detail="rated" selected={mode === 'competitive'} onClick={() => setMode('competitive')} disabled={inQueue} /><Segment label="practice" detail="free" selected={mode === 'practice'} onClick={() => setMode('practice')} disabled={inQueue} /></div></div></div>{inQueue ? <div className="mt-6 flex gap-2"><div className="flex min-h-11 flex-1 items-center gap-3 border border-[var(--accent)] bg-[var(--accent-soft)] px-3 font-mono text-[11px] text-[var(--accent)]"><span className="run-spinner" /> {queueMsg}</div><button onClick={leaveQueue} className="cf-btn-secondary">&gt; cancel_search</button></div> : <button onClick={joinQueue} className="cf-btn mt-6 w-full">&gt; enter_queue <span className="ml-auto">↗</span></button>}<p className="mt-4 border-t border-[var(--border)] pt-4 font-mono text-[10px] text-[var(--text-faint)]">match rules: 45s read · 10m code · hidden tests · server-side judge</p></article>

            <article className="terminal-panel p-5 sm:p-7"><div className="flex items-start justify-between border-b border-[var(--border)] pb-4"><div><p className="terminal-kicker">alternate inline state</p><h2 className="mt-2 text-xl font-medium tracking-[-0.04em]">Opponent search.</h2></div><span className="terminal-badge text-[var(--accent)]">{inQueue ? 'active' : 'ready'}</span></div><div className="mt-7 flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center border border-[var(--accent)] font-mono text-[var(--accent)]">/</span><div className="font-mono text-[11px]"><p>searching for opponent <span className="text-[var(--accent)]">▮</span></p><p className="mt-1 text-[10px] text-[var(--text-muted)]">queue id / Q-7F2A · entered 00:14 ago</p></div></div><div className="mt-7 border-y border-[var(--border)] py-5 font-mono text-[11px] text-[var(--accent)]">[ / ] [ - ] [ \ ] [ | ] [ / ] [ - ]<p className="mt-4 text-[10px] text-[var(--text-muted)]">expanding search window <span className="text-[var(--text)]">1,642 — 2,042</span></p></div><div className="mt-5 border border-[var(--border)] px-3 py-3 font-mono text-[10px] text-[var(--text-muted)]">&gt; cancel_search <span className="float-right">×</span></div></article>
          </section>

          <section id="history" className="mt-10"><div className="mb-4 flex items-end justify-between"><div><p className="terminal-kicker">recent duel log</p><h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">Your latest executions.</h2></div><span className="font-mono text-[10px] text-[var(--text-muted)]">view all history →</span></div><div className="overflow-x-auto border border-[var(--border)]"><table className="cf-table border-0"><thead><tr><th>problem</th><th>opponent</th><th>result</th><th>time</th><th>elo Δ</th></tr></thead><tbody>{matches.length ? matches.map((match) => { const result = resultLabel(match); return <tr key={match.matchId}><td><div className="font-medium text-[var(--text)]">{match.problemId}</div><div className="font-mono text-[10px] uppercase text-[var(--text-muted)]">{match.category} / {match.difficulty}</div></td><td className="font-mono text-[11px] text-[var(--text-muted)]">@opponent · —</td><td className={`font-mono text-[11px] font-semibold ${result.className}`}>{result.label}</td><td className="font-mono text-[11px] text-[var(--text-muted)]">{match.endTime ? 'completed' : '—'}</td><td className="font-mono text-[11px] text-[var(--accent)]">{match.won ? '+18' : match.isDraw ? '+00' : '-16'}</td></tr>; }) : <tr><td colSpan={5} className="py-10 text-center font-mono text-[11px] text-[var(--text-muted)]">No duel telemetry yet. Enter the queue to create the first signal.</td></tr>}</tbody></table></div></section>

          <section className="mt-6 grid gap-4 md:grid-cols-[1fr_0.6fr]"><div className="terminal-panel p-5"><div className="flex items-center justify-between"><div><p className="terminal-kicker">contextual loading state</p><h2 className="mt-2 text-lg font-medium">Loading live telemetry.</h2></div><span className="terminal-badge">sync/02</span></div><div className="mt-6 flex gap-4"><div className="skeleton h-16 w-32" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-4/5" /><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-3/5" /></div></div><p className="mt-5 font-mono text-[10px] text-[var(--text-muted)]"><span className="text-[var(--accent)]">▯</span> hydrating /arena data…</p></div><div id="settings" className="terminal-panel p-5"><p className="terminal-kicker">quick profile</p><div className="mt-4 flex items-center justify-between"><div><p className="font-mono text-[12px]">@{user.username}</p><p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">candidate · {user.matchesPlayed} matches</p></div><Link href={`/profile/${user.username}`} className="flex h-10 w-10 items-center justify-center border border-[var(--accent)] text-[var(--accent)] no-underline"><BarChart3 size={15} /></Link></div><div className="mt-5 flex gap-2 font-mono text-[10px] text-[var(--text-muted)]"><span className="border border-[var(--border)] px-2 py-1">python</span><span className="border border-[var(--border)] px-2 py-1">cpp</span><span className="border border-[var(--border)] px-2 py-1">java</span></div></div></section>

          <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-[var(--border)] pt-5 font-mono text-[10px] text-[var(--text-faint)]"><span>duecit / terminal noir · build 0.8.4</span><span>every match is a lesson. win or lose.</span></footer>
        </div>
      </main>
    </div>
  );
}
