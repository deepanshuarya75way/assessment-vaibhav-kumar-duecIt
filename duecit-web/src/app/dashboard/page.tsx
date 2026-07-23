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
    return <div className="p-8 text-center">Loading...</div>;
  }

  const rating = category === 'db' ? user.ratingDB : user.ratingDSA;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-4xl mx-auto p-4">
        <h1 className="text-xl font-bold mb-4">Dashboard</h1>

        <div className="cf-panel p-4 mb-4">
          <h2 className="font-bold mb-3">Ratings</h2>
          <table className="cf-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Rating</th>
                <th>Matches</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>DSA</td>
                <td className={ratingClass(user.ratingDSA)}>{user.ratingDSA}</td>
                <td rowSpan={2} className="align-middle">{user.matchesPlayed}</td>
              </tr>
              {/* <tr>
                <td>Database</td>
                <td className={ratingClass(user.ratingDB)}>{user.ratingDB}</td>
              </tr> */}
            </tbody>
          </table>
          <p className="mt-2 text-[var(--cf-muted)] text-xs">
            <Link href={`/profile/${user.username}`} className="text-[var(--cf-blue)] underline">
              View full profile →
            </Link>
          </p>
        </div>

        <div className="cf-panel p-4">
          <h2 className="font-bold mb-3">Enter Duel</h2>
          <p className="text-xs text-[var(--cf-muted)] mb-3">
            Reading time: 45s · Coding time: 10 min · Match ends when both submit or time runs out
          </p>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

          <div className="grid grid-cols-3 gap-3 mb-4">
            <label>
              <span className="text-xs font-bold block mb-1">Category</span>
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
              <span className="text-xs font-bold block mb-1">Difficulty</span>
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
              <span className="text-xs font-bold block mb-1">Mode</span>
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

          <p className="text-sm mb-4">
            Your {category.toUpperCase()} rating:{' '}
            <span className={`font-bold ${ratingClass(rating)}`}>{rating}</span>
            {' · '}
            Choose language in the editor during the duel.
          </p>

          {inQueue ? (
            <div className="flex gap-3">
              <div className="flex-1 cf-panel p-3 text-center text-[var(--cf-blue)] font-bold">
                {queueMsg}
              </div>
              <button onClick={leaveQueue} className="cf-btn-secondary px-4">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={joinQueue} className="cf-btn px-6 py-2 font-bold">
              Enter Queue
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
