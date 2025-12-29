import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import './globals.css';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { WebVitals, DefaultPreloadLinks } from '@/components/performance';

// =============================================================================
// FONT OPTIMIZATION - Use font-display: swap for faster rendering
// =============================================================================
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: false, // Don't preload mono font, it's less critical
});

// =============================================================================
// METADATA - SEO and Social Sharing
// =============================================================================
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'AI News',
    template: '%s | AI News',
  },
  description: 'Daily AI industry updates. Aggregated, clustered, and summarized for fast reading.',
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': '/rss.xml',
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'AI News',
    title: 'AI News',
    description:
      'Daily AI industry updates. Aggregated, clustered, and summarized for fast reading.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI News',
    description:
      'Daily AI industry updates. Aggregated, clustered, and summarized for fast reading.',
  },
  // Preconnect to external origins for performance
  other: {
    'X-DNS-Prefetch-Control': 'on',
  },
};

// =============================================================================
// ROOT LAYOUT - Performance optimized
// =============================================================================
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Resource preloading for LCP optimization */}
        <DefaultPreloadLinks />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-50 text-zinc-950 antialiased dark:bg-black dark:text-zinc-50`}
      >
        {/* Web Vitals monitoring */}
        <WebVitals />
        <Header />
        <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
