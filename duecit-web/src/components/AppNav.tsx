'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords, ChevronDown, LogOut, User, Settings,
  LayoutDashboard, Menu, X, Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import ThemeToggle from '@/components/ThemeToggle';

export function ratingClass(rating: number): string {
  if (rating >= 2400) return 'rating-legendary';
  if (rating >= 2100) return 'rating-grandmaster';
  if (rating >= 1900) return 'rating-master';
  if (rating >= 1600) return 'rating-expert';
  if (rating >= 1400) return 'rating-candidate';
  if (rating >= 1200) return 'rating-specialist';
  if (rating >= 1000) return 'rating-pupil';
  return 'rating-newbie';
}

export function ratingTier(rating: number): string {
  if (rating >= 2400) return 'Legendary';
  if (rating >= 2100) return 'Grandmaster';
  if (rating >= 1900) return 'Master';
  if (rating >= 1600) return 'Expert';
  if (rating >= 1400) return 'Candidate';
  if (rating >= 1200) return 'Specialist';
  if (rating >= 1000) return 'Pupil';
  return 'Newbie';
}

const APP_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
];

function Avatar({ url, username }: { url?: string; username: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={username} className="w-8 h-8 rounded-full object-cover border border-theme" />;
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-xs font-bold text-white border border-theme">
      {username[0]?.toUpperCase()}
    </div>
  );
}

function UserMenu({ user, onLogout }: { user: NonNullable<ReturnType<typeof useAuth>['user']>; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors"
        aria-label="User menu"
      >
        <Avatar url={user.avatarUrl} username={user.username} />
        <div className="hidden sm:flex flex-col items-start leading-none">
          <span className="text-xs font-semibold text-primary">{user.username}</span>
          <span className={`text-xs font-mono font-bold ${ratingClass(user.ratingDSA)}`}>
            {user.ratingDSA}
          </span>
        </div>
        <ChevronDown size={14} className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-52 surface-card border rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-theme">
                <p className="text-xs font-bold text-primary">{user.username}</p>
                <p className="text-xs text-muted mt-0.5">
                  <span className={`font-mono font-bold ${ratingClass(user.ratingDSA)}`}>{user.ratingDSA}</span>
                  {' · '}{ratingTier(user.ratingDSA)}
                </p>
              </div>
              <div className="py-1">
                {[
                  { icon: <User size={14} />, label: 'Profile', onClick: () => { router.push(`/profile/${user.username}`); setOpen(false); } },
                  { icon: <LayoutDashboard size={14} />, label: 'Dashboard', onClick: () => { router.push('/dashboard'); setOpen(false); } },
                  { icon: <Settings size={14} />, label: 'Settings', onClick: () => setOpen(false) },
                ].map((item) => (
                  <button key={item.label} onClick={item.onClick}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-[var(--bg-elevated)] transition-colors">
                    <span className="text-muted">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-theme py-1">
                <button onClick={() => { onLogout(); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                  style={{ color: 'var(--error)' }}>
                  <LogOut size={14} />
                  Log out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AppNav() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="app-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 group" aria-label="DuecIt home">
            <div className="w-7 h-7 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.4)] group-hover:shadow-[0_0_18px_rgba(59,130,246,0.6)] transition-shadow">
              <Swords size={14} className="text-white" />
            </div>
            <span className="font-bold text-base text-primary tracking-tight">DuecIt</span>
          </Link>

          {user && (
            <div className="hidden md:flex items-center gap-1">
              {APP_LINKS.map((link) => (
                <Link key={link.href} href={link.href}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    isActive(link.href) ? 'text-primary bg-[var(--bg-elevated)]' : 'text-secondary hover:text-primary hover:bg-[var(--bg-elevated)]'
                  }`}>
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <Link href="/dashboard"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-px"
                style={{ background: 'var(--primary)', boxShadow: '0 4px 14px var(--shadow-primary)' }}>
                <Zap size={13} />
                Start Duel
              </Link>
              <UserMenu user={user} onLogout={handleLogout} />
            </>
          ) : (
            <>
              <Link href="/?auth=login" className="px-3 py-1.5 text-sm text-secondary hover:text-primary transition-colors">
                Log in
              </Link>
              <Link href="/?auth=register"
                className="px-4 py-1.5 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-px"
                style={{ background: 'var(--primary)', boxShadow: '0 4px 14px var(--shadow-primary)' }}>
                Sign up
              </Link>
            </>
          )}

          <button className="md:hidden p-1.5 text-muted hover:text-primary transition-colors"
            onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle menu">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && user && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="md:hidden border-t border-theme overflow-hidden">
            <div className="px-4 py-3 space-y-1">
              {APP_LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-[var(--bg-elevated)] rounded-lg transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
