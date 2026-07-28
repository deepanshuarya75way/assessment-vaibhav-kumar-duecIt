'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Check, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import AppNav from '@/components/AppNav';
import CodeShowcase from '@/components/CodeShowcase';

const FEATURES = [
  { code: '01', title: 'ELO matchmaking', body: 'Paired with opponents inside a ±200 rating window, per category.' },
  { code: '02', title: 'Hidden test cases', body: 'Server-side judging against tests you never see. No harness guessing.' },
  { code: '03', title: 'Shared clock', body: '45 seconds to read, then 10 minutes to code. Identical timing for both.' },
];

const STEPS = [
  { step: '01 / queue', title: 'Find a match', body: 'Choose category, difficulty, and mode. Matchmaking keeps the field close.' },
  { step: '02 / read', title: 'Read the problem', body: 'Both engineers get the same statement and a shared 45 second read phase.' },
  { step: '03 / code', title: 'Write your solution', body: 'Use the editor you know. Run samples, watch the clock, stay in the arena.' },
  { step: '04 / judge', title: 'Earn the delta', body: 'Hidden cases run server-side. Win, learn, and let your ELO reflect it.' },
];

const reveal = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.push(user.role === 'admin' ? '/admin' : '/dashboard');
  }, [user, loading, router]);

  return (
    <div className="terminal-shell">
      <AppNav />

      <main>
        <section className="terminal-grid border-b border-[var(--border)]">
          <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex min-h-[610px] flex-col justify-center border-r border-[var(--border)] px-6 py-20 lg:px-12 xl:px-16">
              <motion.div initial="hidden" animate="visible" variants={reveal} transition={{ duration: 0.35 }}>
                <p className="terminal-kicker text-[var(--accent)]">live competitive coding</p>
                <h1 className="mt-6 max-w-[590px] text-6xl font-semibold leading-[0.96] tracking-[-0.065em] sm:text-7xl xl:text-[88px]">
                  Real Coding.<br />
                  <span className="text-[var(--accent)]">Real Opponents.</span><br />
                  No AI.
                </h1>
                <p className="mt-8 max-w-[430px] font-mono text-[12px] leading-6 text-[var(--text-muted)]">
                  A focused arena for engineers who want to think clearly, write under pressure, and earn their rating against another human being.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link href="/register" className="cf-btn no-underline">&gt; enter_arena <ArrowUpRight size={14} /></Link>
                  <Link href="#protocol" className="cf-btn-secondary no-underline">&gt; view_protocol</Link>
                </div>
                <p className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                  <span className="live-dot" /> waiting for your next commit · no spectators mode
                </p>
              </motion.div>
            </div>
            <div className="flex items-center bg-[var(--panel)] p-6 lg:p-8 xl:p-10">
              <motion.div className="w-full" initial="hidden" animate="visible" variants={reveal} transition={{ delay: 0.12, duration: 0.4 }}>
                <CodeShowcase opponent="alex_k · 1847" />
              </motion.div>
            </div>
          </div>
        </section>

        <section className="border-b border-[var(--border)]">
          <div className="mx-auto grid max-w-[1440px] divide-y border-x border-[var(--border)] md:grid-cols-4 md:divide-x md:divide-y-0">
            <div className="p-5 font-mono text-[11px] text-[var(--text-muted)]"><span className="text-[var(--accent)]">$</span> the protocol is simple<br /><span className="text-[var(--text-faint)]">performance over posturing</span></div>
            <div className="p-5 font-mono text-[11px] text-[var(--text-muted)]"><span className="text-[var(--accent)]">01</span> ELO matchmaking<br /><span className="text-[var(--text-faint)]">±200 rating window</span></div>
            <div className="p-5 font-mono text-[11px] text-[var(--text-muted)]"><span className="text-[var(--accent)]">02</span> hidden test cases<br /><span className="text-[var(--text-faint)]">server-side judging</span></div>
            <div className="p-5 font-mono text-[11px] text-[var(--text-muted)]"><span className="text-[var(--accent)]">03</span> 45s read / 10m code<br /><span className="text-[var(--text-faint)]">same clock, same problem</span></div>
          </div>
        </section>

        <section id="protocol" className="border-b border-[var(--border)] py-24">
          <div className="mx-auto max-w-[1440px] px-6 lg:px-12">
            <div className="flex flex-col justify-between gap-6 border-b border-[var(--border)] pb-8 lg:flex-row lg:items-end">
              <div>
                <p className="terminal-kicker text-[var(--accent)]">protocol</p>
                <h2 className="mt-4 max-w-[520px] text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-6xl">Four commands.<br />One honest result.</h2>
              </div>
              <p className="max-w-xs font-mono text-[11px] leading-5 text-[var(--text-muted)]">No feed to scroll. No AI to prompt. Pick a problem, meet your opponent, and let the judge decide what the code can do.</p>
            </div>
            <div className="grid border-b border-l border-[var(--border)] md:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step, index) => (
                <motion.article key={step.step} className="min-h-[220px] border-r border-b border-[var(--border)] p-6 xl:border-b-0" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={reveal} transition={{ delay: index * 0.06, duration: 0.3 }}>
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent)]"><span>{step.step}</span><ChevronRight size={13} /></div>
                  <h3 className="mt-12 text-2xl font-medium tracking-[-0.04em]">{step.title}</h3>
                  <p className="mt-3 max-w-[240px] font-mono text-[11px] leading-5 text-[var(--text-muted)]">{step.body}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[var(--border)]">
          <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[0.8fr_1.2fr]">
            <div className="border-r border-[var(--border)] px-6 py-20 lg:px-12">
              <p className="terminal-kicker text-[var(--accent)]">system readout</p>
              <h2 className="mt-4 max-w-md text-4xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-5xl">Built for engineers.<br />Not spectators.</h2>
              <p className="mt-5 max-w-md font-mono text-[11px] leading-5 text-[var(--text-muted)]">DuecIt is deliberately small, fast, and a little opinionated. The interface stays quiet so the problem, the code, and the other person stay loud.</p>
              <pre className="mt-8 font-mono text-[11px] leading-6 text-[var(--text-muted)]"><span className="text-[var(--accent)]">const</span> focus = <span className="text-[var(--accent)]">true</span>;<br /><span className="text-[var(--accent)]">const</span> excuses = <span className="text-[var(--danger)]">false</span>;</pre>
            </div>
            <div className="p-6 lg:p-12">
              <div className="divide-y divide-[var(--border)] border-y border-[var(--border)] font-mono text-[11px]">
                {[
                  ['matchmaking.window', '±200 ELO'],
                  ['judge.visibility', 'hidden tests'],
                  ['duel.clock', '00:45 + 10:00'],
                  ['practice.mode', 'one focused attempt'],
                  ['rating.delta', 'server-calculated'],
                ].map(([key, value]) => <div key={key} className="flex items-center justify-between gap-5 py-4"><span className="text-[var(--text-muted)]">{key}</span><span className={value === '±200 ELO' || value === 'server-calculated' ? 'text-[var(--accent)]' : 'text-[var(--text)]'}>{value}</span></div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[var(--border)] px-6 py-16 lg:px-12">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-8 flex items-end justify-between gap-6"><div><p className="terminal-kicker text-[var(--accent)]">why duecit</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">No theater. Just signal.</h2></div><span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)] md:block">system / nominal</span></div>
            <div className="grid border-l border-t border-[var(--border)] md:grid-cols-3">
              {FEATURES.map((feature) => <article key={feature.code} className="border-b border-r border-[var(--border)] p-6"><div className="font-mono text-[11px] text-[var(--accent)]">{feature.code}</div><h3 className="mt-12 text-xl font-medium">{feature.title}</h3><p className="mt-3 max-w-xs font-mono text-[11px] leading-5 text-[var(--text-muted)]">{feature.body}</p><Check className="mt-8 text-[var(--accent)]" size={15} /></article>)}
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center gap-5 px-6 py-20 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]"><span className="text-[var(--accent)]">/ ready state</span> · new opponents are waiting in the queue</p>
          <Link href="/register" className="cf-btn no-underline">&gt; start_first_duel <ArrowUpRight size={14} /></Link>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-5 lg:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 font-mono text-[10px] text-[var(--text-faint)]"><span>DuecIt — real-time coding duels // every match is a lesson</span><span className="text-[var(--accent)]">status: operational</span></div>
      </footer>
    </div>
  );
}
