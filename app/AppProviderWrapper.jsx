'use client';

import { useEffect } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import Sidebar from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import VenueRatingModal from '@/components/VenueRatingModal';
import InstallPrompt from '@/components/InstallPrompt';
import Footer from '@/components/Footer';
import AuthModal from '@/components/auth/AuthModal';
import LandingPage from '@/components/LandingPage';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import PopupQueue from '@/components/PopupQueue';
import { extractFirstName } from '@/lib/utils';
import { initCapacitorPlugins } from '@/lib/capacitor';
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
    enterGuestMode, exitGuestMode, communityStats,
    handleAuthSuccess,
  } = useApp();

  // Initialize Capacitor native plugins on mount
  useEffect(() => {
    initCapacitorPlugins();
  }, []);

  // Show loading state while auth initializes
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-base via-surface to-base flex items-center justify-center">
        <div className="text-muted text-lg">Loading...</div>
      </div>
    );
  }

  // Show landing page with optional auth modal overlay when logged out
  if (!user && !guestMode) {
    return (
      <>
        <LandingPage
          onSignUp={() => setAuthModal('signup')}
          onSignIn={() => setAuthModal('login')}
          onGuest={enterGuestMode}
          communityStats={communityStats}
        />
        {authModal && (
          <AuthModal
            mode={authModal}
            onClose={() => setAuthModal(null)}
            onSwitchMode={setAuthModal}
            onSuccess={handleAuthSuccess}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-base via-surface to-base text-primary">
      {/* Migration Prompt Modal */}
      {showMigrationPrompt && (
        <div className="fixed inset-0 md:left-64 bg-sidebar/50 backdrop-blur-xl flex items-center justify-center p-3 md:p-4 z-[60]">
          <div className="bg-elevated border border-subtle rounded-2xl md:rounded-3xl max-w-[95vw] sm:max-w-md w-full p-4 md:p-6 shadow-2xl">
            <h2 className="text-lg md:text-xl font-bold mb-4 text-primary">Import Existing Shows?</h2>
            <p className="text-secondary mb-4">
              We found {localShowsToMigrate.length} show{localShowsToMigrate.length !== 1 ? 's' : ''} saved locally on this device.
              Would you like to import them to your account?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleMigrateData}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary rounded-xl font-medium transition-all shadow-lg shadow-brand/20"
              >
                Import Shows
              </button>
              <button
                onClick={handleSkipMigration}
                className="px-4 py-2.5 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors"
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
            <div className="text-2xl font-bold text-primary bg-black/50 backdrop-blur-sm px-6 py-3 rounded-2xl">
              First show added!
            </div>
          </div>
        </div>
      )}

      {/* Guest Mode Account Prompt */}
      {showGuestPrompt && (
        <div className="fixed inset-0 md:left-64 bg-sidebar/50 backdrop-blur-xl flex items-center justify-center p-4 z-[60]">
          <div className="bg-elevated border border-subtle rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-brand to-brand rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-2">Great Start!</h2>
              <p className="text-secondary">
                Your show is saved locally on this device. Create a free account to:
              </p>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-3 text-secondary">
                <Check className="w-5 h-5 text-brand flex-shrink-0" />
                <span>Save your shows permanently in the cloud</span>
              </li>
              <li className="flex items-center gap-3 text-secondary">
                <Check className="w-5 h-5 text-brand flex-shrink-0" />
                <span>Access your collection from any device</span>
              </li>
              <li className="flex items-center gap-3 text-secondary">
                <Check className="w-5 h-5 text-brand flex-shrink-0" />
                <span>Join the community leaderboards</span>
              </li>
            </ul>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowGuestPrompt(false); openAuthModal('signup'); }}
                className="w-full px-4 py-3 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary rounded-xl font-medium transition-all shadow-lg shadow-brand/20"
              >
                Create Free Account
              </button>
              <button
                onClick={() => setShowGuestPrompt(false)}
                className="w-full px-4 py-3 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors"
              >
                Maybe Later
              </button>
            </div>
            <p className="text-center text-muted text-xs mt-4">
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
          <div className="bg-elevated border border-brand/30 rounded-2xl w-full max-w-md p-8 shadow-2xl shadow-brand/10 text-center">
            <div className="w-16 h-16 bg-brand-subtle rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Music className="w-8 h-8 text-brand" />
            </div>
            <h2 className="text-2xl font-bold text-primary mb-3">Welcome to mysetlists.net! 🎉</h2>
            <p className="text-secondary leading-relaxed mb-6">
              You joined via <span className="text-brand font-semibold">{welcomeState.inviterName}</span>&apos;s invite —
              you&apos;re already friends on the app. Start adding shows and compare your concert history!
            </p>
            <button
              onClick={() => setWelcomeState(null)}
              className="w-full px-6 py-3 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary rounded-xl font-semibold transition-all shadow-lg shadow-brand/20"
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
        onLogout={guestMode ? exitGuestMode : handleLogout}
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

      {/* Popup Queue — one-time announcements */}
      {(user || guestMode) && (
        <PopupQueue
          isAdmin={isAdmin}
          showCount={shows?.length || 0}
        />
      )}

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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] px-5 py-3 bg-brand text-on-dark rounded-2xl shadow-lg shadow-brand/40 font-medium text-sm animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
