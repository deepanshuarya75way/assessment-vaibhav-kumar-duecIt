'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api, oauthLoginUrl } from '@/lib/api';
import AppNav from '@/components/AppNav';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loginStr, setLoginStr] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false });

  useEffect(() => {
    api.getOAuthProviders().then(setProviders).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) setError(params.get('error') || 'Login failed');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginStr, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md cf-panel p-6">
          <h1 className="text-xl font-bold mb-4 text-[var(--cf-blue)]">Login</h1>
          {error && <p className="text-red-600 text-sm mb-4 border border-red-300 bg-red-50 p-2">{error}</p>}

          <div className="flex flex-col gap-2 mb-4">
            {providers.google && (
              <a href={oauthLoginUrl('google')} className="cf-btn text-center no-underline py-2">
                Continue with Google
              </a>
            )}
            {providers.github && (
              <a href={oauthLoginUrl('github')} className="cf-btn-secondary text-center no-underline py-2 block">
                Continue with GitHub
              </a>
            )}
            {(providers.google || providers.github) && (
              <div className="text-center text-[var(--cf-muted)] text-xs my-1">— or —</div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold">Username or Email</span>
              <input
                className="cf-input w-full mt-1"
                value={loginStr}
                onChange={(e) => setLoginStr(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold">Password</span>
              <input
                type="password"
                className="cf-input w-full mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={loading} className="cf-btn w-full py-2 disabled:opacity-50">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <p className="text-center text-xs text-[var(--cf-muted)] mt-4">
            No account? <Link href="/register" className="text-[var(--cf-blue)] underline">Register</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
