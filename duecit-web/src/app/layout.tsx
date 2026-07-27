import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  title: 'DuecIt — Real-Time Coding Duels',
  description: 'Compete in real-time coding duels based on your ELO rating',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SpeedInsights />
        <Analytics />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
