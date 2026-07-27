
'use client';
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { wsClient } from '@/lib/ws';
import AppNav, { ratingClass } from '@/components/AppNav';
 
function goToMatch(router: ReturnType<typeof useRouter>, data: Record<string, unknown>) {
  const matchId = data.matchId as string;
  sessionStorage.setItem(`match:${matchId}`, JSON.stringify(data));
  router.push(`/duel/${matchId}`);
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
        if (active?.matchId) {
          goToMatch(router, active as Record<string, unknown>);
          return;
        }
      } catch { /* no active match */ }
      try {
        const pending = await api.getPendingMatch();
        if (pending?.matchId) {
          goToMatch(router, pending as Record<string, unknown>);
          return;
        }
      } catch { /* no pending match */ }
      try {
        await api.getQueueStatus();
        setInQueue(true);
        setQueueMsg('Searching for opponent...');
      } catch { /* not in queue */ }
    };
    restoreSession();
 
    const unsubFound = wsClient.on('match:found', (data) => {
      setInQueue(false);
      goToMatch(router, data);
    });
    return () => {
      unsubFound();
    };
  }, [user, isAdmin, router]);
 
  useEffect(() => {
    if (!inQueue || !user || isAdmin) return;
    const poll = async () => {
      try {
        const match = await api.getPendingMatch();
        if (match && match.matchId) {
          setInQueue(false);
          goToMatch(router, match);
        }
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
      if (result.match && result.match.matchId) {
        goToMatch(router, result.match as Record<string, unknown>);
        return;
      }
      setInQueue(true);
      setQueueMsg('Searching for opponent...');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join queue');
    }
  };
 
  const leaveQueue = async () => {
    try {
      await api.leaveQueue();
      setInQueue(false);
      setQueueMsg('');
    } catch { /* ignore */ }
  };
 
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-[var(--text-muted)]">
        <span className="run-spinner" />
        Loading…
      </div>
    );
  }
 
  const rating = category === 'db' ? user.ratingDB : user.ratingDSA;
 
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-4xl p-5">
        <div className="animate-fade-up mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user.username}</h1>
            <p className="text-[13.5px] text-[var(--text-muted)]">Pick your battlefield and enter the queue.</p>
          </div>
          <Link href={`/profile/${user.username}`} className="cf-btn-secondary no-underline">
            View profile
          </Link>
        </div>
 
        
        <div className="animate-fade-up delay-1 mb-5 grid gap-4 sm:grid-cols-3">
          <div className="cf-panel panel-hover p-4">
            <p className="field-label">DSA rating</p>
            <p className={`mono text-2xl font-bold ${ratingClass(user.ratingDSA)}`}>{user.ratingDSA}</p>
          </div>
          <div className="cf-panel panel-hover p-4">
            <p className="field-label">DB rating</p>
            <p className={`mono text-2xl font-bold ${ratingClass(user.ratingDB)}`}>{user.ratingDB}</p>
          </div>
          <div className="cf-panel panel-hover p-4">
            <p className="field-label">Matches played</p>
            <p className="mono text-2xl font-bold">{user.matchesPlayed}</p>
          </div>
        </div>
 
        <div className="cf-panel animate-fade-up delay-2 p-5">
          <h2 className="text-[15px] font-semibold">Enter a duel</h2>
          <p className="mt-1 mb-4 text-[12.5px] text-[var(--text-muted)]">
            45s reading · 10 min coding · match ends when both submit or time runs out
          </p>
          {error && (
            <p
              className="animate-fade-in mb-4 rounded-lg border px-3 py-2 text-[13px]"
              style={{
                borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)',
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
              }}
            >
              {error}
            </p>
          )}
 

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <label>

              <span className="field-label">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={inQueue}
                className="cf-select w-full"
              >
                <option value="dsa">DSA</option>
                {/* <option value="db">Database</option> */}
              </select>
            </label>
            <label>

              <span className="field-label">Difficulty</span>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                disabled={inQueue}
                className="cf-select w-full"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label>

              <span className="field-label">Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                disabled={inQueue}
                className="cf-select w-full"
              >
                <option value="competitive">Competitive</option>
                <option value="practice">Practice</option>
              </select>
            </label>
          </div>
 

          <p className="mb-5 text-[13px] text-[var(--text-muted)]">
            Your {category.toUpperCase()} rating{' '}
            <span className={`mono font-bold ${ratingClass(rating)}`}>{rating}</span> · choose your
            language in the editor during the duel.
          </p>
 
          {inQueue ? (

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-1 items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2.5 text-[13.5px] font-semibold">
                <span className="run-spinner" />
                {queueMsg}
              </div>

              <button onClick={leaveQueue} className="cf-btn-secondary">
                Cancel
              </button>
            </div>
          ) : (

            <button onClick={joinQueue} className="cf-btn px-6 py-2.5">
              Enter queue
            </button>
          )}
        </div>
      </main>
    </div>
  );
}