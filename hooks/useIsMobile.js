// hooks/useIsMobile.js
//
// The single JS source of truth for "this is a phone", matched to the same
// 768px Tailwind's `md:` uses (see lib/platform.js). Everything in the
// mobile navigation work gates on this hook — header, gesture layer,
// sheet drags — so there is exactly one definition to change.

'use client';

import { useEffect, useState } from 'react';
import { MOBILE_MEDIA_QUERY } from '@/lib/platform';

export default function useIsMobile() {
  // Starts false so the statically exported HTML and the first client paint
  // agree. The header also carries `md:hidden`, so CSS hides it on desktop
  // regardless of what JS believes — the hook only gates *behaviour*.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    // addEventListener('change') is the modern spelling; addListener is kept
    // for older WKWebView builds, where the modern one is missing.
    if (mq.addEventListener) {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  return isMobile;
}
