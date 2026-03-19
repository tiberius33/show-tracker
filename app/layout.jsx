import { Suspense } from 'react';
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
  themeColor: '#0a0a0c',
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-void)' }}>
            <div className="text-muted font-medium font-body">Loading...</div>
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
