'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`flex h-8 w-8 items-center justify-center border border-[var(--border)] bg-transparent text-[var(--text-muted)] transition-colors duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)] ${className}`}
    >
      {isDark ? <Sun size={14} strokeWidth={1.8} aria-hidden="true" /> : <Moon size={14} strokeWidth={1.8} aria-hidden="true" />}
    </button>
  );
}
