'use client';
 
import { createContext, useCallback, useContext, useSyncExternalStore, ReactNode } from 'react';
 
export type Theme = 'light' | 'dark';
 
const STORAGE_KEY = 'duecit-theme';
 
/** Runs before hydration so the correct theme paints on first frame. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.classList.add('dark');}})();`;
 
const listeners = new Set<() => void>();
 
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
 
/** The <html> element is the source of truth — the init script sets it pre-hydration. */
function getSnapshot(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}
 
function getServerSnapshot(): Theme {
  return 'dark';
}
 
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  listeners.forEach((listener) => listener());
}
 
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}
 
const ThemeContext = createContext<ThemeContextType | null>(null);
 
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setTheme = useCallback((next: Theme) => applyTheme(next), []);
  const toggleTheme = useCallback(() => applyTheme(getSnapshot() === 'dark' ? 'light' : 'dark'), []);
 
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>
  );
}
 
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}