'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    const qs = error ? `?auth=login&error=${encodeURIComponent(error)}` : '?auth=login';
    router.replace(`/${qs}`);
  }, [router, searchParams]);

  return null;
}

export default function LoginRedirect() {
  return (
    <Suspense fallback={null}>
      <LoginRedirectInner />
    </Suspense>
  );
}
