'use client';
 
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import AuthShell from '@/components/AuthShell';
import { TextField, FormError, FormSuccess } from '@/components/form';
 
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
    <AuthShell title="Reset your password" subtitle="We'll email you a link to set a new one">
      <FormError message={error} />
      <FormSuccess message={message} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="Email"
          type="email"
          icon="mail"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <button type="submit" disabled={loading} className="cf-btn w-full py-2.5">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
 
      <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-[var(--accent)] no-underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}