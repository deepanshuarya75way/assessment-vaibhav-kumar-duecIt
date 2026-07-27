'use client';
 
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import AuthShell from '@/components/AuthShell';
import { PasswordField, FormError, FormSuccess } from '@/components/form';
 
export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
 
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token') || '';
    const id = setTimeout(() => {
      setToken(resetToken);
      if (!resetToken) setError('Reset token is missing.');
    }, 0);
    return () => clearTimeout(id);
  }, []);
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!token) {
      setError('Reset token is missing.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setMessage('Password reset. Redirecting to login...');
      setTimeout(() => router.push('/login'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you haven't used before" showcase="editor">
      <FormError message={error} />
      <FormSuccess message={message} />
 
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          placeholder="Min 8 characters"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Repeat password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <button type="submit" disabled={loading || !token} className="cf-btn w-full py-2.5">
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
 
      <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">
        Need a new link?{' '}
        <Link href="/forgot-password" className="font-semibold text-[var(--accent)] no-underline">
          Request one
        </Link>
      </p>
    </AuthShell>
  );
}