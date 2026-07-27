'use client';
 
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
      className={`relative h-8 w-8 rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text-muted)] transition-colors duration-200 hover:text-[var(--text)] hover:border-[var(--border-strong)] ${className}`}
    >
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{ opacity: isDark ? 0 : 1, transform: `rotate(${isDark ? -90 : 0}deg) scale(${isDark ? 0.6 : 1})` }}
      >
        <SunIcon />
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{ opacity: isDark ? 1 : 0, transform: `rotate(${isDark ? 0 : 90}deg) scale(${isDark ? 1 : 0.6})` }}
      >
        <MoonIcon />
      </span>
    </button>
  );
}
 
function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
 
function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}