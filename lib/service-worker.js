/**
 * Registers the offline-caching service worker (public/service-worker.js).
 *
 * Production web only:
 *  - Capacitor's native WebView doesn't use a browser service worker, and
 *    registering one there provides none of the PWA offline/installability
 *    wins it exists for.
 *  - Skipped outside production so `next dev` and e2e runs against a dev
 *    server aren't affected by cached responses.
 *
 * Registered at the default scope ("/", since the script is served from the
 * site root) so it controls the page and the manifest's start_url — that's
 * what Lighthouse's "Registers a service worker" PWA audit checks for. This
 * doesn't collide with the separate Firebase Cloud Messaging service worker
 * (public/firebase-messaging-sw.js): Firebase registers that one lazily, on
 * its own dedicated "firebase-cloud-messaging-push-scope", not "/".
 */
let registered = false;

export function registerServiceWorker() {
  if (registered) return;
  registered = true;

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (process.env.NODE_ENV !== 'production') return;

  try {
    const { Capacitor } = require('@capacitor/core');
    if (Capacitor.isNativePlatform()) return;
  } catch {
    // Not in a Capacitor environment — proceed as web
  }

  const register = () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  };

  // Avoid competing with in-flight page resources — but don't miss the
  // load event if it already fired before this ran.
  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
