// components/layout/MobileTabBar.jsx
//
// Bottom tab bar for mobile. Use on the same routes as AppShell — the shell
// already handles the mobile drawer via the hamburger; this tab bar is for
// users who want thumb-reach navigation to the 5 most-used routes.
//
// Hide above md: className="md:hidden".
//
// ┌─ NOT MOUNTED ────────────────────────────────────────────────────────┐
// │ Nothing imports this component. The live shell is the inline        │
// │ AppShell in app/AppProviderWrapper.jsx, which renders MobileHeader   │
// │ and Sidebar and no tab bar — so the app has never shipped one.       │
// │                                                                      │
// │ Deliberately left dormant: mounting it changes the app's information │
// │ architecture, which is a product decision rather than a navigation   │
// │ fix. The five routes below are still treated as navigation floors    │
// │ (see ROOT_ROUTES in lib/navRoutes.js) — you can never go back out    │
// │ of one — so the hierarchy this file describes is real even though    │
// │ the bar is not rendered.                                             │
// │                                                                      │
// │ The safe-area and touch-target work below is done, so it is correct  │
// │ the day it is mounted. Any page-level padding to keep content clear  │
// │ of it still has to be added at that point.                           │
// └──────────────────────────────────────────────────────────────────────┘

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
      // pb-safe-bottom clears the home indicator; the token comes from
      // app/globals.css rather than a raw env() here.
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-subtle pb-safe-bottom"
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
                'min-h-touch',
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
