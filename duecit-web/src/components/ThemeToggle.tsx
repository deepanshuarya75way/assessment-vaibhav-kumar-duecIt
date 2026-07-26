'use client';

import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`theme-toggle ${className}`}
    >
      <motion.div
        className="theme-toggle-track"
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      >
        {/* Stars (dark mode decoration) */}
        <motion.span
          className="theme-toggle-star theme-toggle-star-1"
          animate={{ opacity: isDark ? 1 : 0, scale: isDark ? 1 : 0 }}
          transition={{ duration: 0.25 }}
        />
        <motion.span
          className="theme-toggle-star theme-toggle-star-2"
          animate={{ opacity: isDark ? 1 : 0, scale: isDark ? 1 : 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        />

        {/* Sliding thumb */}
        <motion.div
          className="theme-toggle-thumb"
          layout
          animate={{ x: isDark ? 0 : 28 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        >
          <motion.div
            animate={{ rotate: isDark ? 0 : 180, scale: isDark ? 1 : 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="theme-toggle-icon-wrap"
          >
            {isDark ? (
              <Moon size={14} className="theme-toggle-icon" />
            ) : (
              <Sun size={14} className="theme-toggle-icon" />
            )}
          </motion.div>
        </motion.div>

        {/* Background glow on toggle */}
        <motion.div
          className="theme-toggle-glow"
          animate={{
            opacity: isDark ? 0.6 : 0.9,
            background: isDark
              ? 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)',
          }}
          transition={{ duration: 0.4 }}
        />
      </motion.div>
    </button>
  );
}
