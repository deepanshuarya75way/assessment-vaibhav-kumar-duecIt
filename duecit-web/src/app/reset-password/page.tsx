'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import AppNav from '@/components/AppNav';

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
    <div className="min-h-screen">
      <AppNav />
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md cf-panel p-6">
          <h1 className="text-xl font-bold mb-4 text-[var(--cf-blue)]">Choose New Password</h1>
          {error && <p className="text-red-600 text-sm mb-4 border border-red-300 bg-red-50 p-2">{error}</p>}
          {message && <p className="text-green-700 text-sm mb-4 border border-green-300 bg-green-50 p-2">{message}</p>}

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold">New password (min 8 chars)</span>
              <input
                type="password"
                minLength={8}
                className="cf-input w-full mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold">Confirm new password</span>
              <input
                type="password"
                minLength={8}
                className="cf-input w-full mt-1"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={loading || !token} className="cf-btn w-full py-2 disabled:opacity-50">
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
          <p className="text-center text-xs text-[var(--cf-muted)] mt-4">
            Need a new link? <Link href="/forgot-password" className="text-[var(--cf-blue)] underline">Request one</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
