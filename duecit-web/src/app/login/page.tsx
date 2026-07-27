'use client';
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api, oauthLoginUrl } from '@/lib/api';

import AuthShell from '@/components/AuthShell';
import { PasswordField, TextField, FormError, OAuthButtons } from '@/components/form';
 
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
    const authError = params.get('error');
    if (!authError) return;
    const id = setTimeout(() => setError(authError || 'Login failed'), 0);
    return () => clearTimeout(id);
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
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue your duels"
      showcase="editor"
      quote="Built for engineers. Not spectators."
    >
      <FormError message={error} />
 
      <OAuthButtons
        providers={providers}
        googleLabel="Continue with Google"
        githubLabel="Continue with GitHub"
        href={oauthLoginUrl}
      />
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="Username or email"
          value={loginStr}
          onChange={setLoginStr}
          placeholder="you@example.com"
          icon="mail"
          autoComplete="username"
          required
        />
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
        <div className="text-right">
          <Link href="/forgot-password" className="text-[12.5px] text-[var(--text-muted)] no-underline hover:text-[var(--accent)]">
            Forgot password?
          </Link>
        </div>
      
        <button type="submit" disabled={loading} className="cf-btn w-full py-2.5">
          {loading ? 'Signing in…' : '›_ Continue'}
        </button>
      </form>
 
      <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">
        No account?{' '}
        <Link href="/register" className="font-semibold text-[var(--accent)] no-underline">
          Sign up free
        </Link>
      </p>
    </AuthShell>
  );
}