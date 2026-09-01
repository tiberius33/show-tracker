// components/layout/Sidebar.jsx
//
// Refined version of your existing Sidebar — same props, same nav model,
// same dark-navy surface. Changes from the shipped version:
//   • Brand lockup uses the Pick+Wordmark components (cleaner than inline <img>)
//   • Active-state uses a solid left rail + subtle bg (was a 3px border)
//   • Search link styled as a proper input-looking affordance with ⌘K hint
//   • Badges use Badge primitive for consistency
//   • Keyboard-visible focus rings on all nav items
//
// Fully backwards-compatible: same function signature as current Sidebar.jsx.

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search, List, BarChart3, Ticket, Shield, Coffee,
  LogOut, User, X, Heart, HelpCircle,
  Bookmark, GalleryVertical, Tent, Map,
} from 'lucide-react';
import Pick from '../brand/Pick';
import Wordmark from '../brand/Wordmark';
import Badge from '../ui/Badge';

function getActiveId(pathname) {
  if (!pathname || pathname === '/') return 'shows';
  return pathname.replace(/^\//, '').split('/')[0] || 'shows';
}

export default function Sidebar({
  isAdmin,
  onLogout,
  userName,
  isOpen,
  onClose,
  isGuest,
  onCreateAccount,
  pendingNotificationCount = 0,
  upcomingShowsBadgeCount = 0,
  unreadNotificationCount = 0,
}) {
  const pathname = usePathname() || '';
  const segment = getActiveId(pathname);

  // Profile's badge folds together everything that needs the user's
  // attention there: pending friend requests/invites (pendingNotificationCount)
  // plus unread notifications (unreadNotificationCount) — Notifications no
  // longer has its own top-level nav entry (it moved under Profile, see
  // app/profile/page.jsx), so this is the one place that count now surfaces.
  const profileBadge = pendingNotificationCount + unreadNotificationCount;

  const primary = [
    { id: 'shows', label: 'My Shows', icon: List, href: '/' },
    { id: 'stats', label: 'Stats', icon: BarChart3, href: '/stats' },
    !isGuest && { id: 'tours', label: 'Tours', icon: Map, href: '/tours' },
    !isGuest && { id: 'wishlist', label: 'Wishlist', icon: Heart, href: '/wishlist' },
    !isGuest && { id: 'bucket-list', label: 'Bucket List', icon: Bookmark, href: '/bucket-list' },
    !isGuest && { id: 'festivals', label: 'Festivals', icon: Tent, href: '/festivals' },
    { id: 'upcoming', label: 'Upcoming', icon: Ticket, href: '/upcoming', badge: upcomingShowsBadgeCount, beta: true },
    !isGuest && { id: 'profile', label: 'Profile', icon: User, href: '/profile', badge: profileBadge },
    !isGuest && { id: 'setlist-photos', label: 'Setlist Photos', icon: GalleryVertical, href: '/setlist-photos' },
  ].filter(Boolean);

  const navItem = (id, href, Icon, label, { badge, beta, tone = 'default' } = {}) => {
    const active = segment === id;
    const toneCls =
      tone === 'danger'
        ? (active ? 'text-danger' : 'text-on-dark-muted hover:text-on-dark')
        : (active ? 'text-brand' : 'text-on-dark-muted hover:text-on-dark');
    return (
      <Link
        key={id}
        href={href}
        onClick={onClose}
        className={[
          'relative group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg',
          'text-[14px] font-semibold transition-colors outline-none',
          'focus-visible:ring-2 focus-visible:ring-brand/40',
          active ? 'bg-white/10' : 'hover:bg-white/[0.06]',
          toneCls,
        ].join(' ')}
      >
        {active && (
          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-brand" />
        )}
        <Icon size={18} strokeWidth={2.2} />
        <span className="flex-1 text-left">{label}</span>
        {beta && <Badge tone="beta" size="sm">Beta</Badge>}
        {badge > 0 && (
          <span className="bg-danger text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-sidebar/60 backdrop-blur-sm z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'w-64 h-screen bg-sidebar flex flex-col fixed left-0 top-0 z-50',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/[0.08]">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" onClick={onClose} className="flex items-center gap-2.5 outline-none focus-visible:opacity-80">
              <Pick size={32} />
              <div>
                <Wordmark size={16} inverse />
                <div className="text-[10px] text-on-dark-muted tracking-[0.08em] uppercase mt-0.5">
                  Your Show History
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-2 rounded-lg text-on-dark-muted hover:text-on-dark hover:bg-white/[0.06] transition-colors"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search affordance */}
        <div className="px-3 py-3 border-b border-white/[0.08]">
          <Link
            href="/search"
            onClick={onClose}
            className={[
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] transition-all outline-none',
              'focus-visible:ring-2 focus-visible:ring-brand/40',
              segment === 'search'
                ? 'bg-brand/10 border border-brand text-brand'
                : 'bg-white/[0.08] border border-white/10 text-on-dark-muted hover:border-brand/60 hover:text-on-dark',
            ].join(' ')}
          >
            <Search size={16} strokeWidth={2.2} />
            <span className="font-medium flex-1">Search for a show</span>
            <kbd className="hidden md:inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-on-dark-muted">
              ⌘K
            </kbd>
          </Link>
        </div>

        {/* Scrolling nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {primary.map((it) => navItem(it.id, it.href, it.icon, it.label, { badge: it.badge, beta: it.beta }))}
        </nav>

        {/* Account & utilities */}
        <div className="px-3 py-3 border-t border-white/[0.08] space-y-1">
          {isGuest && (
            <>
              <div className="mx-1 mb-2 px-3 py-2.5 rounded-lg bg-brand/10 border border-brand/20">
                <p className="text-[11px] leading-snug text-brand">
                  Your shows are saved locally. Create an account to sync.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { onCreateAccount?.(); onClose?.(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-brand text-[#2a2a4e] font-bold text-[14px] hover:bg-[#e6c200] transition-colors"
              >
                <User size={16} strokeWidth={2.4} />
                Create account
              </button>
            </>
          )}
          {isAdmin && navItem('admin', '/admin', Shield, 'Admin', { tone: 'danger' })}
          <Link
            href="/how-to-use"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[13px] text-on-dark-muted hover:bg-white/[0.06] hover:text-on-dark transition-colors"
          >
            <HelpCircle size={15} strokeWidth={2} />
            <span className="font-medium">How to Use</span>
          </Link>
          <a
            href="https://buymeacoffee.com/phillipd"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[13px] text-on-dark-muted hover:bg-white/[0.06] hover:text-on-dark transition-colors"
          >
            <Coffee size={15} strokeWidth={2} />
            <span className="font-medium">Support</span>
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[13px] text-on-dark-muted hover:bg-white/[0.06] hover:text-on-dark transition-colors"
          >
            <LogOut size={15} strokeWidth={2} />
            <span className="font-medium">{isGuest ? 'Exit Guest Mode' : 'Logout'}</span>
          </button>
          {userName && (
            <div className="px-4 pt-2 text-[11px] text-on-dark-muted truncate">
              Signed in as <span className="text-on-dark">{userName}</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
