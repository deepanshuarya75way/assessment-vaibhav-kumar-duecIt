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
 
/**
 * Split-screen auth layout: an ambient product panel on the left,
 * the form on the right.
 */
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
    <div className="flex min-h-screen">
      {/* Left: ambient showcase */}
      <aside className="relative hidden w-1/2 flex-col justify-center overflow-hidden border-r border-[var(--border)] bg-[var(--bg-subtle)] px-10 lg:flex">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden />
        <div className="absolute left-10 top-8">
          <Logo />
        </div>
 
        <div className="relative w-full max-w-md animate-fade-up">
          {showcase === 'editor' ? (
            <CodeShowcase opponent="alex_k · 1798" />
          ) : (
            <div className="flex flex-col gap-3">
              {RECENT_DUELS.map((d, i) => (
                <div key={d.problem} className={`cf-panel panel-hover animate-fade-up delay-${i + 1} p-4`}>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-2 text-[var(--success)]">
                      <span className="live-dot" />
                      Finished
                    </span>
                    <span className="mono" style={{ color: 'var(--success)' }}>
                      +{d.elo} elo
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[14px]">
                    <span className="font-semibold">
                      {d.a} <span className="mono text-[12px] text-[var(--text-muted)]">({d.ra})</span>
                    </span>
                    <span className="mono text-[11px] text-[var(--text-faint)]">vs</span>
                    <span className="font-semibold">
                      {d.b} <span className="mono text-[12px] text-[var(--text-muted)]">({d.rb})</span>
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">{d.problem}</p>
                </div>
              ))}
            </div>
          )}
        </div>
 
        <p className="absolute bottom-8 left-10 text-[13px] italic text-[var(--text-faint)]">“{quote}”</p>
      </aside>
 
      {/* Right: form */}
      <main className="relative flex w-full flex-col justify-center px-6 py-14 lg:w-1/2 lg:px-16">
        <div className="absolute right-6 top-6 flex items-center gap-3">
          <ThemeToggle />
        </div>
        <div className="lg:hidden">
          <Logo />
        </div>
 
        <div className="mx-auto mt-8 w-full max-w-sm animate-fade-up lg:mt-0">
          <h1 className="text-[26px] font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[14px] text-[var(--text-muted)]">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}