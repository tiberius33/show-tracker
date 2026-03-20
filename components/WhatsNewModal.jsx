'use client';

import React, { useState, useEffect } from 'react';
import { X, Sparkles, Camera, Upload, Users, MessageSquare, Music, Palette, ChevronRight } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';

// Bump this version string whenever you add new features to announce.
// Users who have seen this version won't see the modal again.
const CURRENT_WHATS_NEW_VERSION = '3.3';

const FEATURES = [
  {
    icon: Palette,
    color: 'text-brand',
    bg: 'bg-brand-subtle',
    title: 'Brand Refresh — New Light Theme',
    description: 'A fresh, clean look built from the MySetlists logo — green and amber accents on a light background with a dark navy sidebar.',
    cta: null,
  },
  {
    icon: Music,
    color: 'text-brand',
    bg: 'bg-brand-subtle',
    title: 'Create Playlists from Setlists',
    description: 'Turn any setlist into a Spotify or Apple Music playlist with one tap.',
    cta: null,
  },
  {
    icon: Camera,
    color: 'text-amber',
    bg: 'bg-amber-subtle',
    title: 'AI Ticket Stub Scanner',
    description: 'Snap a photo of any ticket stub or digital ticket to add shows instantly.',
    cta: { label: 'Try Scan / Import', view: 'scan-import' },
  },
  {
    icon: Upload,
    color: 'text-amber',
    bg: 'bg-amber/15',
    title: 'Bulk Import from CSV',
    description: 'Import hundreds of shows at once from a spreadsheet or CSV file.',
    cta: { label: 'Try Scan / Import', view: 'scan-import' },
  },
  {
    icon: Users,
    color: 'text-amber',
    bg: 'bg-amber-subtle',
    title: 'Bulk Accept Friend Tags',
    description: 'Accept all pending show tags from friends in one tap — no more clicking one by one.',
    cta: { label: 'View Friends', view: 'friends' },
  },
];

function WhatsNewModal({ onClose, navigateTo }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in after mount
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setVisible(false);
    storage.set(STORAGE_KEYS.WHATS_NEW_VERSION, CURRENT_WHATS_NEW_VERSION);
    setTimeout(onClose, 200); // wait for animation
  };

  const handleCta = (view) => {
    storage.set(STORAGE_KEYS.WHATS_NEW_VERSION, CURRENT_WHATS_NEW_VERSION);
    onClose();
    if (navigateTo) navigateTo(view);
  };

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 transition-all duration-200 ${visible ? 'bg-sidebar/50 backdrop-blur-sm' : 'bg-black/0'}`}
      onClick={handleClose}
    >
      <div
        className={`bg-elevated border border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-5 pt-6 pb-4 text-center border-b border-subtle bg-gradient-to-b from-amber/10 to-transparent">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-primary hover:bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-full bg-amber-subtle flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-amber" />
          </div>
          <h2 className="text-lg font-bold text-primary">What&apos;s New</h2>
          <p className="text-xs text-muted mt-1">Recent features added to MySetlists</p>
        </div>

        {/* Feature list */}
        <div className="px-4 py-3 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-hover/30 hover:bg-hover transition-colors"
                >
                  <div className={`w-9 h-9 rounded-lg ${feature.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-4.5 h-4.5 ${feature.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-primary">{feature.title}</h3>
                    <p className="text-xs text-secondary mt-0.5 leading-relaxed">{feature.description}</p>
                    {feature.cta && (
                      <button
                        onClick={() => handleCta(feature.cta.view)}
                        className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-amber hover:text-amber transition-colors"
                      >
                        {feature.cta.label}
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-subtle">
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-xl bg-amber hover:bg-amber text-primary text-sm font-semibold transition-colors"
          >
            Got it
          </button>
          <p className="text-center text-[10px] text-muted mt-2">
            See all updates in Release Notes
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Check whether the What's New modal should be shown.
 * Returns true for returning users who haven't seen this version yet.
 */
export function shouldShowWhatsNew() {
  const seen = storage.get(STORAGE_KEYS.WHATS_NEW_VERSION);
  return seen !== CURRENT_WHATS_NEW_VERSION;
}

export default WhatsNewModal;
