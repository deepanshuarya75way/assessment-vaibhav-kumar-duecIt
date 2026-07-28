'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';

function ratingClass(rating: number): string {
  if (rating >= 2400) return 'rating-legendary';
  if (rating >= 2100) return 'rating-grandmaster';
  if (rating >= 1900) return 'rating-master';
  if (rating >= 1600) return 'rating-expert';
  if (rating >= 1400) return 'rating-candidate';
  if (rating >= 1200) return 'rating-specialist';
  if (rating >= 1000) return 'rating-pupil';
  return 'rating-newbie';
}

export default function AppNav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="cf-nav">
      <div className="mx-auto flex min-h-14 max-w-[1440px] items-center justify-between gap-4 px-5 lg:px-7">
        <div className="flex min-w-0 items-center gap-5">
          <Logo href={user ? '/dashboard' : '/'} />
          <span className="hidden border-l border-[var(--border)] pl-5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)] sm:block">
            // duel protocol v1
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] md:flex">
            <Link href={user ? '/dashboard' : '/#arena'}>/arena</Link>
            <Link href={user ? `/profile/${user.username}` : '/#protocol'}>/leaderboard</Link>
            <Link href="/#protocol">/docs</Link>
          </div>
          <span className="hidden items-center gap-2 border-l border-[var(--border)] pl-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--accent)] lg:flex">
            <span className="live-dot" /> {user ? 'session live' : '3 duels live'}
          </span>
          {user && (
            <Link
              href={`/profile/${user.username}`}
              className="hidden items-center gap-2 border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] no-underline transition-colors hover:border-[var(--accent)] sm:flex"
            >
              <span className="text-[var(--text)]">@{user.username}</span>
              <span className={ratingClass(user.ratingDSA)}>{user.ratingDSA}</span>
            </Link>
          )}
          <ThemeToggle />
          {user ? (
            <button onClick={handleLogout} className="cf-btn-ghost hidden sm:inline-flex" aria-label="Log out">
              <LogOut size={13} aria-hidden="true" />
              <span>Exit</span>
            </button>
          ) : (
            <>
              <Link href="/login" className="cf-btn-ghost hidden sm:inline-flex no-underline">Login</Link>
              <Link href="/register" className="cf-btn no-underline">Enter arena ↗</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export { ratingClass };
