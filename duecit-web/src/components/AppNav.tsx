'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

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

  return (
    <nav className="cf-nav px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-4">
        <Link href={user ? '/dashboard' : '/'} className="font-bold text-base no-underline hover:no-underline">
          DuecIt
        </Link>
        {user && (
          <>
            <Link href="/dashboard">Home</Link>
            <Link href={`/profile/${user.username}`}>Profile</Link>
            {user.role === 'admin' && <Link href="/admin">Admin</Link>}
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span>
              <Link href={`/profile/${user.username}`} className="font-bold">
                {user.username}
              </Link>
              {' '}
              <span className={ratingClass(user.ratingDSA)}>({user.ratingDSA})</span>
            </span>
            <button onClick={logout} className="text-white/90 hover:underline bg-transparent border-none cursor-pointer text-sm">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export { ratingClass };
