// hooks/useKeyboardInset.js
//
// How many pixels of the viewport the on-screen keyboard is covering, as
// React state. Backed by lib/keyboardInset.js, which is the single source
// for both platforms — see that file for why there used to be two.

'use client';

import { useEffect, useState } from 'react';
import { keyboardHeight, subscribeKeyboardInset } from '@/lib/keyboardInset';

export default function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    // Catch up first: the keyboard may already be open when this mounts
    // (opening a sheet from a focused field).
    setInset(keyboardHeight());
    return subscribeKeyboardInset(setInset);
  }, []);

  return inset;
}
