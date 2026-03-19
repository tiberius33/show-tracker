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

  const pinnedTopItems = [
    { id: 'search', label: 'Search', icon: Search },
  ];

  const scrollItems = [
    { id: 'shows', label: 'Shows', icon: List },
    { id: 'scan-import', label: 'Scan / Import', icon: Camera },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    ...(isGuest ? [] : [
      { id: 'friends', label: 'Friends', icon: UserPlus, badge: pendingNotificationCount },
      { id: 'community', label: 'Community', icon: Users },
    ]),
    { id: 'upcoming', label: 'Upcoming Shows', icon: Ticket, badge: upcomingShowsBadgeCount, beta: true },
    { id: 'roadmap', label: 'Roadmap', icon: TrendingUp },
    { id: 'release-notes', label: 'Release Notes', icon: ScrollText },
  ];

  const pinnedBottomItems = [
    ...(isGuest ? [] : [{ id: 'invite', label: 'Invite', icon: Send }]),
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  ];

  const handleNavClick = (id) => {
    router.push(`/${id === 'shows' ? '' : id}`);
    if (onClose) onClose();
  };

  const handleLogoutClick = () => {
    onLogout();
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/75 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-64 h-screen bg-surface md:bg-surface backdrop-blur-xl border-r border-subtle flex flex-col fixed left-0 top-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        {/* Logo */}
        <div className="px-5 py-4 border-b border-subtle">
          <div className="flex items-center justify-between">
            <img src="/logo.svg" alt="MySetlists" className="h-10 w-auto" />
            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-xl hover:bg-highlight transition-colors"
            >
              <X className="w-5 h-5 text-secondary" />
            </button>
          </div>
        </div>

        {/* User info - hidden for now */}

        {/* Pinned top: Search */}
        <div className="p-3 space-y-1 border-b border-subtle">
          {pinnedTopItems.map(({ id, label, icon: Icon, badge }) => (
            <Link
              key={id}
              href={`/${id}`}
              onClick={() => { if (onClose) onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                activeView === id
                  ? 'border-l-[3px] border-accent-amber bg-accent-amber-glow text-accent-amber'
                  : 'text-secondary hover:bg-highlight hover:text-primary'
              }`}
            >
              <Icon className={`w-5 h-5 ${activeView === id ? 'text-accent-amber' : ''}`} />
              <span className="font-medium flex-1">{label}</span>
              {badge > 0 && (
                <span className="bg-danger text-primary text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Scrollable middle */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {scrollItems.map(({ id, label, icon: Icon, badge, beta }) => (
            <Link
              key={id}
              href={`/${id === 'shows' ? '' : id}`}
              onClick={() => { if (onClose) onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                activeView === id || (id === 'shows' && activeView === '')
                  ? 'border-l-[3px] border-accent-amber bg-accent-amber-glow text-accent-amber'
                  : 'text-secondary hover:bg-highlight hover:text-primary'
              }`}
            >
              <Icon className={`w-5 h-5 ${(activeView === id || (id === 'shows' && activeView === '')) ? 'text-accent-amber' : ''}`} />
              <span className="font-medium flex-1">{label}</span>
              {beta && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-amber-glow text-accent-amber border border-accent-amber/20">
                  Beta
                </span>
              )}
              {badge > 0 && (
                <span className="bg-danger text-primary text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Pinned bottom: Invite + Feedback */}
        <div className="p-3 space-y-1 border-t border-subtle">
          {pinnedBottomItems.map(({ id, label, icon: Icon, badge }) => (
            <Link
              key={id}
              href={`/${id}`}
              onClick={() => { if (onClose) onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all ${
                activeView === id
                  ? 'border-l-[3px] border-accent-amber bg-accent-amber-glow text-accent-amber'
                  : 'text-muted hover:bg-highlight hover:text-primary'
              }`}
            >
              <Icon className={`w-4 h-4 ${activeView === id ? 'text-accent-amber' : ''}`} />
              <span className="font-medium flex-1">{label}</span>
              {badge > 0 && (
                <span className="bg-danger text-primary text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Bottom section */}
        <div className="p-3 border-t border-subtle space-y-1">
          {isGuest && (
            <>
              <div className="px-4 py-2 mb-2 bg-accent-amber-glow border border-accent-amber/20 rounded-xl">
                <p className="text-xs text-accent-amber">
                  Your shows are saved locally. Create an account to sync across devices.
                </p>
              </div>
              <button
                onClick={() => { onCreateAccount(); onClose && onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left bg-accent-amber text-void font-semibold hover:opacity-90 transition-all"
              >
                <User className="w-5 h-5" />
                <span className="font-medium">Create Account</span>
              </button>
            </>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => { if (onClose) onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                activeView === 'admin'
                  ? 'bg-danger/20 text-danger'
                  : 'text-secondary hover:bg-highlight hover:text-primary'
              }`}
            >
              <Shield className={`w-5 h-5 ${activeView === 'admin' ? 'text-danger' : ''}`} />
              <span className="font-medium">Admin</span>
            </Link>
          )}
          <a
            href="https://buymeacoffee.com/phillipd"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-accent-amber hover:bg-accent-amber-glow transition-all"
          >
            <Coffee className="w-5 h-5" />
            <span className="font-medium">Support</span>
          </a>
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-secondary hover:bg-highlight hover:text-primary transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{isGuest ? 'Exit Guest Mode' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
