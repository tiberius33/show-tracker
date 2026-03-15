/**
 * API base URL helper for Capacitor native app support.
 *
 * On web, API calls use relative URLs (same origin).
 * On native (Capacitor), the origin is capacitor://localhost,
 * so we prepend the live backend URL.
 */

let isNative = false;
try {
  // Dynamic check — @capacitor/core may not be installed in web-only builds
  const { Capacitor } = require('@capacitor/core');
  isNative = Capacitor.isNativePlatform();
} catch {
  // @capacitor/core not available — we're on web
}

const API_BASE = isNative ? 'https://mysetlists.net' : '';

/**
 * Prepend the API base URL to a path for native platform compatibility.
 * @param {string} path - e.g. '/.netlify/functions/spotify-token'
 * @returns {string} Full URL on native, relative path on web
 */
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}
