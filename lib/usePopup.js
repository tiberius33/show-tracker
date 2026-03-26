'use client';

import { useState, useEffect, useCallback } from 'react';
import { popupManager } from '@/lib/popupManager';

/**
 * usePopup — hook for managing a single popup's visibility.
 *
 * @param {string} popupId — unique popup identifier
 * @returns {{ isVisible: boolean, dismiss: () => void, reset: () => void }}
 *
 * Usage:
 *   const { isVisible, dismiss } = usePopup('popup-new-feature-v3.17');
 *   if (isVisible) return <PopupOverlay onDismiss={dismiss} ... />;
 */
export function usePopup(popupId) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!popupId) return;
    setIsVisible(popupManager.shouldShowPopup(popupId));
  }, [popupId]);

  const dismiss = useCallback(() => {
    if (!popupId) return;
    popupManager.dismissPopup(popupId);
    setIsVisible(false);
  }, [popupId]);

  const reset = useCallback(() => {
    if (!popupId) return;
    popupManager.resetPopup(popupId);
    setIsVisible(true);
  }, [popupId]);

  return { isVisible, dismiss, reset };
}
