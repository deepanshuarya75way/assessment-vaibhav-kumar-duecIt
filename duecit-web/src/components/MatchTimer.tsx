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

    const tick = () => {
      const now = Date.now() + clockOffset;
      const rem = Math.max(0, Math.floor((targetTime - now) / 1000));
      setRemaining(rem);
      if (rem === 0 && onExpire) onExpire();
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [serverTime, targetTime, onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const urgent = remaining <= 60 && label === 'Code';

  return (
    <div
      className={`px-3 py-1 font-mono text-sm border ${
        urgent
          ? 'bg-red-100 border-red-400 text-red-700'
          : 'bg-white border-[var(--cf-border)] text-[var(--cf-blue)]'
      }`}
    >
      <span className="text-[var(--cf-muted)] mr-1">{label}:</span>
      <span className="font-bold">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  );
}
