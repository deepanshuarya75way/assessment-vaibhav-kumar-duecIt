'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, MatchHistoryEntry, User } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppNav, { ratingClass } from '@/components/AppNav';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const username = params.username as string;
  const [profile, setProfile] = useState<{ user: User; matches: MatchHistoryEntry[] } | null>(null);
  const [error, setError] = useState('');
  const matches = profile?.matches ?? [];

  useEffect(() => {
    if (!loading && !user) {
      setProfile(null);
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user) return;
    api.getProfile(username)
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : 'Profile not found'));
  }, [username, user, loading]);

  if (loading || !user) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-4xl mx-auto p-4">
        {error && (
          <div className="cf-panel p-4 text-red-600">{error}</div>
        )}
        {profile && (
          <>
            <div className="cf-panel p-4 mb-4">
              <div className="flex items-center gap-4">
                {profile.user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.user.avatarUrl} alt="" className="w-16 h-16 rounded-full border border-[var(--cf-border)]" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[var(--cf-blue-light)] flex items-center justify-center text-2xl font-bold text-[var(--cf-blue)]">
                    {profile.user.username[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold">{profile.user.username}</h1>
                  {profile.user.oauthProvider && (
                    <span className="text-xs text-[var(--cf-muted)] capitalize">
                      via {profile.user.oauthProvider}
                    </span>
                  )}
                </div>
              </div>

              <table className="cf-table mt-4">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Rating</th>
                    <th>Matches Played</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>DSA</td>
                    <td className={ratingClass(profile.user.ratingDSA)}>{profile.user.ratingDSA}</td>
                    <td rowSpan={2} className="align-middle">{profile.user.matchesPlayed}</td>
                  </tr>
                  <tr>
                    <td>Database</td>
                    <td className={ratingClass(profile.user.ratingDB)}>{profile.user.ratingDB}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="cf-panel p-4">
              <h2 className="font-bold mb-3">Recent Duels</h2>
              {matches.length === 0 ? (
                <p className="text-[var(--cf-muted)] text-sm">No matches yet.</p>
              ) : (
                <table className="cf-table">
                  <thead>
                    <tr>
                      <th>Problem</th>
                      <th>Category</th>
                      <th>Difficulty</th>
                      <th>Mode</th>
                      <th>Result</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m) => (
                      <tr key={m.matchId}>
                        <td>{m.problemId}</td>
                        <td className="uppercase">{m.category}</td>
                        <td className={`diff-${m.difficulty}`}>{m.difficulty}</td>
                        <td className="capitalize">{m.mode}</td>
                        <td>
                          {m.status !== 'finished' ? (
                            <span className="text-[var(--cf-muted)]">{m.phase}</span>
                          ) : m.isDraw ? (
                            <span className="text-[var(--cf-orange)]">Draw</span>
                          ) : m.won ? (
                            <span className="text-[var(--cf-green)] font-bold">Win</span>
                          ) : (
                            <span className="text-red-600">Loss</span>
                          )}
                        </td>
                        <td className="text-xs">
                          {new Date(m.startTime).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
        {!profile && !error && (
          <p className="text-center p-8 text-[var(--cf-muted)]">Loading profile...</p>
        )}
        <p className="mt-4 text-center">
          <Link href="/dashboard" className="text-[var(--cf-blue)] underline text-sm">← Back</Link>
        </p>
      </main>
    </div>
  );
}
