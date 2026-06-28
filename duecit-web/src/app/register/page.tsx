'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api, oauthLoginUrl } from '@/lib/api';
import AppNav from '@/components/AppNav';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false });

  useEffect(() => {
    api.getOAuthProviders().then(setProviders).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md cf-panel p-6">
          <h1 className="text-xl font-bold mb-4 text-[var(--cf-blue)]">Register</h1>
          {error && <p className="text-red-600 text-sm mb-4 border border-red-300 bg-red-50 p-2">{error}</p>}

          <div className="flex flex-col gap-2 mb-4">
            {providers.google && (
              <a href={oauthLoginUrl('google')} className="cf-btn text-center no-underline py-2">
                Sign up with Google
              </a>
            )}
            {providers.github && (
              <a href={oauthLoginUrl('github')} className="cf-btn-secondary text-center no-underline py-2 block">
                Sign up with GitHub
              </a>
            )}
            {(providers.google || providers.github) && (
              <div className="text-center text-[var(--cf-muted)] text-xs my-1">— or —</div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold">Username</span>
              <input
                className="cf-input w-full mt-1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold">Email</span>
              <input
                type="email"
                className="cf-input w-full mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold">Password (min 8 chars)</span>
              <input
                type="password"
                minLength={8}
                className="cf-input w-full mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={loading} className="cf-btn w-full py-2 disabled:opacity-50">
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
          <p className="text-center text-xs text-[var(--cf-muted)] mt-4">
            Have an account? <Link href="/login" className="text-[var(--cf-blue)] underline">Login</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
