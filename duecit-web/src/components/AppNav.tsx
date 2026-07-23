'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="cf-nav px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-4">
        <Link href={user ? '/dashboard' : '/'} className="font-bold text-base no-underline hover:no-underline">
          DuecIt
        </Link>
        
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-black/90 hover:no-underline px-2 py-1">
              <Link href={`/profile/${user.username}`} className="font-bold">
                {user.username}
              </Link>
              {' '}
              <> <span className="border-rounded-xl bg-white/90 text-black/90 text-bold hover:no-underline px-2 py-1">
              <span className={ratingClass(user.ratingDSA) } >{user.ratingDSA} </span>
              </span>
              </>
            </span>
            <button onClick={handleLogout} className="cf-btn-danger">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="cf-btn">Login </Link>
            <Link href="/register" className="cf-btn">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export { ratingClass };
