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
    { id: 'upcoming-shows', label: 'Upcoming Shows', icon: Ticket, badge: upcomingShowsBadgeCount, beta: true },
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
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-64 h-screen bg-slate-950/95 md:bg-slate-950/80 backdrop-blur-xl border-r border-white/5 flex flex-col fixed left-0 top-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <img src="/logo.svg" alt="MySetlists" className="h-10 w-auto" />
            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
        </div>

        {/* User info - hidden for now */}

        {/* Pinned top: Search */}
        <div className="p-3 space-y-1 border-b border-white/5">
          {pinnedTopItems.map(({ id, label, icon: Icon, badge }) => (
            <Link
              key={id}
              href={`/${id}`}
              onClick={() => { if (onClose) onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                activeView === id
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <Icon className={`w-5 h-5 ${activeView === id ? 'text-emerald-400' : ''}`} />
              <span className="font-medium flex-1">{label}</span>
              {badge > 0 && (
                <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
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
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                activeView === id || (id === 'shows' && activeView === '')
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <Icon className={`w-5 h-5 ${(activeView === id || (id === 'shows' && activeView === '')) ? 'text-emerald-400' : ''}`} />
              <span className="font-medium flex-1">{label}</span>
              {beta && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  Beta
                </span>
              )}
              {badge > 0 && (
                <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Pinned bottom: Invite + Feedback */}
        <div className="p-3 space-y-1 border-t border-white/5">
          {pinnedBottomItems.map(({ id, label, icon: Icon, badge }) => (
            <Link
              key={id}
              href={`/${id}`}
              onClick={() => { if (onClose) onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                activeView === id
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <Icon className={`w-5 h-5 ${activeView === id ? 'text-emerald-400' : ''}`} />
              <span className="font-medium flex-1">{label}</span>
              {badge > 0 && (
                <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Bottom section */}
        <div className="p-3 border-t border-white/5 space-y-1">
          {isGuest && (
            <>
              <div className="px-4 py-2 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-400">
                  Your shows are saved locally. Create an account to sync across devices.
                </p>
              </div>
              <button
                onClick={() => { onCreateAccount(); onClose && onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 transition-all"
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
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                activeView === 'admin'
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <Shield className={`w-5 h-5 ${activeView === 'admin' ? 'text-rose-400' : ''}`} />
              <span className="font-medium">Admin</span>
            </Link>
          )}
          <a
            href="https://buymeacoffee.com/phillipd"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-amber-400 hover:bg-amber-500/10 transition-all"
          >
            <Coffee className="w-5 h-5" />
            <span className="font-medium">Support</span>
          </a>
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-white/60 hover:bg-white/5 hover:text-white/80 transition-all"
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
