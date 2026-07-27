'use client';
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api, oauthLoginUrl } from '@/lib/api';
import AuthShell from '@/components/AuthShell';
import { PasswordField, TextField, FormError, OAuthButtons } from '@/components/form';
 
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
    <AuthShell
      title="Create your account"
      subtitle="Join 1,200+ engineers already competing"
      showcase="duels"
    >
      <FormError message={error} />
 
          
      <OAuthButtons
        providers={providers}
        googleLabel="Sign up with Google"
        githubLabel="Sign up with GitHub"
        href={oauthLoginUrl}
      />
 
          
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="coolcoder99"
          icon="user"
          autoComplete="username"
          required
        />
        <TextField
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          icon="mail"
          type="email"
          autoComplete="email"
          required
        />
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Min 8 characters"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <button type="submit" disabled={loading} className="cf-btn w-full py-2.5">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
 
      <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-[var(--accent)] no-underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
