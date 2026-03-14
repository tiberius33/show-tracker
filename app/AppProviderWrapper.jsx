'use client';

import { AppProvider, useApp } from '@/context/AppContext';
import Sidebar from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import VenueRatingModal from '@/components/VenueRatingModal';
import InstallPrompt from '@/components/InstallPrompt';
import Footer from '@/components/Footer';
import AuthModal from '@/components/auth/AuthModal';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import { extractFirstName } from '@/lib/utils';
import { Music, Check, Sparkles } from 'lucide-react';

export default function AppProviderWrapper({ children }) {
  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
      <CookieConsentBanner />
    </AppProvider>
  );
}

function AppShell({ children }) {
  const {
    user, authLoading, guestMode, authModal, setAuthModal,
    isAdmin, shows,
    sidebarOpen, setSidebarOpen,
    toast, setToast,
    venueRatingShow, setVenueRatingShow,
    showMigrationPrompt, handleMigrateData, handleSkipMigration, localShowsToMigrate,
    showGuestPrompt, setShowGuestPrompt, openAuthModal,
    showCelebration, welcomeState, setWelcomeState,
    pendingNotificationCount, upcomingShowsBadgeCount,
    friends, handleLogout,
  } = useApp();

  // Show loading state while auth initializes
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white/40 text-lg">Loading...</div>
      </div>
    );
  }

  // Show auth modal if not logged in and not in guest mode
  if (!user && !guestMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <AuthModal
          mode={authModal || 'login'}
          onClose={() => setAuthModal(null)}
          onSwitchMode={setAuthModal}
          onGuestMode={() => {
            // Guest mode logic is handled in AppContext
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Migration Prompt Modal */}
      {showMigrationPrompt && (
        <div className="fixed inset-0 md:left-64 bg-black/60 backdrop-blur-xl flex items-center justify-center p-3 md:p-4 z-[60]">
          <div className="bg-slate-800 border border-white/10 rounded-2xl md:rounded-3xl max-w-[95vw] sm:max-w-md w-full p-4 md:p-6 shadow-2xl">
            <h2 className="text-lg md:text-xl font-bold mb-4 text-white">Import Existing Shows?</h2>
            <p className="text-white/60 mb-4">
              We found {localShowsToMigrate.length} show{localShowsToMigrate.length !== 1 ? 's' : ''} saved locally on this device.
              Would you like to import them to your account?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleMigrateData}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/30"
              >
                Import Shows
              </button>
              <button
                onClick={handleSkipMigration}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First Show Celebration */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-center animate-bounce">
            <div className="text-8xl mb-4">🤙</div>
            <div className="text-2xl font-bold text-white bg-black/50 backdrop-blur-sm px-6 py-3 rounded-2xl">
              First show added!
            </div>
          </div>
        </div>
      )}

      {/* Guest Mode Account Prompt */}
      {showGuestPrompt && (
        <div className="fixed inset-0 md:left-64 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-[60]">
          <div className="bg-slate-800 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Great Start!</h2>
              <p className="text-white/60">
                Your show is saved locally on this device. Create a free account to:
              </p>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-3 text-white/80">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Save your shows permanently in the cloud</span>
              </li>
              <li className="flex items-center gap-3 text-white/80">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Access your collection from any device</span>
              </li>
              <li className="flex items-center gap-3 text-white/80">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Join the community leaderboards</span>
              </li>
            </ul>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowGuestPrompt(false); openAuthModal('signup'); }}
                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/30"
              >
                Create Free Account
              </button>
              <button
                onClick={() => setShowGuestPrompt(false)}
                className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 text-white/70 rounded-xl font-medium transition-colors"
              >
                Maybe Later
              </button>
            </div>
            <p className="text-center text-white/40 text-xs mt-4">
              Your locally saved shows will be imported to your account
            </p>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <MobileHeader onMenuClick={() => setSidebarOpen(true)} />

      {/* Welcome modal — shown once when a new user joins via an invite */}
      {welcomeState && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-emerald-500/30 rounded-2xl w-full max-w-md p-8 shadow-2xl shadow-emerald-500/10 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Music className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Welcome to mysetlists.net! 🎉</h2>
            <p className="text-white/70 leading-relaxed mb-6">
              You joined via <span className="text-emerald-400 font-semibold">{welcomeState.inviterName}</span>&apos;s invite —
              you&apos;re already friends on the app. Start adding shows and compare your concert history!
            </p>
            <button
              onClick={() => setWelcomeState(null)}
              className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/25"
            >
              Let&apos;s go →
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal(null)}
          onSwitchMode={setAuthModal}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isAdmin={isAdmin}
        onLogout={guestMode ? () => { /* handled in context */ } : handleLogout}
        userName={guestMode ? 'Guest' : extractFirstName(user?.displayName)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isGuest={guestMode}
        onCreateAccount={() => openAuthModal('signup')}
        pendingNotificationCount={pendingNotificationCount}
        upcomingShowsBadgeCount={upcomingShowsBadgeCount}
      />

      {/* Main Content Area */}
      <div className="ml-0 md:ml-64 min-h-screen pt-14 md:pt-0">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-8">
          {children}
        </div>
      </div>

      <Footer />

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Venue Rating Modal */}
      {venueRatingShow && user && (
        <VenueRatingModal
          show={venueRatingShow}
          currentUser={user}
          onClose={() => setVenueRatingShow(null)}
          onSaved={() => {
            setToast(`Rating saved for ${venueRatingShow.venue}!`);
            setVenueRatingShow(null);
          }}
        />
      )}

      {/* Global toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] px-5 py-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/40 font-medium text-sm animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
