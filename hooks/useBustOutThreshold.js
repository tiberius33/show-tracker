// hooks/useBustOutThreshold.js
//
// Reads/writes the user's bust-out threshold (minimum days since last play
// before a song is flagged) from userProfiles/{uid}.bustOutThresholdDays,
// following the same read-on-mount / write-on-change pattern as
// components/notifications/NotificationSettings.js.

'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_BUSTOUT_THRESHOLD_DAYS } from '@/lib/bustOuts';

export default function useBustOutThreshold(userId) {
  const [thresholdDays, setThresholdDays] = useState(DEFAULT_BUSTOUT_THRESHOLD_DAYS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setThresholdDays(DEFAULT_BUSTOUT_THRESHOLD_DAYS);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, 'userProfiles', userId))
      .then(snap => {
        if (cancelled) return;
        const val = snap.exists() ? snap.data().bustOutThresholdDays : null;
        if (val) setThresholdDays(val);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [userId]);

  const updateThreshold = useCallback(async (days) => {
    setThresholdDays(days);
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'userProfiles', userId), { bustOutThresholdDays: days });
    } catch (error) {
      console.error('Failed to save bust-out threshold:', error);
    }
  }, [userId]);

  return { thresholdDays, loaded, updateThreshold };
}
