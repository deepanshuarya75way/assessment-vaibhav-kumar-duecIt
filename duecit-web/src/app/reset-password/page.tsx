'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Swords, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setTimeout(() => {
      setToken(t);
      if (!t) setError('Reset token is missing.');
    }, 0);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!token) { setError('Reset token is missing.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setMessage('Password reset. Redirecting to login…');
      setTimeout(() => router.push('/login'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen surface flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-7 h-7 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-lg flex items-center justify-center">
            <Swords size={14} className="text-white" />
          </div>
          <span className="font-bold text-primary">DuecIt</span>
        </div>

        <h1 className="text-2xl font-bold text-primary mb-1">Choose a new password</h1>
        <p className="text-sm text-muted mb-8">Make it strong. You&apos;re a competitor.</p>

        {error && <div className="mb-4 px-4 py-3 bg-[var(--error-dim)] border border-[color-mix(in_srgb,var(--error)_20%,transparent)] rounded-xl text-sm text-[var(--error)]">{error}</div>}
        {message && <div className="mb-4 px-4 py-3 bg-[var(--success-dim)] border border-[color-mix(in_srgb,var(--success)_20%,transparent)] rounded-xl text-sm text-[var(--success)]">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'New password', val: password, set: setPassword, show: showPass, toggle: () => setShowPass(v => !v), auto: 'new-password' },
            { label: 'Confirm password', val: confirmPassword, set: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(v => !v), auto: 'new-password' },
          ].map((field) => (
            <div key={field.label} className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">{field.label}</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type={field.show ? 'text' : 'password'} value={field.val} onChange={(e) => field.set(e.target.value)}
                  required minLength={8} autoComplete={field.auto} placeholder="Min 8 characters"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] hover:border-[var(--border-light)] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 rounded-xl px-4 py-2.5 pl-9 pr-10 text-sm text-primary placeholder:text-muted outline-none transition-all" />
                <button type="button" onClick={field.toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
                  {field.show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}

          <motion.button type="submit" disabled={loading || !token} whileHover={!loading ? { y: -1 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-semibold rounded-xl transition-all">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {loading ? 'Resetting…' : 'Reset password'}
          </motion.button>
        </form>

        <Link href="/login" className="flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors mt-6">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </motion.div>
    </div>
  );
}
