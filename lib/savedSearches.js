// lib/savedSearches.js
//
// Saved searches and recent search history for the Advanced Search page.
// Stored in localStorage, per-user, since these are lightweight per-device
// conveniences rather than data that needs to sync across devices — no
// existing Firestore collection for this, and the app already uses
// localStorage for guest-mode shows (see context/AppContext.jsx).

const MAX_SAVED = 20;
const MAX_HISTORY = 8;

function savedKey(uid) { return `advSearch:${uid}:saved`; }
function historyKey(uid) { return `advSearch:${uid}:history`; }

function readJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private browsing, quota) — silently no-op
  }
}

export function getSavedSearches(uid) {
  return readJSON(savedKey(uid), []);
}

export function addSavedSearch(uid, { name, filters }) {
  const existing = getSavedSearches(uid).filter(s => s.name !== name);
  const next = [{ name, filters, savedAt: Date.now() }, ...existing].slice(0, MAX_SAVED);
  writeJSON(savedKey(uid), next);
  return next;
}

export function deleteSavedSearch(uid, name) {
  const next = getSavedSearches(uid).filter(s => s.name !== name);
  writeJSON(savedKey(uid), next);
  return next;
}

export function getSearchHistory(uid) {
  return readJSON(historyKey(uid), []);
}

export function pushSearchHistory(uid, summary) {
  if (!summary) return getSearchHistory(uid);
  const existing = getSearchHistory(uid).filter(s => s.summary !== summary);
  const next = [{ summary, at: Date.now() }, ...existing].slice(0, MAX_HISTORY);
  writeJSON(historyKey(uid), next);
  return next;
}
