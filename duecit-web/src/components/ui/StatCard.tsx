'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: number | string;
  suffix?: string;
  prefix?: string;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  animate?: boolean;
  delay?: number;
}

const colorMap = {
  blue:   { text: 'text-[var(--primary)]', glow: 'var(--primary-dim)',  border: 'color-mix(in srgb, var(--primary) 20%, transparent)'  },
  green:  { text: 'text-[var(--success)]', glow: 'var(--success-dim)',  border: 'color-mix(in srgb, var(--success) 20%, transparent)'  },
  purple: { text: 'text-[var(--purple)]',  glow: 'var(--purple-dim)',   border: 'color-mix(in srgb, var(--purple) 20%, transparent)'   },
  orange: { text: 'text-[var(--warning)]', glow: 'var(--warning-dim)',  border: 'color-mix(in srgb, var(--warning) 20%, transparent)'  },
  red:    { text: 'text-[var(--error)]',   glow: 'var(--error-dim)',    border: 'color-mix(in srgb, var(--error) 20%, transparent)'    },
};

function useCountUp(target: number, duration = 1500, enabled = true) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || typeof target !== 'number') return;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(ease * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, enabled]);

  return count;
}

export default function StatCard({
  label,
  value,
  suffix = '',
  prefix = '',
  icon,
  color = 'blue',
  animate = true,
  delay = 0,
}: StatCardProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const numericValue = typeof value === 'number' ? value : 0;
  const count = useCountUp(numericValue, 1200, visible && animate && typeof value === 'number');

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const colors = colorMap[color];
  const displayValue = animate && typeof value === 'number' && visible ? count : value;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay }}
      className="surface-card border rounded-2xl p-5 flex flex-col gap-3 hover:border-[var(--border-light)] transition-colors duration-200"
      style={{
        background: visible ? `linear-gradient(135deg, var(--bg-card), ${colors.glow})` : 'var(--bg-card)',
      }}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-muted uppercase tracking-widest">{label}</p>
        {icon && (
          <div className={`${colors.text} opacity-60`}>
            {icon}
          </div>
        )}
      </div>
      <p className={`text-3xl font-bold ${colors.text} font-mono`}>
        {prefix}{displayValue}{suffix}
      </p>
    </motion.div>
  );
}
