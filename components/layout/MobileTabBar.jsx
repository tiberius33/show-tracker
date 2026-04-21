// components/layout/MobileTabBar.jsx
//
// Bottom tab bar for mobile. Use on the same routes as AppShell — the shell
// already handles the mobile drawer via the hamburger; this tab bar is for
// users who want thumb-reach navigation to the 5 most-used routes.
//
// Hide above md: className="md:hidden".

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { List, Search, BarChart3, User, Calendar } from 'lucide-react';

const TABS = [
  { href: '/shows',    label: 'Shows',    icon: List },
  { href: '/search',   label: 'Search',   icon: Search },
  { href: '/stats',    label: 'Stats',    icon: BarChart3 },
  { href: '/upcoming', label: 'Upcoming', icon: Calendar },
  { href: '/profile',  label: 'Me',       icon: User },
];

export default function MobileTabBar() {
  const pathname = usePathname() || '';
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-subtle"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5 h-14">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={[
                'flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors',
                active ? 'text-brand' : 'text-muted hover:text-secondary',
              ].join(' ')}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
