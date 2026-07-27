'use client';
 
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    <nav className="cf-nav sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Logo href={user ? '/dashboard' : '/'} />
 
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href={`/profile/${user.username}`}
                className="badge gap-2 !text-[var(--text)] transition-colors hover:!border-[var(--border-strong)]"
              >
                <span className="font-semibold">{user.username}</span>
                <span className={`mono ${ratingClass(user.ratingDSA)}`}>{user.ratingDSA}</span>
              </Link>
              <ThemeToggle />
              <button onClick={handleLogout} className="cf-btn-ghost">
                Log out
              </button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link href="/login" className="cf-btn-ghost no-underline">
                Log in
              </Link>
              <Link href="/register" className="cf-btn no-underline">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
 
export { ratingClass };