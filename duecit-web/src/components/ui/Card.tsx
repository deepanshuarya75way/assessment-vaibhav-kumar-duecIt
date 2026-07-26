'use client';

import { ReactNode, HTMLAttributes } from 'react';
import { motion, MotionProps } from 'framer-motion';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  elevated?: boolean;
  hover?: boolean;
  glow?: 'blue' | 'green' | 'purple' | 'none';
  padding?: 'sm' | 'md' | 'lg' | 'none';
  animate?: boolean;
}

const glowMap = {
  blue:   'hover:border-[color-mix(in_srgb,var(--primary)_40%,transparent)] hover:shadow-[0_0_24px_var(--primary-dim)]',
  green:  'hover:border-[color-mix(in_srgb,var(--success)_40%,transparent)] hover:shadow-[0_0_24px_var(--success-dim)]',
  purple: 'hover:border-[color-mix(in_srgb,var(--purple)_40%,transparent)] hover:shadow-[0_0_24px_var(--purple-dim)]',
  none:   '',
};

const paddingMap = {
  sm:   'p-3',
  md:   'p-5',
  lg:   'p-6',
  none: '',
};

export default function Card({
  children,
  elevated = false,
  hover = false,
  glow = 'none',
  padding = 'md',
  animate = false,
  className = '',
  ...props
}: CardProps) {
  const base = 'rounded-2xl border border-[var(--border)] transition-all duration-200';
  const bg = elevated ? 'bg-[var(--bg-elevated)]' : 'bg-[var(--bg-card)]';
  const hoverClass = hover ? `cursor-pointer app-card-hover ${glowMap[glow]}` : '';

  const classes = `${base} ${bg} ${hoverClass} ${paddingMap[padding]} ${className}`;

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={hover ? { y: -2 } : {}}
        className={classes}
        {...(props as MotionProps)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
