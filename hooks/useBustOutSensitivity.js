// hooks/useBustOutSensitivity.js
//
// Reads/writes the user's bust-out sensitivity (a multiplier scaling the
// shows/days bands in lib/bustOuts.js) from
// userProfiles/{uid}.bustOutSensitivity, following the same read-on-mount /
// write-on-change pattern as components/notifications/NotificationSettings.js.

'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_BUSTOUT_SENSITIVITY } from '@/lib/bustOuts';

export default function useBustOutSensitivity(userId) {
  const [sensitivity, setSensitivity] = useState(DEFAULT_BUSTOUT_SENSITIVITY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setSensitivity(DEFAULT_BUSTOUT_SENSITIVITY);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, 'userProfiles', userId))
      .then(snap => {
        if (cancelled) return;
        const val = snap.exists() ? snap.data().bustOutSensitivity : null;
        if (val) setSensitivity(val);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [userId]);

  const updateSensitivity = useCallback(async (value) => {
    setSensitivity(value);
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'userProfiles', userId), { bustOutSensitivity: value });
    } catch (error) {
      console.error('Failed to save bust-out sensitivity:', error);
    }
  }, [userId]);

  return { sensitivity, loaded, updateSensitivity };
}
