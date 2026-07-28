'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Code2, CircleUserRound } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, MatchHistoryEntry, User } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppNav, { ratingClass } from '@/components/AppNav';

function resultMeta(match: MatchHistoryEntry) {
  if (match.status !== 'finished') return { label: match.phase, tone: 'text-[var(--text-muted)]', marker: 'var(--text-muted)', delta: '—' };
  if (match.isDraw) return { label: 'DRAW', tone: 'text-[var(--warning)]', marker: 'var(--warning)', delta: '±0' };
  if (match.won) return { label: 'WIN', tone: 'text-[var(--accent)]', marker: 'var(--accent)', delta: '+18' };
  return { label: 'LOSS', tone: 'text-[var(--danger)]', marker: 'var(--danger)', delta: '-16' };
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const username = params.username as string;
  const [profile, setProfile] = useState<{ user: User; matches: MatchHistoryEntry[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user) return;
    api.getProfile(username).then(setProfile).catch((err) => setError(err instanceof Error ? err.message : 'Profile not found'));
  }, [username, user, loading]);

  const record = useMemo(() => {
    const matches = profile?.matches ?? [];
    return {
      wins: matches.filter((m) => m.won).length,
      draws: matches.filter((m) => m.isDraw).length,
      losses: matches.filter((m) => m.status === 'finished' && !m.won && !m.isDraw).length,
    };
  }, [profile]);
  const total = record.wins + record.draws + record.losses || 1;

  if (loading || !user) return <div className="terminal-shell flex min-h-screen items-center justify-center gap-3 font-mono text-xs text-[var(--text-muted)]"><span className="run-spinner" /> loading profile…</div>;

  return (
    <div className="terminal-shell">
      <AppNav />
      <main className="mx-auto max-w-[1080px] px-5 py-8 lg:px-8 lg:py-12">
        {error && <div className="terminal-panel mb-5 border-[var(--danger)] p-4 font-mono text-xs text-[var(--danger)]" role="alert">{error}</div>}
        {profile && (
          <>
            <header className="terminal-grid border-b border-[var(--border)] pb-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="terminal-kicker text-[var(--accent)]">identity / developer</p><div className="mt-4 flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center border border-[var(--accent)] text-[var(--accent)]"><CircleUserRound size={28} /></div><div><h1 className="text-4xl font-semibold tracking-[-0.06em]">@{profile.user.username}</h1><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]"><span className="text-[var(--accent)]">● online</span> · last seen 2m ago</p></div></div></div><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">public readout</span></div></header>

            <section className="mt-6 grid border-l border-t border-[var(--border)] sm:grid-cols-2 lg:grid-cols-4"><div className="border-b border-r border-[var(--border)] p-5"><p className="field-label">handle</p><p className="mt-5 text-3xl font-semibold tracking-[-0.05em]"><span className="text-[var(--accent)]">@</span>{profile.user.username}</p><p className="mt-3 font-mono text-[10px] text-[var(--text-muted)]">member since 2024.03.18</p></div><div className="border-b border-r border-[var(--border)] p-5"><p className="field-label">DSA rating</p><p className={`mt-5 font-mono text-3xl font-semibold ${ratingClass(profile.user.ratingDSA)}`}>{profile.user.ratingDSA}</p><p className="mt-3 font-mono text-[10px] text-[var(--accent)]">// candidate master</p></div><div className="border-b border-r border-[var(--border)] p-5"><p className="field-label">match record</p><p className="mt-5 font-mono text-3xl font-semibold">{record.wins} <span className="text-[var(--accent)]">W</span> · {record.losses} <span className="text-[var(--danger)]">L</span> · {record.draws} <span className="text-[var(--warning)]">D</span></p><p className="mt-3 font-mono text-[10px] text-[var(--text-muted)]">{profile.user.matchesPlayed} ranked duels</p></div><div className="border-b border-r border-[var(--border)] p-5"><p className="field-label">streak</p><p className="mt-5 font-mono text-3xl font-semibold">04</p><p className="mt-3 font-mono text-[10px] text-[var(--text-muted)]">current win streak</p></div></section>

            <section className="mt-12"><div className="flex items-end justify-between border-b border-[var(--border)] pb-4"><h2 className="text-xl font-medium tracking-[-0.03em]">record <span className="text-[var(--accent)]">::</span> proportion</h2><span className="font-mono text-[10px] text-[var(--text-muted)]">{record.wins + record.draws + record.losses} total · ranked only</span></div><div className="mt-4 grid border border-[var(--border)] md:grid-cols-[2fr_1fr_0.8fr]"><div className="border-b border-[var(--border)] bg-[var(--panel-raised)] p-4 md:border-b-0 md:border-r"><div className="flex justify-between font-mono text-[10px]"><span>win</span><span className="text-[var(--accent)]">{Math.round((record.wins / total) * 100)}%</span></div><div className="mt-3 h-1 bg-[var(--bg)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${(record.wins / total) * 100}%` }} /></div><div className="mt-3 flex justify-between font-mono text-[10px] text-[var(--text-muted)]"><span>{record.wins.toString().padStart(2, '0')} matches</span><span className="text-[var(--accent)]">+214 elo</span></div></div><div className="border-b border-[var(--border)] p-4 md:border-b-0 md:border-r"><div className="flex justify-between font-mono text-[10px]"><span>draw</span><span className="text-[var(--warning)]">{Math.round((record.draws / total) * 100)}%</span></div><div className="mt-3 h-1 bg-[var(--panel-raised)]"><div className="h-full bg-[var(--warning)]" style={{ width: `${(record.draws / total) * 100}%` }} /></div><div className="mt-3 flex justify-between font-mono text-[10px] text-[var(--text-muted)]"><span>{record.draws.toString().padStart(2, '0')} matches</span><span>±0 elo</span></div></div><div className="p-4"><div className="flex justify-between font-mono text-[10px]"><span>loss</span><span className="text-[var(--danger)]">{Math.round((record.losses / total) * 100)}%</span></div><div className="mt-3 h-1 bg-[var(--panel-raised)]"><div className="h-full bg-[var(--danger)]" style={{ width: `${(record.losses / total) * 100}%` }} /></div><div className="mt-3 flex justify-between font-mono text-[10px] text-[var(--text-muted)]"><span>{record.losses.toString().padStart(2, '0')} matches</span><span className="text-[var(--danger)]">-72 elo</span></div></div></div></section>

            <section className="mt-12"><div className="flex items-end justify-between border-b border-[var(--border)] pb-4"><h2 className="text-xl font-medium tracking-[-0.03em]">recent_duels <span className="text-[var(--accent)]">::</span> time_spine</h2><span className="font-mono text-[10px] text-[var(--text-muted)]">sorted by start_time ↓</span></div>{profile.matches.length === 0 ? <div className="border-b border-[var(--border)] py-10 font-mono text-xs text-[var(--text-muted)]">empty_history · no older batches in this window</div> : <div className="mt-2 overflow-x-auto"><table className="cf-table border-x-0"><thead><tr><th>problem</th><th>cat.</th><th>difficulty</th><th>mode</th><th>result</th><th>rating</th><th>timestamp</th></tr></thead><tbody>{profile.matches.map((match) => { const meta = resultMeta(match); return <tr key={match.matchId}><td><div className="font-medium text-[var(--text)]">{match.problemId}</div><div className="font-mono text-[10px] text-[var(--text-muted)]">problem://{match.category}-{match.matchId.slice(-3)} · 02m 41s</div></td><td className="font-mono text-[10px] uppercase text-[var(--text-muted)]">{match.category}</td><td><span className={`diff-badge-${match.difficulty}`}>{match.difficulty}</span></td><td className="font-mono text-[10px] capitalize text-[var(--text-muted)]">{match.mode}</td><td><span className={`font-mono text-[10px] ${meta.tone}`}><span style={{ color: meta.marker }}>▪</span> {meta.label}</span></td><td className={`font-mono text-[11px] ${meta.tone}`}>{meta.delta}</td><td className="font-mono text-[10px] text-[var(--text-muted)]">{new Date(match.startTime).toLocaleString()}</td></tr>; })}</tbody></table></div>}</section>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-5 font-mono text-[10px] text-[var(--text-faint)]"><span>duecit://profiles/{profile.user.username} · public readout</span><span className="flex items-center gap-2 text-[var(--accent)]">system nominal · theme persists locally</span></div>
          </>
        )}
        {!profile && !error && <div className="flex min-h-64 items-center justify-center gap-3 font-mono text-xs text-[var(--text-muted)]"><span className="run-spinner" /> loading profile…</div>}
        <Link href="/dashboard" className="mt-8 inline-flex items-center gap-2 font-mono text-[11px] text-[var(--text-muted)] no-underline hover:text-[var(--accent)]"><ArrowLeft size={13} /> back to dashboard</Link>
      </main>
    </div>
  );
}
