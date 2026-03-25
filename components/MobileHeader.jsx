'use client';

import React from 'react';
import { Menu } from 'lucide-react';

function MobileHeader({ onMenuClick }) {
  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface backdrop-blur-xl border-b border-subtle" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl hover:bg-hover transition-colors"
        >
          <Menu className="w-6 h-6 text-primary" />
        </button>
        <img src="/logo.svg" alt="MySetlists" className="h-8 w-auto" />
        <div className="w-10" /> {/* Spacer for centering */}
      </div>
    </div>
  );
}

export default MobileHeader;
