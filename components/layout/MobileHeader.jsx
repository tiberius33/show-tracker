// components/layout/MobileHeader.jsx
//
// Sticky header for small screens. Menu button, logo, contextual right slot.
// Much lighter than your current version so the page title + actions breathe.

'use client';

import React from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import Pick from '../brand/Pick';
import Wordmark from '../brand/Wordmark';

export default function MobileHeader({ onMenuClick, right }) {
  return (
    <div
      className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-subtle"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="p-2 rounded-xl text-primary hover:bg-hover transition-colors"
        >
          <Menu size={22} strokeWidth={2.2} />
        </button>
        <Link href="/" className="flex items-center gap-1.5" aria-label="MySetlists home">
          <Pick size={24} />
          <Wordmark size={13} />
        </Link>
        <div className="w-10 flex justify-end">{right}</div>
      </div>
    </div>
  );
}
