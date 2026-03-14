/**
 * Centralized localStorage helpers — SSR-safe for Next.js.
 */

const isBrowser = typeof window !== 'undefined';

export const storage = {
  get: (key) => (isBrowser ? localStorage.getItem(key) : null),
  set: (key, val) => isBrowser && localStorage.setItem(key, val),
  remove: (key) => isBrowser && localStorage.removeItem(key),
  getJSON: (key) => {
    try {
      return JSON.parse(storage.get(key));
    } catch {
      return null;
    }
  },
  setJSON: (key, val) => storage.set(key, JSON.stringify(val)),
};

export const STORAGE_KEYS = {
  LAST_VISIT: 'mysetlists_lastVisit',
  SEEN_TOOLTIPS: 'hasSeenOnboardingTooltips',
  INVITE_REFERRER: 'invite-referrer',
  LEGACY_SHOWS: 'concert-shows',
  GUEST_SHOWS: 'guest-shows',
  GUEST_SESSION: 'guest-session-id',
  COOKIE_CONSENT: 'cookie-consent',
};
