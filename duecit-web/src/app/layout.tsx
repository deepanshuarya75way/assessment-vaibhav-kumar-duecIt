// import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider, themeInitScript } from '@/lib/theme';
import './globals.css';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";


const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://duecit-web.vercel.app"),

  title: "DuecIt — Code. Duel. Improve.",
  description:
    "Practice coding, challenge developers in real-time duels, and climb the ELO leaderboard.",


  openGraph: {
    title: "DuecIt — Code. Duel. Improve.",
    description:
      "Practice coding, challenge developers in real-time duels, and climb the ELO leaderboard.",
    images: ["/og-image.png"],
  },

  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${typeof window !== 'undefined' ? (window.document.documentElement.classList.contains('dark') ? 'dark' : '') : ''}`} data-theme={typeof window !== 'undefined' ? window.document.documentElement.dataset.theme : ''} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}