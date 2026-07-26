'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, GitBranch, Mail, Lock, User, Swords, Zap,
  Terminal, Check, X, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, oauthLoginUrl } from '@/lib/api';
import ThemeToggle from './ThemeToggle';

export type AuthMode = 'login' | 'register' | 'forgot';

/* ─── Password strength ─────────────────────────────────────────── */
function passwordStrength(p: string) {
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (score <= 1) return { score, label: 'Weak', color: 'var(--error)' };
  if (score === 2) return { score, label: 'Fair', color: 'var(--warning)' };
  if (score === 3) return { score, label: 'Good', color: 'var(--warning)' };
  if (score === 4) return { score, label: 'Strong', color: 'var(--success)' };
  return { score, label: 'Very Strong', color: 'var(--success)' };
}

const RULES = [
  { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'One uppercase letter' },
  { test: (p: string) => /[0-9]/.test(p), label: 'One number' },
];

/* ─── Login showcase (code editor) ──────────────────────────────── */
const CODE_SNIPPETS = [
  { lang: 'python', lines: ['def solve(nums, target):', '    seen = {}', '    for i, n in enumerate(nums):', '        if target-n in seen:', '            return [seen[target-n], i]', '        seen[n] = i'] },
  { lang: 'cpp', lines: ['vector<int> solve(vector<int>& nums, int t) {', '  unordered_map<int,int> m;', '  for(int i=0;i<nums.size();i++) {', '    if(m.count(t-nums[i]))', '      return {m[t-nums[i]], i};', '    m[nums[i]]=i; }', '}'] },
];

function LoginShowcase() {
  const [snippet, setSnippet] = useState(0);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const current = CODE_SNIPPETS[snippet];
    if (typed < current.lines.length) {
      const id = setTimeout(() => setTyped((t) => t + 1), 280);
      return () => clearTimeout(id);
    }
    const reset = setTimeout(() => {
      setTyped(0);
      setSnippet((s) => (s + 1) % CODE_SNIPPETS.length);
    }, 2400);
    return () => clearTimeout(reset);
  }, [typed, snippet]);

  const current = CODE_SNIPPETS[snippet];

  return (
    <div className="flex flex-col justify-between h-full p-10 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full blur-[100px]" style={{ background: 'var(--bg-glow-blue)' }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full blur-[100px]" style={{ background: 'var(--bg-glow-purple)' }} />
      </div>

      <div className="flex items-center gap-2 relative z-10">
        <LogoMark size="md" />
        <span className="font-bold text-lg text-primary">DuecIt</span>
      </div>

      <div className="relative z-10">
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-theme" style={{ background: 'var(--editor-bg)' }}>
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-theme" style={{ background: 'var(--editor-chrome)' }}>
            <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]/70" />
            <span className="ml-3 text-xs text-muted font-mono">solution.{current.lang}</span>
            <div className="ml-auto text-xs font-mono font-bold" style={{ color: 'var(--success)' }}>LIVE · 03:47</div>
          </div>
          <div className="p-5 font-mono text-sm min-h-[180px]">
            {current.lines.slice(0, typed).map((line, i) => (
              <motion.div key={`${snippet}-${i}`} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3">
                <span className="w-4 text-right shrink-0 select-none" style={{ color: 'var(--editor-line)' }}>{i + 1}</span>
                <span className="text-secondary">{line}</span>
              </motion.div>
            ))}
            {typed < current.lines.length && (
              <div className="flex gap-3">
                <span className="w-4 text-right shrink-0" style={{ color: 'var(--editor-line)' }}>{typed + 1}</span>
                <span className="animate-blink text-primary">|</span>
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-theme flex items-center gap-2" style={{ background: 'var(--editor-bg)' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Opponent is coding…</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
          className="mt-4 rounded-2xl px-5 py-3 flex items-center gap-3 border"
          style={{ background: 'var(--success-dim)', borderColor: 'rgba(34,197,94,0.2)' }}
        >
          <Zap size={16} style={{ color: 'var(--success)' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--success)' }}>Accepted — 47/47</p>
            <p className="text-xs text-muted">+18 elo · new rating: 1,842</p>
          </div>
        </motion.div>
      </div>

      <p className="text-sm text-muted italic relative z-10">&ldquo;Built for engineers. Not spectators.&rdquo;</p>
    </div>
  );
}

/* ─── Register showcase (match cards) ───────────────────────────── */
function RegisterShowcase() {
  const matches = [
    { r1: 'sarah_codes', rt1: 2104, r2: 'mr_byte', rt2: 2089, problem: 'LRU Cache', result: '+22 elo' },
    { r1: 'devkumar_19', rt1: 1842, r2: 'alex_k', rt2: 1798, problem: 'Two Sum', result: '+18 elo' },
  ];

  return (
    <div className="flex flex-col justify-between h-full p-10 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full blur-[100px]" style={{ background: 'var(--bg-glow-purple)' }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full blur-[100px]" style={{ background: 'var(--bg-glow-blue)' }} />
      </div>

      <div className="flex items-center gap-2 relative z-10">
        <LogoMark size="md" />
        <span className="font-bold text-lg text-primary">DuecIt</span>
      </div>

      <div className="relative z-10 space-y-4">
        {matches.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.2 }}
            className="rounded-2xl p-4 border border-theme surface-card"
            style={{ background: 'var(--editor-bg)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
                Finished
              </span>
              <span className="text-xs font-bold font-mono" style={{ color: 'var(--success)' }}>{m.result}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-primary">{m.r1} <span className="text-muted text-xs font-mono">({m.rt1})</span></span>
              <span className="text-muted text-xs">vs</span>
              <span className="font-semibold text-secondary">{m.r2} <span className="text-muted text-xs font-mono">({m.rt2})</span></span>
            </div>
            <p className="text-xs text-muted mt-1">{m.problem}</p>
          </motion.div>
        ))}
      </div>

      <p className="text-sm text-muted italic relative z-10">&ldquo;Every match is a lesson. Win or lose.&rdquo;</p>
    </div>
  );
}

function LogoMark({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-8 h-8 rounded-xl' : 'w-7 h-7 rounded-lg';
  const iconSize = size === 'md' ? 16 : 14;
  return (
    <div className={`${cls} bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center`}>
      <Swords size={iconSize} className="text-white" />
    </div>
  );
}

/* ─── Auth form fields ──────────────────────────────────────────── */
function AuthInput({
  label, icon, type = 'text', value, onChange, placeholder, required, autoComplete, rightElement,
}: {
  label: string;
  icon: React.ReactNode;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-secondary uppercase tracking-wider">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full surface-input border hover:border-[var(--border-light)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-dim)] rounded-xl px-4 py-2.5 pl-9 text-sm placeholder:text-muted outline-none transition-all"
          style={rightElement ? { paddingRight: '2.5rem' } : undefined}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
    </div>
  );
}

/* ─── Main AuthPanel ────────────────────────────────────────────── */
interface AuthPanelProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  initialError?: string;
}

export default function AuthPanel({ mode, onModeChange, onClose, initialError }: AuthPanelProps) {
  const { login, register } = useAuth();
  const router = useRouter();

  const [loginStr, setLoginStr] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false });

  useEffect(() => {
    api.getOAuthProviders().then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const strength = passwordStrength(password);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginStr, password);
      onClose();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, email, password);
      onClose();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
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

  const titles: Record<AuthMode, { h: string; sub: string }> = {
    login: { h: 'Welcome back', sub: 'Sign in to continue your duels' },
    register: { h: 'Create your account', sub: 'Join 1,200+ engineers already competing' },
    forgot: { h: 'Forgot password?', sub: "Enter your email and we'll send you a reset link" },
  };

  return (
    <motion.div
      className="auth-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Left showcase */}
      <div className="hidden lg:block w-1/2 auth-panel-left">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode === 'register' ? 'register' : 'login'}
            className="h-full"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3 }}
          >
            {mode === 'register' ? <RegisterShowcase /> : <LoginShowcase />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Right form */}
      <div className="flex-1 auth-panel-right flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme">
          <div className="flex items-center gap-2 lg:hidden">
            <LogoMark />
            <span className="font-bold text-primary">DuecIt</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <ThemeToggle />
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-muted hover:text-primary hover:bg-[var(--bg-elevated)] transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-8 overflow-y-auto">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { onModeChange('login'); setError(''); setMessage(''); }}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-6 transition-colors"
              >
                <ArrowLeft size={14} /> Back to login
              </button>
            )}

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-primary">{titles[mode].h}</h1>
              <p className="text-sm text-muted mt-1">{titles[mode].sub}</p>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="mb-4 px-4 py-3 rounded-xl text-sm border"
                style={{ background: 'var(--error-dim)', borderColor: 'rgba(239,68,68,0.2)', color: 'var(--error)' }}>
                {error}
              </motion.div>
            )}
            {message && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="mb-4 px-4 py-3 rounded-xl text-sm border"
                style={{ background: 'var(--success-dim)', borderColor: 'rgba(34,197,94,0.2)', color: 'var(--success)' }}>
                {message}
              </motion.div>
            )}

            {mode !== 'forgot' && (providers.google || providers.github) && (
              <>
                <div className="space-y-2.5 mb-5">
                  {providers.google && (
                    <a href={oauthLoginUrl('google')}
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-theme text-sm text-primary font-medium rounded-xl transition-all hover:bg-[var(--bg-elevated)]">
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {mode === 'register' ? 'Sign up with Google' : 'Continue with Google'}
                    </a>
                  )}
                  {providers.github && (
                    <a href={oauthLoginUrl('github')}
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-theme text-sm text-primary font-medium rounded-xl transition-all hover:bg-[var(--bg-elevated)]">
                      <GitBranch size={16} />
                      {mode === 'register' ? 'Sign up with GitHub' : 'Continue with GitHub'}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-xs text-muted">or</span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>
              </>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <AuthInput label="Username or Email" icon={<Mail size={15} />} value={loginStr}
                  onChange={setLoginStr} placeholder="you@example.com" required autoComplete="username" />
                <div className="space-y-1.5">
                  <AuthInput label="Password" icon={<Lock size={15} />} type={showPassword ? 'text' : 'password'}
                    value={password} onChange={setPassword} placeholder="••••••••" required autoComplete="current-password"
                    rightElement={
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-muted hover:text-secondary">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    } />
                  <div className="text-right">
                    <button type="button" onClick={() => { onModeChange('forgot'); setError(''); }}
                      className="text-xs transition-colors" style={{ color: 'var(--primary)' }}>
                      Forgot password?
                    </button>
                  </div>
                </div>
                <motion.button type="submit" disabled={loading}
                  whileHover={!loading ? { y: -1 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Terminal size={15} />}
                  {loading ? 'Signing in…' : 'Continue'}
                </motion.button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <AuthInput label="Username" icon={<User size={15} />} value={username}
                  onChange={setUsername} placeholder="coolcoder99" required autoComplete="username" />
                <AuthInput label="Email" icon={<Mail size={15} />} type="email" value={email}
                  onChange={setEmail} placeholder="you@example.com" required autoComplete="email" />
                <div className="space-y-1.5">
                  <AuthInput label="Password" icon={<Lock size={15} />} type={showPassword ? 'text' : 'password'}
                    value={password} onChange={setPassword} placeholder="Min 8 characters" required autoComplete="new-password"
                    rightElement={
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-muted hover:text-secondary">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    } />
                  {password.length > 0 && (
                    <div className="space-y-2 mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <motion.div key={s} className="flex-1 h-1 rounded-full"
                            animate={{ backgroundColor: s <= strength.score ? strength.color : 'var(--border)' }}
                            transition={{ duration: 0.2 }} />
                        ))}
                      </div>
                      <p className="text-xs font-semibold" style={{ color: strength.color }}>{strength.label}</p>
                      <div className="space-y-1">
                        {RULES.map((rule) => {
                          const ok = rule.test(password);
                          return (
                            <div key={rule.label} className="flex items-center gap-1.5">
                              {ok ? <Check size={11} style={{ color: 'var(--success)' }} /> : <X size={11} className="text-[var(--border-light)]" />}
                              <span className="text-xs" style={{ color: ok ? 'var(--success)' : 'var(--text-muted)' }}>{rule.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <motion.button type="submit" disabled={loading}
                  whileHover={!loading ? { y: -1 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {loading ? 'Creating account…' : 'Create Account'}
                </motion.button>
              </form>
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleForgot} className="space-y-4">
                <AuthInput label="Email" icon={<Mail size={15} />} type="email" value={email}
                  onChange={setEmail} placeholder="you@example.com" required autoComplete="email" />
                <motion.button type="submit" disabled={loading}
                  whileHover={!loading ? { y: -1 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}
                  className="w-full px-4 py-2.5 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </motion.button>
              </form>
            )}

            {mode === 'login' && (
              <p className="text-center text-sm text-muted mt-6">
                No account?{' '}
                <button type="button" onClick={() => { onModeChange('register'); setError(''); }}
                  className="font-medium transition-colors" style={{ color: 'var(--primary)' }}>
                  Sign up free
                </button>
              </p>
            )}
            {mode === 'register' && (
              <p className="text-center text-sm text-muted mt-6">
                Already have an account?{' '}
                <button type="button" onClick={() => { onModeChange('login'); setError(''); }}
                  className="font-medium transition-colors" style={{ color: 'var(--primary)' }}>
                  Log in
                </button>
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
