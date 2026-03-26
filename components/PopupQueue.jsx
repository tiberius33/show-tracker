'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { popupManager } from '@/lib/popupManager';
import { getPopupsForUser } from '@/lib/popups';
import PopupOverlay from '@/components/PopupOverlay';

/**
 * PopupQueue — renders eligible popups one at a time.
 *
 * Props:
 *   isAdmin    (bool)   — current user is admin
 *   showCount  (number) — how many shows the user has
 */
export default function PopupQueue({ isAdmin = false, showCount = 0 }) {
  const [dismissedSet, setDismissedSet] = useState(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  // Cleanup expired dismissals on mount
  useEffect(() => {
    popupManager.cleanupExpiredDismissals();
  }, []);

  // Get all eligible popups (filtered by audience)
  const eligiblePopups = useMemo(() => {
    return getPopupsForUser({ isAdmin, showCount });
  }, [isAdmin, showCount]);

  // Filter to only popups that haven't been dismissed
  const pendingPopups = useMemo(() => {
    return eligiblePopups.filter(
      (p) => popupManager.shouldShowPopup(p.id) && !dismissedSet.has(p.id)
    );
  }, [eligiblePopups, dismissedSet]);

  // Current popup to show
  const current = pendingPopups[0] || null;

  if (!current) return null;

  const handleDismiss = () => {
    popupManager.dismissPopup(current.id);
    setDismissedSet((prev) => new Set([...prev, current.id]));
  };

  return (
    <PopupOverlay
      key={current.id}
      popupId={current.id}
      title={current.title}
      variant={current.variant}
      onDismiss={handleDismiss}
      learnMoreUrl={current.learnMoreUrl}
      learnMoreLabel={current.learnMoreLabel}
    >
      <p>{current.content}</p>
      {pendingPopups.length > 1 && (
        <p className="mt-3 text-xs text-muted">
          {pendingPopups.length - 1} more announcement{pendingPopups.length - 1 > 1 ? 's' : ''} after this
        </p>
      )}
    </PopupOverlay>
  );
}
