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
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-[var(--text-muted)]">
        <span className="run-spinner" />
        Loading…
      </div>
    );
  }
 
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-4xl p-5">
        {error && (
          <div className="cf-panel p-4" style={{ color: 'var(--danger)' }}>{error}</div>
        )}
        {profile && (
          <>
            <div className="cf-panel animate-fade-up mb-5 p-5">
              <div className="flex items-center gap-4">
                {profile.user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.user.avatarUrl} alt="" className="h-16 w-16 rounded-full border border-[var(--border)]" />
                ) : (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--violet))' }}
                  >
                    {profile.user.username[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold tracking-tight">{profile.user.username}</h1>
                  {profile.user.oauthProvider && (
                    <span className="text-[12.5px] capitalize text-[var(--text-muted)]">
                      via {profile.user.oauthProvider}
                    </span>
                  )}
                </div>
              </div>
              <table className="cf-table mt-5">
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
            <div className="cf-panel animate-fade-up delay-1 p-5">
              <h2 className="mb-4 text-[15px] font-semibold">Recent duels</h2>
              {matches.length === 0 ? (
                <p className="text-[13.5px] text-[var(--text-muted)]">No matches yet.</p>
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
                            <span className="text-[var(--text-muted)]">{m.phase}</span>
                          ) : m.isDraw ? (
                            <span style={{ color: 'var(--cf-orange)' }}>Draw</span>
                          ) : m.won ? (
                            <span className="font-semibold" style={{ color: 'var(--success)' }}>Win</span>
                          ) : (
                            <span style={{ color: 'var(--danger)' }}>Loss</span>
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
          <p className="p-8 text-center text-[var(--text-muted)]">Loading profile…</p>
        )}
        
        <p className="mt-6 text-center">
          <Link href="/dashboard" className="text-[13px] text-[var(--text-muted)] no-underline hover:text-[var(--accent)]">
            ← Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}