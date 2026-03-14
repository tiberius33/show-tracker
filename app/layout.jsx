import { Suspense } from 'react';
import Script from 'next/script';
import './globals.css';
import AppProviderWrapper from './AppProviderWrapper';

export const metadata = {
  title: {
    default: 'Show Tracker | Your Concert History',
    template: '%s — MySetlists',
  },
  description: 'Track every show you\'ve attended, rate setlists, and share your concert history with friends.',
  metadataBase: new URL('https://mysetlists.net'),
  openGraph: {
    type: 'website',
    url: 'https://mysetlists.net/',
    title: 'Show Tracker | Your Concert History',
    description: 'Track every show you\'ve attended, rate setlists, and share your concert history with friends.',
    images: ['/og-image.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Show Tracker | Your Concert History',
    description: 'Track every show you\'ve attended, rate setlists, and share your concert history with friends.',
    images: ['/og-image.svg'],
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/icon-192.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MySetlists',
  },
};

export const viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      </head>
      <body>
        <Suspense fallback={
          <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
            <div className="text-white/40 font-medium">Loading...</div>
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
