'use client';
 
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import AppNav from '@/components/AppNav';
import CodeShowcase from '@/components/CodeShowcase';
 
const STATS = [
  { value: '1.2k+', label: 'Developers' },
  { value: '8.4k+', label: 'Duels played' },
  { value: '200+', label: 'Problems' },
];
 
const FEATURES = [
  {
    title: 'ELO matchmaking',
    body: 'Paired with opponents inside a ±200 rating window, per category.',
  },
  {
    title: 'Server-synced phases',
    body: '45s to read the problem, then 10 minutes of coding — identical clocks for both players.',
  },
  {
    title: 'Hidden test cases',
    body: 'Submissions are judged server-side against tests you never see. No guessing the harness.',
  },
  {
    title: 'Two modes',
    body: 'Competitive for rating and multiple submits, Practice for a single, focused attempt.',
  },
];
 
const STEPS = [
  { step: '01', title: 'Queue up', body: 'Pick a category, difficulty and mode, then enter the queue.' },
  { step: '02', title: 'Read & code', body: 'Both players get the same problem and the same clock.' },
  { step: '03', title: 'Submit & rate', body: 'Server-side judging decides the duel and updates your ELO.' },
];
 
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
 
  useEffect(() => {
    if (!loading && user) {
      router.push(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [user, loading, router]);
 
  return (
    <div className="min-h-screen">
      <AppNav />
 
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="badge animate-fade-up">
              <span className="live-dot" />
              3 live duels happening now
            </span>
 
            <h1 className="animate-fade-up delay-1 mt-6 text-5xl font-bold leading-[1.05] tracking-tight lg:text-6xl">
              Real Coding.
              <br />
              <span style={{ color: 'var(--accent)' }}>Real Opponents.</span>
              <br />
              No AI.
            </h1>
 
            <p className="animate-fade-up delay-2 mt-6 max-w-md text-[15px] text-[var(--text-muted)]">
              Compete against engineers in real-time coding battles. ELO matchmaking, hidden test
              cases, server-side judging.
            </p>
 
            <div className="animate-fade-up delay-3 mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="cf-btn px-6 py-2.5 no-underline">
                Start coding
              </Link>
              <Link href="/login" className="cf-btn-secondary px-6 py-2.5 no-underline">
                I have an account
              </Link>
            </div>
 
            <dl className="animate-fade-up delay-4 mt-12 flex gap-10">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt className="mono text-2xl font-bold">{s.value}</dt>
                  <dd className="text-xs uppercase tracking-wider text-[var(--text-muted)]">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
 
          <div className="animate-fade-up delay-3">
            <CodeShowcase />
          </div>
        </div>
      </section>
      {/* Features */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-2xl font-bold tracking-tight">Built for engineers. Not spectators.</h2>
          <p className="mt-2 text-[var(--text-muted)]">Everything you need for a fair duel, nothing you don&apos;t.</p>
 
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="cf-panel panel-hover p-5">
                <h3 className="text-[15px] font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] text-[var(--text-muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* How it works */}
      <section className="border-t border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-2xl font-bold tracking-tight">How a duel works</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.step} className="cf-panel panel-hover p-5">
                <span className="mono text-xs font-bold" style={{ color: 'var(--accent)' }}>
                  {s.step}
                </span>
                <h3 className="mt-2 text-[15px] font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-[13.5px] text-[var(--text-muted)]">{s.body}</p>
              </div>
            ))}
          </div>
 
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <p className="text-lg font-semibold">Ready to find your true competitor?</p>
            <Link href="/register" className="cf-btn px-7 py-2.5 no-underline">
              Create your account
            </Link>
          </div>
        </div>
      </section>
 
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-[13px] text-[var(--text-muted)]">
          <span className="mono">DuecIt — real-time coding duels</span>
          <span>Every match is a lesson. Win or lose.</span>
        </div>
      </footer>
    </div>
  );
}