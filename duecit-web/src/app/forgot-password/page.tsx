'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import AppNav from '@/components/AppNav';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setMessage('If an account exists for that email, a reset link has been sent.');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process password reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md cf-panel p-6">
          <h1 className="text-xl font-bold mb-4 text-[var(--cf-blue)]">Reset Password</h1>
          {error && <p className="text-red-600 text-sm mb-4 border border-red-300 bg-red-50 p-2">{error}</p>}
          {message && <p className="text-green-700 text-sm mb-4 border border-green-300 bg-green-50 p-2">{message}</p>}

          <form onSubmit={handleSubmit} className="space-y-3">
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
            <button type="submit" disabled={loading} className="cf-btn w-full py-2 disabled:opacity-50">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
          <p className="text-center text-xs text-[var(--cf-muted)] mt-4">
            Remembered it? <Link href="/login" className="text-[var(--cf-blue)] underline">Login</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
