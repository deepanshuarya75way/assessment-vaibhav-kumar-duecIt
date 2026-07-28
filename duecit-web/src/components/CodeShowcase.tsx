'use client';

import { useEffect, useState } from 'react';

const SOLUTION_LINES: Array<Array<{ t: string; c?: string }>> = [
  [{ t: 'def ', c: 'tok-kw' }, { t: 'two_sum', c: 'tok-fn' }, { t: '(nums, target):' }],
  [{ t: '    seen = {}' }],
  [{ t: '    for', c: 'tok-kw' }, { t: ' i, n ' }, { t: 'in', c: 'tok-kw' }, { t: ' enumerate(nums):' }],
  [{ t: '        diff = target - n' }],
  [{ t: '        if', c: 'tok-kw' }, { t: ' diff ' }, { t: 'in', c: 'tok-kw' }, { t: ' seen:' }],
  [{ t: '            return', c: 'tok-kw' }, { t: ' [seen[diff], i]' }],
  [{ t: '        seen[n] = i' }],
];

export default function CodeShowcase({ opponent = 'alex_k · 1847' }: { opponent?: string }) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (visible >= SOLUTION_LINES.length) return;
    const id = setTimeout(() => setVisible((n) => n + 1), visible === 0 ? 350 : 260);
    return () => clearTimeout(id);
  }, [visible]);

  const done = visible >= SOLUTION_LINES.length;

  return (
    <div className="code-card w-full">
      <div className="code-card-bar">
        <span className="code-dot bg-[#ff5f57]" />
        <span className="code-dot bg-[#febc2e]" />
        <span className="code-dot bg-[#28c840]" />
        <span className="ml-2">solution.py</span>
        <span className="ml-auto flex items-center gap-2 text-[var(--accent)]">
          <span className="live-dot" /> vs {opponent}
        </span>
      </div>

      <div className="grid min-h-[280px] grid-cols-[1fr_0.72fr]">
        <div className="border-r border-[var(--border)] px-4 py-5">
          <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <span>you / python 3</span>
            <span>coding</span>
          </div>
          {SOLUTION_LINES.map((line, i) => (
            <div key={i} className="code-line" style={{ opacity: i < visible ? 1 : 0.18, transition: 'opacity 220ms ease' }}>
              <span className="code-gutter">{String(i + 1).padStart(2, '0')}</span>
              <span className="whitespace-pre">
                {line.map((tok, j) => <span key={j} className={tok.c}>{tok.t}</span>)}
                {i === visible - 1 && !done && <span className="caret-blink">▍</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="p-4 font-mono text-[10px] text-[var(--text-muted)]">
          <div className="mb-4 flex items-center justify-between uppercase tracking-[0.12em]">
            <span>opponent / progress</span>
            <span>server sync</span>
          </div>
          <div className="flex items-center gap-2 border border-[var(--border)] p-2 text-[var(--text)]">
            <span className="border border-[var(--border-strong)] px-1.5 py-1">AK</span>
            <span>alex_k</span>
            <span className="ml-auto text-[var(--accent)]">1847 ELO</span>
          </div>
          <div className="mt-3 border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-2 text-[var(--accent)]">
            ▪ opponent is coding…
          </div>
          <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-3">
            <div className="flex justify-between"><span>last signal</span><span>18 sec ago</span></div>
            <div className="flex justify-between"><span>submission</span><span>pending</span></div>
            <div className="flex justify-between"><span>match mode</span><span>competitive</span></div>
          </div>
          <div className="mt-6 h-10 border-b border-[var(--accent)] opacity-80" style={{ clipPath: 'polygon(0 75%, 12% 55%, 22% 68%, 34% 45%, 47% 52%, 61% 20%, 75% 38%, 87% 12%, 100% 25%, 100% 100%, 0 100%)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)' }} />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-3 font-mono text-[11px]" style={{ color: done ? 'var(--success)' : 'var(--text-muted)', background: done ? 'var(--success-soft)' : 'var(--editor-chrome)' }}>
        <span>{done ? '✓ Accepted — 47/47 sample cases' : '▪ Opponent is coding…'}</span>
        <span className="ml-auto text-[var(--text-muted)]">{done ? 'code 08:32' : 'live / match 8F31'}</span>
      </div>
    </div>
  );
}
