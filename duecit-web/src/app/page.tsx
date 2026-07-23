'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import AppNav from '@/components/AppNav';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-3 text-[var(--cf-blue)]">DuecIt</h1>
        <p className="text-[var(--cf-muted)] mb-8 text-base">
          Get Your True Competitor For 1V1 Coding.
        </p>
        <div className="flex gap-3 justify-center mb-12">
          <Link href="/login" className="cf-btn px-6 py-2 no-underline font-bold">
            Login
          </Link>
          <Link href="/register" className="cf-btn-secondary px-6 py-2 no-underline font-bold">
            Register
          </Link>
        </div>

        <table className="cf-table text-left">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold">ELO Matchmaking</td>
              <td>Paired with opponents near your rating (±200)</td>
            </tr>
            <tr>
              <td className="font-bold">Synced Phases</td>
              <td>45s reading → 10 min coding, server-synchronized</td>
            </tr>
            <tr>
              <td className="font-bold">Dual Modes</td>
              <td>Competitive (multiple submits) & Practice (single submit)</td>
            </tr>
            <tr>
              <td className="font-bold">DSA & DB</td>
              <td>Algorithms and database problem categories</td>
            </tr>
          </tbody>
        </table>
      </main>
    </div>
  );
}
