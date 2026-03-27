/**
 * Popup Manager — tracks popup dismissals using localStorage with 12-month expiration.
 *
 * Storage schema (key: 'mysetlists_popup_dismissals'):
 *   {
 *     "popup-feature-v3.17": {
 *       "popupId": "popup-feature-v3.17",
 *       "dismissedAt": "2026-03-26T12:00:00.000Z",
 *       "expiresAt": "2027-03-26T12:00:00.000Z"
 *     }
 *   }
 */

const STORAGE_KEY = 'mysetlists_popup_dismissals';
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000; // 31,536,000,000 ms
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 604,800,000 ms
const DEBUG = typeof window !== 'undefined' && typeof process !== 'undefined'
  ? process.env?.NEXT_PUBLIC_POPUP_DEBUG === 'true'
  : false;

function log(...args) {
  if (DEBUG) console.log('[PopupManager]', ...args);
}

function warn(...args) {
  console.warn('[PopupManager]', ...args);
}

// ── Storage helpers (SSR-safe) ──────────────────────

function getStore() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      warn('Corrupted popup data — resetting');
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    return parsed;
  } catch {
    warn('Failed to read popup data — resetting');
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return {};
  }
}

function setStore(data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    warn('localStorage write failed (quota exceeded?)', e.message);
    // Fallback: try sessionStorage so the popup at least stays dismissed this session
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* give up */ }
  }
}

/** Read from localStorage first, fall back to sessionStorage */
function getStoreWithFallback() {
  const primary = getStore();
  if (primary && Object.keys(primary).length > 0) return primary;
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

// ── Validation ──────────────────────────────────────

function isValidRecord(record) {
  if (!record || typeof record !== 'object') return false;
  if (!record.popupId || typeof record.popupId !== 'string') return false;
  if (!record.dismissedAt || !record.expiresAt) return false;
  // Check timestamps are valid ISO dates
  const dismissed = new Date(record.dismissedAt).getTime();
  const expires = new Date(record.expiresAt).getTime();
  if (isNaN(dismissed) || isNaN(expires)) return false;
  // Guard against future dismissedAt (clock skew)
  const now = Date.now();
  if (dismissed > now + 60_000) { // allow 1 min tolerance
    log(`Clock skew detected for ${record.popupId} — dismissedAt is in the future`);
    return false;
  }
  return true;
}

// ── Account-age eligibility ─────────────────────────

/**
 * Returns true if the account is 7+ days old (a "returning" user).
 * Missing or invalid timestamps default to returning (safe default — suppresses tooltips).
 * @param {number|string|null} createdAtTimestamp — millis epoch, ISO string, or null
 */
export function isReturningUser(createdAtTimestamp) {
  if (!createdAtTimestamp) return true;
  const createdMs = typeof createdAtTimestamp === 'number'
    ? createdAtTimestamp
    : new Date(createdAtTimestamp).getTime();
  if (isNaN(createdMs)) return true;
  const age = Date.now() - createdMs;
  log(`Account age: ${(age / (24 * 60 * 60 * 1000)).toFixed(1)} days`);
  return age >= SEVEN_DAYS_MS;
}

/**
 * Check whether a popup/tooltip should be shown based on user account age.
 * - "whats-new" popups always eligible (shown to all users)
 * - All other popups hidden for returning users (7+ day accounts)
 * @param {string} popupId
 * @param {boolean} returning — true if account ≥ 7 days old
 * @returns {boolean}
 */
export function isEligibleForTooltip(popupId, returning) {
  // What's New is always eligible regardless of account age
  if (popupId && popupId.includes('whats-new')) {
    log(`${popupId}: eligible (whats-new bypass)`);
    return true;
  }
  if (returning) {
    log(`${popupId}: ineligible (returning user)`);
    return false;
  }
  log(`${popupId}: eligible (new user)`);
  return true;
}

// ── Public API ──────────────────────────────────────

export const popupManager = {
  /**
   * Check if a popup has been dismissed AND the 12-month window hasn't expired.
   */
  isPopupDismissed(popupId) {
    const store = getStoreWithFallback();
    const record = store[popupId];
    if (!record) return false;
    if (!isValidRecord(record)) {
      log(`Invalid record for ${popupId} — treating as not dismissed`);
      return false;
    }
    const now = Date.now();
    const expiresAt = new Date(record.expiresAt).getTime();
    if (now >= expiresAt) {
      log(`Dismissal expired for ${popupId}`);
      return false;
    }
    return true;
  },

  /**
   * Returns true if the popup should be shown.
   * Checks both dismissal status AND account-age eligibility when opts are provided.
   * @param {string} popupId
   * @param {{ isReturningUser?: boolean, newUsersOnly?: boolean }} [opts]
   */
  shouldShowPopup(popupId, opts) {
    if (this.isPopupDismissed(popupId)) return false;
    // If eligibility info is provided, apply account-age gating
    if (opts && typeof opts.isReturningUser === 'boolean' && opts.newUsersOnly) {
      if (!isEligibleForTooltip(popupId, opts.isReturningUser)) return false;
    }
    return true;
  },

  /**
   * Mark a popup as dismissed with a 12-month expiration.
   */
  dismissPopup(popupId) {
    const store = getStoreWithFallback();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TWELVE_MONTHS_MS);
    store[popupId] = {
      popupId,
      dismissedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    setStore(store);
    log(`Dismissed ${popupId} — expires ${expiresAt.toISOString()}`);
  },

  /**
   * Reset (clear) a popup's dismissal so it shows again.
   */
  resetPopup(popupId) {
    const store = getStoreWithFallback();
    delete store[popupId];
    setStore(store);
    log(`Reset ${popupId}`);
  },

  /**
   * Return all dismissed popups (for debugging / admin).
   */
  getAllDismissedPopups() {
    return getStoreWithFallback();
  },

  /**
   * Remove expired dismissal records from storage. Call on app mount.
   */
  cleanupExpiredDismissals() {
    const store = getStoreWithFallback();
    const now = Date.now();
    let removed = 0;
    for (const [id, record] of Object.entries(store)) {
      if (!isValidRecord(record)) {
        delete store[id];
        removed++;
        continue;
      }
      const expiresAt = new Date(record.expiresAt).getTime();
      if (now >= expiresAt) {
        delete store[id];
        removed++;
      }
    }
    if (removed > 0) {
      setStore(store);
      log(`Cleaned up ${removed} expired dismissal(s)`);
    }
    return removed;
  },

  /**
   * Clear ALL dismissal data (admin reset).
   */
  clearAll() {
    setStore({});
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    log('All dismissal data cleared');
  },

  /**
   * Get info about a specific popup's dismissal state.
   */
  getPopupInfo(popupId) {
    const store = getStoreWithFallback();
    const record = store[popupId];
    if (!record || !isValidRecord(record)) {
      return { popupId, dismissed: false, dismissedAt: null, expiresAt: null, daysUntilReeligible: null };
    }
    const now = Date.now();
    const expiresAt = new Date(record.expiresAt).getTime();
    const expired = now >= expiresAt;
    const daysLeft = expired ? 0 : Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));
    return {
      popupId,
      dismissed: !expired,
      dismissedAt: record.dismissedAt,
      expiresAt: record.expiresAt,
      daysUntilReeligible: expired ? 0 : daysLeft,
    };
  },
};

export const POPUP_STORAGE_KEY = STORAGE_KEY;
