'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Trophy, Swords, ArrowLeft, Calendar, GitBranch } from 'lucide-react';
import { api, MatchHistoryEntry, User } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppNav, { ratingClass, ratingTier } from '@/components/AppNav';
import Badge from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';

function ResultBadge({ m }: { m: MatchHistoryEntry }) {
  if (m.status !== 'finished') return <span className="text-xs text-muted capitalize">{m.phase}</span>;
  if (m.isDraw) return <Badge variant="orange">Draw</Badge>;
  if (m.won) return <Badge variant="green">Win</Badge>;
  return <Badge variant="red">Loss</Badge>;
}

function Avatar({ user }: { user: User }) {
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt={user.username} className="w-20 h-20 rounded-full border-2 border-[var(--border)] object-cover" />;
  }
  return (
    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--purple)] flex items-center justify-center text-3xl font-bold text-white border-2 border-[var(--border)]">
      {user.username[0]?.toUpperCase()}
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const username = params.username as string;
  const [profile, setProfile] = useState<{ user: User; matches: MatchHistoryEntry[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/?auth=login');
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user) return;
    api.getProfile(username)
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : 'Profile not found'));
  }, [username, user, loading]);

  if (loading || !user) return <FullPageSpinner />;

  const matches = profile?.matches ?? [];
  const wins = matches.filter(m => m.won && m.status === 'finished').length;
  const losses = matches.filter(m => !m.won && !m.isDraw && m.status === 'finished').length;
  const winRate = matches.filter(m => m.status === 'finished').length > 0
    ? Math.round((wins / matches.filter(m => m.status === 'finished').length) * 100)
    : 0;

  return (
    <div className="min-h-screen surface">
      <AppNav />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors mb-6">
          <ArrowLeft size={14} /> Dashboard
        </Link>

        {error && (
          <div className="alert-error rounded-2xl p-4 mb-6">{error}</div>
        )}

        {!profile && !error && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
        )}

        {profile && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="app-card rounded-2xl p-6 mb-5">
              <div className="flex flex-wrap items-start gap-5">
                <Avatar user={profile.user} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h1 className="text-2xl font-bold text-primary">{profile.user.username}</h1>
                    {profile.user.oauthProvider === 'github' && <GitBranch size={16} className="text-muted" />}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xl font-bold font-mono ${ratingClass(profile.user.ratingDSA)}`}>
                      {profile.user.ratingDSA}
                    </span>
                    <span className="px-2.5 py-0.5 badge-tier rounded-full text-xs font-semibold">
                      {ratingTier(profile.user.ratingDSA)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted mt-2">
                    <Calendar size={12} />
                    <span>{profile.user.matchesPlayed} matches played</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Matches',  value: profile.user.matchesPlayed, color: 'text-[var(--primary)]' },
                { label: 'Wins',     value: wins,     color: 'text-[var(--success)]' },
                { label: 'Losses',   value: losses,   color: 'text-[var(--error)]' },
                { label: 'Win Rate', value: `${winRate}%`, color: 'text-[var(--purple)]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="app-card app-card-hover rounded-2xl p-4 transition-colors">
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-2">{label}</p>
                  <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="app-card rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
                <Swords size={15} className="text-[var(--primary)]" />
                <h2 className="font-bold text-primary">Match History</h2>
              </div>

              {matches.length === 0 ? (
                <div className="py-16 text-center">
                  <Swords size={28} className="text-[var(--border-light)] mx-auto mb-3" />
                  <p className="text-sm text-muted">No matches yet</p>
                  <p className="text-xs text-[var(--border-light)] mt-1">Enter a queue to get started</p>
                </div>
              ) : (
                <div>
                  <div className="hidden sm:grid grid-cols-5 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider table-head">
                    <div>Problem</div>
                    <div>Difficulty</div>
                    <div>Mode</div>
                    <div>Result</div>
                    <div>Date</div>
                  </div>
                  {matches.map((m, i) => (
                    <motion.div
                      key={m.matchId}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-5 py-3.5 border-b border-[var(--border)] last:border-0 row-hover transition-colors text-sm"
                    >
                      <div className="font-mono text-xs text-secondary truncate">{m.problemId}</div>
                      <div className="hidden sm:block">
                        <Badge variant={(m.difficulty as 'easy' | 'medium' | 'hard') || 'gray'} className="capitalize">
                          {m.difficulty}
                        </Badge>
                      </div>
                      <div className="hidden sm:block text-xs text-muted capitalize">{m.mode}</div>
                      <div><ResultBadge m={m} /></div>
                      <div className="hidden sm:block text-xs text-muted font-mono">
                        {new Date(m.startTime).toLocaleDateString()}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 app-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={15} className="text-[var(--warning)]" />
                <h3 className="font-bold text-primary">Ratings</h3>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">DSA</p>
                  <p className={`text-2xl font-bold font-mono ${ratingClass(profile.user.ratingDSA)}`}>
                    {profile.user.ratingDSA}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{ratingTier(profile.user.ratingDSA)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
