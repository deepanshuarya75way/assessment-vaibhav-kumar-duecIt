'use client';

import { forwardRef, ButtonHTMLAttributes, ReactNode, CSSProperties } from 'react';
import { motion } from 'framer-motion';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:   'text-white border hover:opacity-90',
  secondary: 'text-secondary hover:text-primary border border-theme hover:bg-[var(--bg-elevated)] hover:border-[var(--border-light)]',
  danger:    'border hover:opacity-90',
  ghost:     'bg-transparent hover:bg-[var(--bg-elevated)] text-secondary hover:text-primary border border-transparent',
  success:   'border hover:opacity-90',
};

const variantInline: Record<Variant, React.CSSProperties> = {
  primary: { background: 'var(--primary)', borderColor: 'var(--primary-hover)' },
  secondary: { background: 'var(--bg-elevated)' },
  danger: { background: 'var(--error-dim)', color: 'var(--error)', borderColor: 'rgba(239,68,68,0.3)' },
  ghost: {},
  success: { background: 'var(--success-dim)', color: 'var(--success)', borderColor: 'rgba(34,197,94,0.3)' },
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, fullWidth, className = '', disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none';

    return (
      <motion.button
        ref={ref}
        whileHover={!disabled && !loading ? { y: -1 } : {}}
        whileTap={!disabled && !loading ? { scale: 0.97 } : {}}
        className={`${base} ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        style={variantInline[variant] as CSSProperties}
        disabled={disabled || loading}
        {...(props as object)}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';
export default Button;
