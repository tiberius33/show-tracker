import { Suspense } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import AppProviderWrapper from './AppProviderWrapper';

// Self-hosted via next/font: downloaded at build time and served from our
// own origin, so there's no render-blocking request to fonts.googleapis.com
// (previously a <link rel="stylesheet"> in <head> plus two preconnects).
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'MySetlists | Your Show History',
    template: '%s — MySetlists',
  },
  description: 'Track every show you\'ve attended, rate setlists, and share your concert history with friends.',
  metadataBase: new URL('https://mysetlists.net'),
  openGraph: {
    type: 'website',
    url: 'https://mysetlists.net/',
    title: 'MySetlists | Your Show History',
    description: 'Track every show you\'ve attended, rate setlists, and share your concert history with friends.',
    images: ['/og-image.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MySetlists | Your Show History',
    description: 'Track every show you\'ve attended, rate setlists, and share your concert history with friends.',
    images: ['/og-image.svg'],
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MySetlists',
  },
};

export const viewport = {
  themeColor: '#1f1f3a',
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={plusJakartaSans.className}>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-base">
            <div className="text-muted font-medium">Loading...</div>
          </div>
        }>
          <AppProviderWrapper>
            {children}
          </AppProviderWrapper>
        </Suspense>
      </body>
    </html>
  );
}
