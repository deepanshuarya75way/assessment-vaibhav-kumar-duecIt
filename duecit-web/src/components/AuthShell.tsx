'use client';

import { ReactNode } from 'react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import CodeShowcase from '@/components/CodeShowcase';

const RECENT_DUELS = [
  { a: 'sarah_codes', ra: 2104, b: 'mr_byte', rb: 2089, problem: 'LRU Cache', elo: 22 },
  { a: 'devkumar_19', ra: 1842, b: 'alex_k', rb: 1798, problem: 'Two Sum', elo: 18 },
];

type Showcase = 'duels' | 'editor';

export default function AuthShell({
  title,
  subtitle,
  showcase = 'duels',
  quote = 'Every match is a lesson. Win or lose.',
  children,
}: {
  title: string;
  subtitle?: string;
  showcase?: Showcase;
  quote?: string;
  children: ReactNode;
}) {
  return (
    <div className="terminal-shell grid min-h-screen lg:grid-cols-[15%_46%_39%]">
      <aside className="hidden flex-col border-r border-[var(--border)] bg-[var(--bg)] px-7 py-8 lg:flex">
        <Logo />
        <div className="mt-24 border-l border-[var(--accent)] pl-4 font-mono text-[11px] leading-7 text-[var(--text-muted)]">
          <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">protocol 01</p>
          <p>Real opponents.</p>
          <p>Real code.</p>
          <p>No spectators.</p>
        </div>
        <div className="mt-auto space-y-5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
          <p className="flex items-center gap-2 text-[var(--accent)]"><span className="live-dot" /> systems nominal</p>
          <p>v0.8.4<br />auth gateway / east-1</p>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-col border-r border-[var(--border)] bg-[var(--panel)]">
        <header className="flex min-h-16 items-center justify-between border-b border-[var(--border)] px-6 lg:px-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">/ identity checkpoint</span>
          <ThemeToggle />
        </header>
        <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-6 py-12 lg:px-12">
          <div className="mb-8 animate-fade-up">
            <p className="terminal-kicker text-[var(--accent)]">secure sign-in</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[var(--text)]">{title}<span className="text-[var(--accent)]">.</span></h1>
            {subtitle && <p className="mt-2 font-mono text-[12px] text-[var(--text-muted)]">{subtitle}</p>}
          </div>
          <div className="animate-fade-up delay-1">{children}</div>
        </div>
      </main>

      <aside className="hidden min-w-0 flex-col bg-[var(--bg)] px-8 py-8 xl:flex">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          <span>live duel / replay</span>
          <span className="flex items-center gap-2 text-[var(--accent)]"><span className="live-dot" /> opponent is coding</span>
        </div>
        <div className="my-auto">
          {showcase === 'editor' ? (
            <CodeShowcase opponent="alex_k · 1798" />
          ) : (
            <div className="space-y-3">
              {RECENT_DUELS.map((d, i) => (
                <div key={d.problem} className={`terminal-panel panel-hover animate-fade-up delay-${i + 1} p-4`}>
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em]">
                    <span className="flex items-center gap-2 text-[var(--success)]"><span className="live-dot" /> finished</span>
                    <span className="text-[var(--accent)]">+{d.elo} elo</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
                    <span>{d.a} <span className="font-mono text-[10px] text-[var(--text-muted)]">({d.ra})</span></span>
                    <span className="font-mono text-[10px] text-[var(--text-faint)]">vs</span>
                    <span>{d.b} <span className="font-mono text-[10px] text-[var(--text-muted)]">({d.rb})</span></span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-[var(--text-muted)]">{d.problem}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-[var(--border)] pt-4 font-mono text-[10px] text-[var(--text-faint)]">“{quote}”</div>
      </aside>
    </div>
  );
}
