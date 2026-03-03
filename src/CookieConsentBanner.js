import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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
      <div className="max-w-2xl mx-auto bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
        <p className="text-sm text-white/80 mb-4">
          We use cookies to keep you signed in and improve your experience. See our{' '}
          <Link to="/cookies" className="text-emerald-400 hover:text-emerald-300 underline">Cookie Policy</Link>{' '}
          for details.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleAccept}
            className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-emerald-500/25"
          >
            Accept
          </button>
          <button
            onClick={handleDecline}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl text-sm font-medium transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
