'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import StatCard from '../components/ui/StatCard';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Swords, Zap, Users, Trophy, Shield, BarChart3,
  RefreshCw, Globe, Check, X, ArrowRight, Clock, Code2, Terminal,
  GitBranch, MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import ThemeToggle from '@/components/ThemeToggle';
import AuthPanel, { AuthMode } from '@/components/AuthPanel';

/* ─── Animated IDE mock ─────────────────────────────────────────── */
const IDE_LINES = [
  { text: 'def two_sum(nums, target):', color: '#60A5FA' },
  { text: '    seen = {}', color: '#94A3B8' },
  { text: '    for i, n in enumerate(nums):', color: '#94A3B8' },
  { text: '        diff = target - n', color: '#C084FC' },
  { text: '        if diff in seen:', color: '#34D399' },
  { text: '            return [seen[diff], i]', color: '#34D399' },
  { text: '        seen[n] = i', color: '#94A3B8' },
];

function AnimatedIDE() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [verdict, setVerdict] = useState<'none' | 'running' | 'ac'>('none');

  useEffect(() => {
    let line = 0;
    const id = setInterval(() => {
      line += 1;
      setVisibleLines(line);
      if (line >= IDE_LINES.length) {
        clearInterval(id);
        setTimeout(() => setVerdict('running'), 400);
        setTimeout(() => setVerdict('ac'), 1800);
      }
    }, 220);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="rounded-2xl overflow-hidden border border-theme" style={{ background: 'var(--editor-bg)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-theme" style={{ background: 'var(--editor-chrome)' }}>
          <div className="w-3 h-3 rounded-full bg-[#EF4444]/70" />
          <div className="w-3 h-3 rounded-full bg-[#F59E0B]/70" />
          <div className="w-3 h-3 rounded-full bg-[#22C55E]/70" />
          <span className="ml-3 text-xs text-muted font-mono">solution.py</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-mono font-bold" style={{ color: 'var(--warning)' }}>CODE: 08:32</span>
          </div>
        </div>
        <div className="p-4 font-mono text-sm min-h-[180px]">
          {IDE_LINES.slice(0, visibleLines).map((line, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3">
              <span className="w-4 text-right shrink-0 select-none" style={{ color: 'var(--editor-line)' }}>{i + 1}</span>
              <span style={{ color: line.color }}>{line.text}</span>
            </motion.div>
          ))}
          {visibleLines < IDE_LINES.length && (
            <div className="flex gap-3">
              <span className="w-4 text-right shrink-0" style={{ color: 'var(--editor-line)' }}>{visibleLines + 1}</span>
              <span className="animate-blink text-[#F8FAFC]">|</span>
            </div>
          )}
        </div>
        <div className={`px-4 py-2.5 border-t border-theme flex items-center gap-2 transition-all duration-300 ${
          verdict === 'running' ? 'bg-[#F59E0B]/8' : verdict === 'ac' ? 'bg-[#22C55E]/8' : ''
        }`} style={verdict === 'none' ? { background: 'var(--editor-chrome)' } : undefined}>
          {verdict === 'none' && <span className="text-xs text-muted">Ready to judge</span>}
          {verdict === 'running' && (
            <>
              <div className="w-3 h-3 border border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold" style={{ color: 'var(--warning)' }}>Judging 47 test cases…</span>
            </>
          )}
          {verdict === 'ac' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2">
              <Check size={14} style={{ color: 'var(--success)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--success)' }}>Accepted — 47/47 passed</span>
              <span className="ml-auto text-xs text-muted font-mono">+18 elo</span>
            </motion.div>
          )}
        </div>
      </div>
      <div className="absolute -top-3 -right-3 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
        vs alex_k · 1847
      </div>
    </div>
  );
}

/* ─── Live match feed ───────────────────────────────────────────── */
const LIVE_MATCHES = [
  { p1: 'devkumar_19', r1: 1842, p2: 'alex_k', r2: 1798, problem: 'Sliding Window Max', diff: 'medium', time: '04:21' },
  { p1: 'sarah_codes', r1: 2104, p2: 'mr_byte', r2: 2089, problem: 'LRU Cache', diff: 'hard', time: '07:55' },
  { p1: 'tenzin_dev', r1: 1523, p2: 'pqr_x', r2: 1491, problem: 'Two Sum', diff: 'easy', time: '02:11' },
];

const DIFF_COLORS: Record<string, string> = {
  easy: 'var(--success)',
  medium: 'var(--warning)',
  hard: 'var(--error)',
};

function LiveMatchCard({ match, delay }: { match: typeof LIVE_MATCHES[0]; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="surface-card border rounded-2xl p-4 transition-all duration-200 hover:-translate-y-px hover:border-[var(--border-light)]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--success)' }}>Live</span>
        </div>
        <span className="text-xs font-mono font-bold" style={{ color: 'var(--warning)' }}>{match.time}</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-primary">
          {match.p1} <span className="text-xs text-muted font-mono">({match.r1})</span>
        </div>
        <div className="text-xs font-bold text-muted px-2">vs</div>
        <div className="text-sm font-semibold text-primary text-right">
          {match.p2} <span className="text-xs text-muted font-mono">({match.r2})</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Code2 size={12} className="text-muted" />
        <span className="text-xs text-secondary">{match.problem}</span>
        <span className="ml-auto text-xs font-semibold capitalize" style={{ color: DIFF_COLORS[match.diff] }}>{match.diff}</span>
      </div>
    </motion.div>
  );
}

/* ─── Features ──────────────────────────────────────────────────── */
const FEATURES = [
  { icon: <Swords size={20} />, title: 'Real-Time Duels', desc: '1v1 coding battles against live opponents. No bots, no sandbagging.', color: 'blue' as const },
  { icon: <BarChart3 size={20} />, title: 'Elo Matchmaking', desc: 'Paired within ±200 of your rating. Every match is fair and competitive.', color: 'purple' as const },
  { icon: <Shield size={20} />, title: 'Hidden Test Cases', desc: 'Sample tests visible, full suite hidden. Just like real contests.', color: 'green' as const },
  { icon: <RefreshCw size={20} />, title: 'Replay Matches', desc: "Review your opponent's solution after every duel. Learn from every battle.", color: 'orange' as const },
  { icon: <BarChart3 size={20} />, title: 'Performance Analytics', desc: 'Track solve time, accuracy, and rating trend across every category.', color: 'blue' as const },
  { icon: <Globe size={20} />, title: 'Multi-Language', desc: 'Python, C++17, and Java supported. Pick your weapon.', color: 'purple' as const },
];

const FEAT_COLORS: Record<string, { border: string; icon: string }> = {
  blue:   { border: 'hover:border-[#3B82F6]/40', icon: 'text-[#3B82F6]' },
  purple: { border: 'hover:border-[#8B5CF6]/40', icon: 'text-[#8B5CF6]' },
  green:  { border: 'hover:border-[#22C55E]/40', icon: 'text-[#22C55E]' },
  orange: { border: 'hover:border-[#F59E0B]/40', icon: 'text-[#F59E0B]' },
};

function FeatureCard({ f, i }: { f: typeof FEATURES[0]; i: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const c = FEAT_COLORS[f.color];
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: (i % 3) * 0.1, duration: 0.4 }}
      className={`group surface-card border rounded-2xl p-5 transition-all duration-200 ${c.border}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${c.icon} transition-transform group-hover:scale-110 duration-200`}
        style={{ background: 'var(--bg-elevated)' }}>
        {f.icon}
      </div>
      <h3 className="font-bold text-primary mb-2">{f.title}</h3>
      <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
    </motion.div>
  );
}

const STEPS = [
  { icon: <Users size={16} />, label: 'Join Queue', desc: 'Select category, difficulty & mode', color: '#3B82F6' },
  { icon: <Swords size={16} />, label: 'Match Found', desc: 'Paired with an opponent near your rating', color: '#8B5CF6' },
  { icon: <Clock size={16} />, label: 'Reading Phase', desc: '45 seconds to read the problem', color: '#F59E0B' },
  { icon: <Terminal size={16} />, label: 'Coding Phase', desc: '10 minutes to write your solution', color: '#22C55E' },
  { icon: <Shield size={16} />, label: 'Judging', desc: 'Hidden test cases run server-side', color: '#EF4444' },
  { icon: <Trophy size={16} />, label: 'Rating Updated', desc: 'Elo adjusts based on result', color: '#F59E0B' },
];

function HowItWorks() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <section id="how-it-works" ref={ref} className="py-24 px-4 scroll-mt-16">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} className="text-center mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Process</span>
          <h2 className="text-3xl font-bold text-primary mt-3">How It Works</h2>
          <p className="text-muted mt-3">From queue to verdict in under 12 minutes</p>
        </motion.div>
        <div className="relative">
          <div className="absolute left-6 top-6 bottom-6 w-px bg-gradient-to-b from-[#3B82F6] via-[#8B5CF6] to-[#22C55E] opacity-30" />
          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex items-start gap-5 pl-2"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 z-10"
                  style={{ background: `${step.color}20`, border: `1px solid ${step.color}40`, color: step.color }}>
                  {step.icon}
                </div>
                <div className="pt-1">
                  <p className="font-semibold text-primary">{step.label}</p>
                  <p className="text-sm text-muted mt-0.5">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const COMPARE_ROWS = [
  { feature: 'Live Opponent', duecit: true, leet: false, cf: false },
  { feature: 'Real-time Matchmaking', duecit: true, leet: false, cf: false },
  { feature: 'Elo Rating System', duecit: true, leet: false, cf: true },
  { feature: 'Reading Phase', duecit: true, leet: false, cf: false },
  { feature: 'Hidden Test Cases', duecit: true, leet: true, cf: true },
  { feature: 'Match Replay', duecit: true, leet: false, cf: false },
  { feature: 'Multi-Language', duecit: true, leet: true, cf: true },
];

function ComparisonTable() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <section ref={ref} className="py-24 px-4" style={{ background: 'var(--bg-elevated)' }}>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} className="text-center mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Compare</span>
          <h2 className="text-3xl font-bold text-primary mt-3">Why Not the Others?</h2>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.2 }}>
          <div className="surface-card border rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 border-b border-theme">
              <div className="px-5 py-4 text-xs text-muted uppercase tracking-wider">Feature</div>
              {[
                { name: 'DuecIt', highlight: true },
                { name: 'LeetCode', highlight: false },
                { name: 'Codeforces', highlight: false },
              ].map((col) => (
                <div key={col.name} className={`px-4 py-4 text-center text-sm font-bold ${col.highlight ? '' : 'text-muted'}`}
                  style={col.highlight ? { color: 'var(--primary)' } : undefined}>
                  {col.highlight && <Swords size={14} className="inline mr-1.5 -mt-0.5" />}
                  {col.name}
                </div>
              ))}
            </div>
            {COMPARE_ROWS.map((row, i) => (
              <div key={i} className="grid grid-cols-4 border-b border-theme last:border-0 hover:bg-[var(--primary-dim)] transition-colors">
                <div className="px-5 py-3.5 text-sm text-secondary">{row.feature}</div>
                {[row.duecit, row.leet, row.cf].map((val, j) => (
                  <div key={j} className="px-4 py-3.5 flex justify-center">
                    {val
                      ? <Check size={16} style={{ color: j === 0 ? 'var(--success)' : 'var(--text-muted)' }} />
                      : <X size={16} className="text-[var(--border-light)]" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer({ onAuth }: { onAuth: (mode: AuthMode) => void }) {
  return (
    <footer className="border-t border-theme pt-16 pb-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-lg flex items-center justify-center">
                <Swords size={14} className="text-white" />
              </div>
              <span className="font-bold text-primary">DuecIt</span>
            </div>
            <p className="text-xs text-muted leading-relaxed max-w-[180px]">
              Real-time 1v1 coding duels for engineers who want to compete.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-lg text-muted hover:text-primary hover:bg-[var(--bg-elevated)] transition-colors">
                <GitBranch size={16} />
              </a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-lg text-muted hover:text-primary hover:bg-[var(--bg-elevated)] transition-colors">
                <MessageCircle size={16} />
              </a>
            </div>
          </div>
          {[
            { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Live Duels', href: '#live' }, { label: 'How It Works', href: '#how-it-works' }] },
            { title: 'Account', links: [{ label: 'Sign Up', action: 'register' as const }, { label: 'Log In', action: 'login' as const }] },
          ].map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {'href' in l ? (
                      <a href={l.href} className="text-sm text-muted hover:text-secondary transition-colors">{l.label}</a>
                    ) : (
                      <button type="button" onClick={() => onAuth(l.action)} className="text-sm text-muted hover:text-secondary transition-colors">
                        {l.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-theme pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted">© 2025 DuecIt. All rights reserved.</p>
          <p className="text-xs text-muted italic">Built for engineers. Not spectators.</p>
        </div>
      </div>
    </footer>
  );
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

/* ─── Main landing content ───────────────────────────────────────── */
function HomeContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [authError, setAuthError] = useState('');

  const openAuth = (mode: AuthMode) => {
    setAuthError('');
    setAuthMode(mode);
    window.history.replaceState(null, '', mode === 'login' ? '/?auth=login' : '/?auth=register');
  };

  const closeAuth = () => {
    setAuthMode(null);
    setAuthError('');
    window.history.replaceState(null, '', '/');
  };

  useEffect(() => {
    if (!loading && user) {
      router.push(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const auth = searchParams.get('auth');
    const error = searchParams.get('error');
    if (auth === 'login' || auth === 'register' || auth === 'forgot') {
      setAuthMode(auth);
    }
    if (error) setAuthError(decodeURIComponent(error));
  }, [searchParams]);

  if (loading) return null;

  return (
    <div className="min-h-screen surface">
      <AnimatePresence>
        {authMode && (
          <AuthPanel mode={authMode} onModeChange={setAuthMode} onClose={closeAuth} initialError={authError} />
        )}
      </AnimatePresence>

      {/* Navbar */}
      <nav className="app-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-lg flex items-center justify-center">
              <Swords size={14} className="text-white" />
            </div>
            <span className="font-bold text-base text-primary">DuecIt</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {[
              { label: 'Features', id: 'features' },
              { label: 'Live Duels', id: 'live' },
              { label: 'How It Works', id: 'how-it-works' },
            ].map((l) => (
              <button key={l.id} type="button" onClick={() => scrollTo(l.id)}
                className="px-3 py-1.5 text-sm text-secondary hover:text-primary hover:bg-[var(--bg-elevated)] rounded-lg transition-colors">
                {l.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button type="button" onClick={() => openAuth('login')}
              className="px-3 py-1.5 text-sm text-secondary hover:text-primary transition-colors">
              Log in
            </button>
            <button type="button" onClick={() => openAuth('register')}
              className="px-4 py-1.5 text-white text-sm font-semibold rounded-xl transition-all hover:-translate-y-px"
              style={{ background: 'var(--primary)', boxShadow: '0 4px 14px var(--shadow-primary)' }}>
              Sign up
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[120px]" style={{ background: 'var(--bg-glow-blue)' }} />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px]" style={{ background: 'var(--bg-glow-purple)' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 border"
                  style={{ background: 'var(--primary-dim)', borderColor: 'rgba(59,130,246,0.2)', color: 'var(--primary)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--primary)' }} />
                  {LIVE_MATCHES.length} live duels happening now
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
                className="text-5xl sm:text-6xl font-black text-primary leading-[1.1] mb-6 tracking-tight"
              >
                Real Coding.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]">Real Opponents.</span><br />
                No AI.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
                className="text-lg text-secondary mb-8 leading-relaxed max-w-xl"
              >
                Compete against engineers in real-time coding battles. Elo matchmaking, hidden test cases, server-side judging.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-wrap items-center gap-3"
              >
                <button type="button" onClick={() => openAuth('register')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-white font-bold rounded-xl transition-all hover:-translate-y-px text-sm"
                  style={{ background: 'var(--primary)', boxShadow: '0 6px 20px var(--shadow-primary)' }}>
                  <Zap size={16} /> Start Coding
                </button>
                <button type="button" onClick={() => scrollTo('how-it-works')}
                  className="inline-flex items-center gap-2 px-6 py-3 border border-theme text-secondary hover:text-primary font-semibold rounded-xl transition-all text-sm hover:bg-[var(--bg-elevated)]">
                  How It Works <ArrowRight size={14} />
                </button>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex items-center gap-6 mt-8">
                {[['1.2k+', 'Developers'], ['8.4k+', 'Duels Played'], ['200+', 'Problems']].map(([n, l]) => (
                  <div key={l}>
                    <p className="text-xl font-bold text-primary font-mono">{n}</p>
                    <p className="text-xs text-muted">{l}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.6 }}>
              <AnimatedIDE />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Live matches */}
      <section id="live" className="py-20 px-4 scroll-mt-16" style={{ background: 'var(--bg-elevated)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--success)' }}>Live Now</span>
            <h2 className="text-2xl font-bold text-primary mt-2">Matches in Progress</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {LIVE_MATCHES.map((m, i) => <LiveMatchCard key={i} match={m} delay={i * 0.1} />)}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Developers" value="1,200+" color="blue" />
          <StatCard label="Duels Played" value="8,400+" color="green" />
          <StatCard label="Problems" value="200+" color="purple" />
          <StatCard label="Avg Accuracy" value="67%" color="orange" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 scroll-mt-16" style={{ background: 'var(--bg-elevated)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Features</span>
            <h2 className="text-3xl font-bold text-primary mt-3">Why DuecIt</h2>
            <p className="text-muted mt-3 max-w-xl mx-auto">Everything built around one principle: make every match feel like it matters.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => <FeatureCard key={i} f={f} i={i} />)}
          </div>
        </div>
      </section>

      <HowItWorks />
      <ComparisonTable />

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="border rounded-3xl p-12 surface-card"
            style={{ borderColor: 'rgba(59,130,246,0.2)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="w-14 h-14 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Swords size={24} className="text-white" />
            </div>
            <h2 className="text-3xl font-black text-primary mb-4">Ready to Compete?</h2>
            <p className="text-secondary mb-8">Create your account and get matched in under 60 seconds.</p>
            <button type="button" onClick={() => openAuth('register')}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-bold rounded-xl transition-all hover:-translate-y-px text-base"
              style={{ background: 'var(--primary)', boxShadow: '0 8px 24px var(--shadow-primary)' }}>
              <Zap size={18} /> Start Coding Free
            </button>
            <p className="text-xs text-muted mt-4">No credit card required</p>
          </motion.div>
        </div>
      </section>

      <Footer onAuth={openAuth} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
