'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { isNativePlatform } from '@/lib/native-auth';

export default function InstallPrompt() {
  const native = isNativePlatform();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Don't listen for PWA install events on native app
    if (native) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after user has been engaged (30 seconds)
      setTimeout(() => setShowPrompt(true), 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [native]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Install outcome:', outcome);
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again this session
    setDeferredPrompt(null);
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gradient-to-r from-brand to-amber rounded-2xl p-4 shadow-xl z-50 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-hover rounded-xl flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-primary font-semibold">Install MySetlists</p>
          <p className="text-secondary text-sm mt-1">Add to your home screen for quick access</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-brand text-on-dark rounded-lg font-medium text-sm hover:brightness-105 transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-secondary hover:text-primary text-sm transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
