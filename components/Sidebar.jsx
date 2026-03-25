'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, List, Camera, BarChart3, UserPlus, Users, Ticket, TrendingUp, ScrollText, Send, MessageSquare, Shield, Coffee, LogOut, User, X, Menu } from 'lucide-react';

function Sidebar({ isAdmin, onLogout, userName, isOpen, onClose, isGuest, onCreateAccount, pendingNotificationCount, upcomingShowsBadgeCount }) {
  const router = useRouter();
  const pathname = usePathname();

  const activeView = (() => {
    if (!pathname) return 'shows';
    const segment = pathname.replace(/^\//, '').split('/')[0];
    return segment || 'shows';
  })();

  const scrollItems = [
    { id: 'shows', label: 'Shows', icon: List },
    { id: 'scan-import', label: 'Scan / Import', icon: Camera },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    ...(isGuest ? [] : [
      { id: 'profile', label: 'Profile', icon: User },
      { id: 'friends', label: 'Friends', icon: UserPlus, badge: pendingNotificationCount },
    ]),
    { id: 'upcoming', label: 'Upcoming Shows', icon: Ticket, badge: upcomingShowsBadgeCount, beta: true },
    { id: 'roadmap', label: 'Roadmap', icon: TrendingUp },
    { id: 'release-notes', label: 'Release Notes', icon: ScrollText },
  ];

  const pinnedBottomItems = [
    ...(isGuest ? [] : [{ id: 'invite', label: 'Invite', icon: Send }]),
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  ];

  const handleLogoutClick = () => {
    onLogout();
    if (onClose) onClose();
  };

  const navItemClass = (id) => {
    const isActive = activeView === id || (id === 'shows' && activeView === '');
    return `w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left text-[14px] font-medium transition-all ${
      isActive
        ? 'border-l-[3px] border-[var(--green-primary)] bg-[rgba(75,200,106,0.12)] text-[var(--green-primary)]'
        : 'text-[var(--text-on-dark-muted)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-on-dark)]'
    }`;
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-sidebar/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar — dark navy */}
      <div className={`
        w-64 h-screen bg-sidebar flex flex-col fixed left-0 top-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        {/* Logo + tagline */}
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <img src="/logo.svg" alt="MySetlists" className="h-9 w-auto" />
              <p className="text-[11px] text-on-dark-muted mt-1 tracking-wide">Your Show History</p>
            </div>
            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            >
              <X className="w-5 h-5 text-on-dark-muted" />
            </button>
          </div>
        </div>

        {/* Pinned search input */}
        <div className="px-3 py-3 border-b border-[rgba(255,255,255,0.08)]">
          <Link
            href="/search"
            onClick={() => { if (onClose) onClose(); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] transition-all ${
              activeView === 'search'
                ? 'bg-[rgba(75,200,106,0.12)] border border-[var(--green-primary)] text-[var(--green-primary)]'
                : 'bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] text-on-dark-muted hover:border-[var(--green-primary)] hover:text-on-dark'
            }`}
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Search for a Show</span>
          </Link>
        </div>

        {/* Scrollable middle nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {scrollItems.map(({ id, label, icon: Icon, badge, beta }) => (
            <Link
              key={id}
              href={`/${id === 'shows' ? '' : id}`}
              onClick={() => { if (onClose) onClose(); }}
              className={navItemClass(id)}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span className="flex-1">{label}</span>
              {beta && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-subtle text-amber border border-amber/20">
                  Beta
                </span>
              )}
              {badge > 0 && (
                <span className="bg-danger text-on-dark text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Pinned bottom: Invite + Feedback */}
        <div className="px-3 py-2 space-y-0.5 border-t border-[rgba(255,255,255,0.08)]">
          {pinnedBottomItems.map(({ id, label, icon: Icon, badge }) => (
            <Link
              key={id}
              href={`/${id}`}
              onClick={() => { if (onClose) onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left text-[13px] transition-all ${
                activeView === id
                  ? 'text-[var(--green-primary)]'
                  : 'text-on-dark-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-on-dark'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium flex-1">{label}</span>
              {badge > 0 && (
                <span className="bg-danger text-on-dark text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Bottom section */}
        <div className="px-3 py-2 border-t border-[rgba(255,255,255,0.08)] space-y-0.5">
          {isGuest && (
            <>
              <div className="px-4 py-2 mb-2 bg-[rgba(75,200,106,0.1)] border border-[rgba(75,200,106,0.2)] rounded-lg">
                <p className="text-[11px] text-[var(--green-primary)]">
                  Your shows are saved locally. Create an account to sync across devices.
                </p>
              </div>
              <button
                onClick={() => { onCreateAccount(); onClose && onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left bg-brand text-on-dark font-semibold hover:bg-brand-light transition-all"
              >
                <User className="w-5 h-5" />
                <span>Create Account</span>
              </button>
            </>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => { if (onClose) onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left text-[13px] transition-all ${
                activeView === 'admin'
                  ? 'text-danger'
                  : 'text-on-dark-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-on-dark'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span className="font-medium">Admin</span>
            </Link>
          )}
          <a
            href="https://buymeacoffee.com/phillipd"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left text-[13px] text-on-dark-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-on-dark transition-all"
          >
            <Coffee className="w-4 h-4" />
            <span className="font-medium">Support</span>
          </a>
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left text-[13px] text-on-dark-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-on-dark transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">{isGuest ? 'Exit Guest Mode' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
