'use client';

import { useEffect, useState } from 'react';

interface MatchTimerProps {
  serverTime: number;
  targetTime: number;
  label: string;
  onExpire?: () => void;
}

export default function MatchTimer({ serverTime, targetTime, label, onExpire }: MatchTimerProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const clockOffset = serverTime - Date.now();
    let expired = false;
    const tick = () => {
      const now = Date.now() + clockOffset;
      const next = Math.max(0, Math.floor((targetTime - now) / 1000));
      setRemaining(next);
      if (next === 0 && !expired) {
        expired = true;
        onExpire?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [serverTime, targetTime, onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const urgent = remaining <= 60 && label === 'Code';

  return (
    <time
      dateTime={`PT${remaining}S`}
      aria-label={`${label} time remaining ${mins} minutes ${secs} seconds`}
      className={`border px-2 py-1 font-mono text-sm font-semibold ${urgent ? 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]' : 'border-[var(--border)] bg-[var(--panel-raised)] text-[var(--accent)]'}`}
    >
      <span className="mr-1 text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</span>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </time>
  );
}
