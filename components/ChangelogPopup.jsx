'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import PopupOverlay from './PopupOverlay';
import { popupManager } from '@/lib/popupManager';

// Bump this ID whenever there's a new batch of releases worth announcing —
// a new ID means everyone sees the popup again, regardless of past dismissals.
const POPUP_ID = 'popup-changelog-2026-08-31';

const HIGHLIGHTS = [
  'Bust-out detection — setlists now flag songs returning after a long absence',
  'Photos, videos, posters & setlist photos on every show page',
  'Comments, @mentions, and a real-time friend activity feed',
  'Venue pages, verification, and a venue bucket list',
  'Group meetups, anniversary reminders, and Year in Review',
  'Advanced search, festival tracking, and a dedicated Tours tab',
];

export default function ChangelogPopup({ user }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (popupManager.shouldShowPopup(POPUP_ID)) {
      setVisible(true);
    }
  }, [user]);

  if (!visible) return null;

  const dismiss = () => {
    popupManager.dismissPopup(POPUP_ID);
    setVisible(false);
  };

  return (
    <PopupOverlay
      popupId={POPUP_ID}
      title="A lot shipped this week"
      variant="announcement"
      onDismiss={dismiss}
      learnMoreUrl="/release-notes"
      learnMoreLabel="See full release notes"
      dismissLabel="Got It"
    >
      <p className="mb-3">
        <Sparkles className="inline w-4 h-4 text-brand -mt-0.5 mr-1" />
        Six days, 20+ releases. Here&apos;s what&apos;s new:
      </p>
      <ul className="space-y-1.5 list-disc list-inside marker:text-brand">
        {HIGHLIGHTS.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </PopupOverlay>
  );
}
