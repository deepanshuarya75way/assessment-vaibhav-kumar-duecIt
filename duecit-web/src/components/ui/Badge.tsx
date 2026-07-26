import { ReactNode } from 'react';

type BadgeVariant = 'easy' | 'medium' | 'hard' | 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'gray' | 'default';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  easy:    'bg-[var(--success-dim)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_20%,transparent)]',
  medium:  'bg-[var(--warning-dim)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning)_20%,transparent)]',
  hard:    'bg-[var(--error-dim)] text-[var(--error)] border-[color-mix(in_srgb,var(--error)_20%,transparent)]',
  blue:    'bg-[var(--primary-dim)] text-[var(--primary)] border-[color-mix(in_srgb,var(--primary)_20%,transparent)]',
  purple:  'bg-[var(--purple-dim)] text-[var(--purple)] border-[color-mix(in_srgb,var(--purple)_20%,transparent)]',
  green:   'bg-[var(--success-dim)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_20%,transparent)]',
  orange:  'bg-[var(--warning-dim)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning)_20%,transparent)]',
  red:     'bg-[var(--error-dim)] text-[var(--error)] border-[color-mix(in_srgb,var(--error)_20%,transparent)]',
  gray:    'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-light)]',
  default: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border)]',
};

const dotColors: Record<BadgeVariant, string> = {
  easy:    'bg-[var(--success)]',
  medium:  'bg-[var(--warning)]',
  hard:    'bg-[var(--error)]',
  blue:    'bg-[var(--primary)]',
  purple:  'bg-[var(--purple)]',
  green:   'bg-[var(--success)]',
  orange:  'bg-[var(--warning)]',
  red:     'bg-[var(--error)]',
  gray:    'bg-[var(--text-muted)]',
  default: 'bg-[var(--text-muted)]',
};

export default function Badge({ children, variant = 'default', dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantStyles[variant]} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
