// components/layout/AppFooter.jsx
// The logged-in footer (narrow, muted). Use <MarketingFooter> on public pages.

'use client';

import React from 'react';
import Link from 'next/link';

export default function AppFooter() {
  return (
    <footer className="mt-auto py-10 border-t border-subtle">
      <div className="max-w-6xl mx-auto px-4 text-center">
        <div className="flex items-center justify-center gap-4 text-[13px] text-muted">
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
          <span aria-hidden="true">·</span>
          <Link href="/cookies" className="hover:text-primary transition-colors">Cookies</Link>
          <span aria-hidden="true">·</span>
          <Link href="/feedback" className="hover:text-primary transition-colors">Feedback</Link>
        </div>
        <p className="text-muted text-[11px] mt-3">© {new Date().getFullYear()} MySetlists</p>
      </div>
    </footer>
  );
}
