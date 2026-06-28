'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

export default function AuthCallbackInner() {
  const { setSession } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=OAuth+login+failed');
      return;
    }

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    api.me()
      .then((user) => {
        setSession(accessToken, refreshToken, user);
        router.replace(user.role === 'admin' ? '/admin' : '/dashboard');
      })
      .catch(() => {
        router.replace('/login?error=Could+not+complete+OAuth+login');
      });
  }, [params, router, setSession]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-[var(--cf-blue)] font-bold">Completing login...</p>
    </div>
  );
}
