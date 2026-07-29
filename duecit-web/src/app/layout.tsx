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

  title: "DuecIt — Real-Time Coding Duels",
  description:
    "Compete in real-time coding duels based on your ELO rating.",

  openGraph: {
    title: "DuecIt — Real-Time Coding Duels",
    description:
      "Compete in real-time coding duels based on your ELO rating.",
    url: "https://duecit-web.vercel.app",
    siteName: "DuecIt",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DuecIt",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "DuecIt — Real-Time Coding Duels",
    description:
      "Compete in real-time coding duels based on your ELO rating.",
    images: ["/og-image.png"],
  },

  icons: {
    icon: "/favicon.ico",
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