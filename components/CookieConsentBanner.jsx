'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-2xl mx-auto bg-elevated/95 backdrop-blur-xl border border-subtle rounded-2xl p-5 shadow-2xl">
        <p className="text-sm text-secondary mb-4">
          We use cookies to keep you signed in and improve your experience. See our{' '}
          <Link href="/cookies" className="text-accent-amber hover:text-accent-amber underline">Cookie Policy</Link>{' '}
          for details.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleAccept}
            className="px-5 py-2 bg-gradient-to-r from-accent-amber to-accent-teal hover:from-accent-amber hover:to-accent-teal text-primary rounded-xl text-sm font-medium transition-all shadow-lg shadow-accent-amber/20"
          >
            Accept
          </button>
          <button
            onClick={handleDecline}
            className="px-5 py-2 bg-highlight hover:bg-highlight text-secondary rounded-xl text-sm font-medium transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
