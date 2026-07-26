'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Trophy, Target, Clock, TrendingUp, Swords, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { wsClient } from '@/lib/ws';
import AppNav, { ratingClass, ratingTier } from '@/components/AppNav';
import StatCard from '@/components/ui/StatCard';
import { FullPageSpinner } from '@/components/ui/Spinner';

function goToMatch(router: ReturnType<typeof useRouter>, data: Record<string, unknown>) {
  const matchId = data.matchId as string;
  sessionStorage.setItem(`match:${matchId}`, JSON.stringify(data));
  router.push(`/duel/${matchId}`);
}

const DIFF_OPTIONS = [
  { value: 'easy',   label: 'Easy',   activeClass: 'chip-active-easy' },
  { value: 'medium', label: 'Medium', activeClass: 'chip-active-medium' },
  { value: 'hard',   label: 'Hard',   activeClass: 'chip-active-hard' },
];

const MODE_OPTIONS = [
  { value: 'competitive', label: 'Competitive', desc: 'Rated · affects Elo' },
  { value: 'practice',    label: 'Practice',    desc: 'Unrated · safe to explore' },
];

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [category, setCategory] = useState('dsa');
  const [difficulty, setDifficulty] = useState('easy');
  const [mode, setMode] = useState('competitive');
  const [inQueue, setInQueue] = useState(false);
  const [queueTime, setQueueTime] = useState(0);
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!loading && !user) router.push('/?auth=login');
    if (!loading && user?.role === 'admin') router.push('/admin');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || isAdmin) return;
    const token = localStorage.getItem('accessToken');
    if (token) wsClient.connect(token).catch(() => {});

    const restoreSession = async () => {
      try {
        const active = await api.getActiveMatch();
        if (active?.matchId) { goToMatch(router, active as Record<string, unknown>); return; }
      } catch { /* no active match */ }
      try {
        const pending = await api.getPendingMatch();
        if (pending?.matchId) { goToMatch(router, pending as Record<string, unknown>); return; }
      } catch { /* no pending match */ }
      try {
        await api.getQueueStatus();
        setInQueue(true);
      } catch { /* not in queue */ }
    };
    restoreSession();

    const unsubFound = wsClient.on('match:found', (data) => {
      setInQueue(false);
      goToMatch(router, data);
    });
    return () => { unsubFound(); };
  }, [user, isAdmin, router]);

  useEffect(() => {
    if (!inQueue) { setQueueTime(0); return; }
    const id = setInterval(() => setQueueTime((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [inQueue]);

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
      if (result.match?.matchId) { goToMatch(router, result.match as Record<string, unknown>); return; }
      setInQueue(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join queue');
    }
  };

  const leaveQueue = async () => {
    try { await api.leaveQueue(); } catch { /* ignore */ }
    setInQueue(false);
  };

  if (loading || !user) return <FullPageSpinner />;

  const rating = user.ratingDSA;
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen surface">
      <AppNav />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="text-sm text-muted mb-1">Welcome back,</p>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-primary">{user.username}</h1>
            <span className={`text-lg font-mono font-bold ${ratingClass(rating)}`}>{rating}</span>
            <span className="px-2.5 py-0.5 badge-tier rounded-full text-xs font-semibold">
              {ratingTier(rating)}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
        >
          <StatCard label="Matches" value={user.matchesPlayed} icon={<Swords size={16} />} color="blue" animate={false} delay={0} />
          <StatCard label="Wins" value={user.wins ?? 0} icon={<Trophy size={16} />} color="green" animate={false} delay={0.05} />
          <StatCard
            label="Win Rate"
            value={user.matchesPlayed > 0 ? `${Math.round(((user.wins ?? 0) / user.matchesPlayed) * 100)}%` : '—'}
            icon={<Target size={16} />}
            color="purple"
            animate={false}
            delay={0.1}
          />
          <StatCard label="Rating" value={rating} icon={<TrendingUp size={16} />} color="orange" animate={false} delay={0.15} />
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="lg:col-span-2 app-card rounded-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Swords size={16} className="text-[var(--primary)]" />
              <h2 className="font-bold text-primary">Start a Duel</h2>
              <div className="ml-auto text-xs text-muted flex items-center gap-1.5">
                <Clock size={12} /> Est. wait: ~30s
              </div>
            </div>

            <div className="p-5">
              {error && (
                <div className="mb-4 px-4 py-2.5 alert-error rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="mb-5">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Difficulty</p>
                <div className="flex gap-2">
                  {DIFF_OPTIONS.map((d) => (
                    <button key={d.value} onClick={() => !inQueue && setDifficulty(d.value)} disabled={inQueue}
                      className={`flex-1 py-2 px-3 rounded-xl border text-sm font-semibold transition-all duration-150 ${
                        difficulty === d.value ? d.activeClass : 'chip'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Mode</p>
                <div className="flex gap-2">
                  {MODE_OPTIONS.map((m) => (
                    <button key={m.value} onClick={() => !inQueue && setMode(m.value)} disabled={inQueue}
                      className={`flex-1 py-2.5 px-3 rounded-xl border text-left transition-all duration-150 ${
                        mode === m.value ? 'chip-active-primary' : 'chip'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}>
                      <p className="text-sm font-semibold">{m.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-sm text-muted mb-5">
                Your DSA rating:{' '}
                <span className={`font-bold font-mono ${ratingClass(rating)}`}>{rating}</span>
                {' · '}
                <span className="text-secondary">Choose language in editor</span>
              </p>

              <AnimatePresence mode="wait">
                {inQueue ? (
                  <motion.div key="in-queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="flex items-center gap-4 p-4 queue-banner rounded-2xl mb-3">
                      <Loader2 size={20} className="text-[var(--primary)] animate-spin shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--primary)]">Searching for opponent…</p>
                        <p className="text-xs text-muted font-mono mt-0.5">{formatTime(queueTime)}</p>
                      </div>
                      <div className="ml-auto flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div key={i} className="w-1.5 h-1.5 bg-[var(--primary)] rounded-full"
                            animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                        ))}
                      </div>
                    </div>
                    <button onClick={leaveQueue}
                      className="w-full py-2 btn-ghost text-sm font-semibold rounded-xl">
                      Cancel search
                    </button>
                  </motion.div>
                ) : (
                  <motion.button key="enter" onClick={joinQueue} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 btn-primary font-bold text-base rounded-xl hover:shadow-[0_6px_20px_var(--shadow-primary)]">
                    <Zap size={18} /> Enter Queue
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-4">
            <div className="app-card rounded-2xl p-4">
              <h3 className="text-sm font-bold text-primary mb-3">Quick Links</h3>
              <div className="space-y-1">
                {[
                  { href: `/profile/${user.username}`, label: 'My Profile', icon: <Trophy size={14} /> },
                  { href: '/leaderboard', label: 'Leaderboard', icon: <TrendingUp size={14} /> },
                ].map((item) => (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-secondary hover:text-primary hover:bg-[var(--bg-elevated)] rounded-xl transition-all group">
                    <span className="text-muted group-hover:text-secondary">{item.icon}</span>
                    {item.label}
                    <ChevronRight size={12} className="ml-auto text-[var(--border-light)] group-hover:text-muted" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="app-card rounded-2xl p-4">
              <h3 className="text-sm font-bold text-primary mb-3">Recent Duels</h3>
              <div className="text-center py-6">
                <Swords size={24} className="text-[var(--border-light)] mx-auto mb-2" />
                <p className="text-xs text-muted">No recent duels yet</p>
                <p className="text-xs text-muted mt-0.5">Enter a queue to get started</p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
