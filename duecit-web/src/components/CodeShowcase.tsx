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
 
/**
 * Marketing/auth-side mock editor: types the solution out line by line,
 * then settles on an accepted verdict.
 */
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
        <span className="code-dot" style={{ background: '#ff5f57' }} />
        <span className="code-dot" style={{ background: '#febc2e' }} />
        <span className="code-dot" style={{ background: '#28c840' }} />
        <span className="ml-2">solution.py</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="live-dot" />
          vs {opponent}
        </span>
      </div>
 
      <div className="px-4 py-3.5">
        {SOLUTION_LINES.map((line, i) => (
          <div
            key={i}
            className="code-line"
            style={{
              opacity: i < visible ? 1 : 0,
              transform: i < visible ? 'none' : 'translateY(4px)',
              transition: 'opacity 0.3s ease, transform 0.3s ease',
            }}
          >
            <span className="code-gutter">{i + 1}</span>
            <span className="whitespace-pre">
              {line.map((tok, j) => (
                <span key={j} className={tok.c}>
                  {tok.t}
                </span>
              ))}
              {i === visible - 1 && !done && <span className="caret-blink">▍</span>}
            </span>
          </div>
        ))}
      </div>
 
      <div
        className="flex items-center gap-2 border-t px-4 py-2.5 text-[12.5px] font-semibold"
        style={{
          borderColor: 'var(--border)',
          background: done ? 'var(--success-soft)' : 'var(--bg-subtle)',
          color: done ? 'var(--success)' : 'var(--text-muted)',
          transition: 'background 0.4s ease, color 0.4s ease',
        }}
      >
        {done ? (
          <>
            <span>✓ Accepted — 47/47 passed</span>
            <span className="mono ml-auto font-normal">+18 elo</span>
          </>
        ) : (
          <>
            <span className="live-dot" />
            <span>Opponent is coding…</span>
            <span className="mono ml-auto font-normal">08:32</span>
          </>
        )}
      </div>
    </div>
  );
}
