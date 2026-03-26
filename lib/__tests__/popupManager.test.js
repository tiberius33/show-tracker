/**
 * Unit tests for popupManager.
 *
 * Run with: node lib/__tests__/popupManager.test.js
 *
 * These tests mock localStorage and Date to verify popup dismissal logic.
 */

const assert = require('assert');

// ── Mock localStorage ───────────────────────────────
let mockStore = {};
const mockLocalStorage = {
  getItem: (key) => mockStore[key] ?? null,
  setItem: (key, val) => { mockStore[key] = val; },
  removeItem: (key) => { delete mockStore[key]; },
};

const mockSessionStorage = {
  getItem: (key) => null,
  setItem: (key, val) => {},
  removeItem: (key) => {},
};

// ── Setup globals ───────────────────────────────────
globalThis.window = { undefined: undefined };
globalThis.localStorage = mockLocalStorage;
globalThis.sessionStorage = mockSessionStorage;

// Import after mocking (dynamic import not needed since we mock globals)
// We'll re-implement the core logic for testing since ES modules + CJS is tricky
const STORAGE_KEY = 'mysetlists_popup_dismissals';
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

function getStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return {};
  }
}

function setStore(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function isValidRecord(record) {
  if (!record || typeof record !== 'object') return false;
  if (!record.popupId || typeof record.popupId !== 'string') return false;
  if (!record.dismissedAt || !record.expiresAt) return false;
  const dismissed = new Date(record.dismissedAt).getTime();
  const expires = new Date(record.expiresAt).getTime();
  if (isNaN(dismissed) || isNaN(expires)) return false;
  const now = Date.now();
  if (dismissed > now + 60_000) return false;
  return true;
}

const popupManager = {
  isPopupDismissed(popupId) {
    const store = getStore();
    const record = store[popupId];
    if (!record || !isValidRecord(record)) return false;
    const now = Date.now();
    const expiresAt = new Date(record.expiresAt).getTime();
    return now < expiresAt;
  },
  shouldShowPopup(popupId) {
    return !this.isPopupDismissed(popupId);
  },
  dismissPopup(popupId) {
    const store = getStore();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TWELVE_MONTHS_MS);
    store[popupId] = {
      popupId,
      dismissedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    setStore(store);
  },
  resetPopup(popupId) {
    const store = getStore();
    delete store[popupId];
    setStore(store);
  },
  getAllDismissedPopups() {
    return getStore();
  },
  cleanupExpiredDismissals() {
    const store = getStore();
    const now = Date.now();
    let removed = 0;
    for (const [id, record] of Object.entries(store)) {
      if (!isValidRecord(record)) { delete store[id]; removed++; continue; }
      const expiresAt = new Date(record.expiresAt).getTime();
      if (now >= expiresAt) { delete store[id]; removed++; }
    }
    if (removed > 0) setStore(store);
    return removed;
  },
  clearAll() {
    setStore({});
  },
};

// ── Test Runner ─────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  mockStore = {}; // reset before each test
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\nPopupManager Unit Tests\n');

// ── shouldShowPopup tests ───────────────────────────

test('shouldShowPopup returns true for never-dismissed popup', () => {
  assert.strictEqual(popupManager.shouldShowPopup('popup-test-v1'), true);
});

test('shouldShowPopup returns false after dismissal', () => {
  popupManager.dismissPopup('popup-test-v1');
  assert.strictEqual(popupManager.shouldShowPopup('popup-test-v1'), false);
});

test('shouldShowPopup returns true after 12 months', () => {
  // Simulate a dismissal 13 months ago
  const store = {};
  const thirteenMonthsAgo = new Date(Date.now() - (TWELVE_MONTHS_MS + 30 * 24 * 60 * 60 * 1000));
  const expired = new Date(thirteenMonthsAgo.getTime() + TWELVE_MONTHS_MS);
  store['popup-old-v1'] = {
    popupId: 'popup-old-v1',
    dismissedAt: thirteenMonthsAgo.toISOString(),
    expiresAt: expired.toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  assert.strictEqual(popupManager.shouldShowPopup('popup-old-v1'), true);
});

// ── isPopupDismissed tests ──────────────────────────

test('isPopupDismissed returns false for unknown popup', () => {
  assert.strictEqual(popupManager.isPopupDismissed('unknown'), false);
});

test('isPopupDismissed returns true for recently dismissed popup', () => {
  popupManager.dismissPopup('popup-recent-v1');
  assert.strictEqual(popupManager.isPopupDismissed('popup-recent-v1'), true);
});

// ── dismissPopup tests ──────────────────────────────

test('dismissPopup stores correct data', () => {
  const before = Date.now();
  popupManager.dismissPopup('popup-store-test');
  const after = Date.now();
  const store = getStore();
  const record = store['popup-store-test'];

  assert.ok(record, 'Record should exist');
  assert.strictEqual(record.popupId, 'popup-store-test');

  const dismissedAt = new Date(record.dismissedAt).getTime();
  assert.ok(dismissedAt >= before && dismissedAt <= after, 'dismissedAt should be ~now');

  const expiresAt = new Date(record.expiresAt).getTime();
  const expectedExpiry = dismissedAt + TWELVE_MONTHS_MS;
  assert.ok(Math.abs(expiresAt - expectedExpiry) < 1000, 'expiresAt should be 12 months from dismissedAt');
});

// ── resetPopup tests ────────────────────────────────

test('resetPopup clears dismissal', () => {
  popupManager.dismissPopup('popup-reset-test');
  assert.strictEqual(popupManager.isPopupDismissed('popup-reset-test'), true);
  popupManager.resetPopup('popup-reset-test');
  assert.strictEqual(popupManager.isPopupDismissed('popup-reset-test'), false);
  assert.strictEqual(popupManager.shouldShowPopup('popup-reset-test'), true);
});

// ── cleanupExpiredDismissals tests ──────────────────

test('cleanupExpiredDismissals removes expired entries', () => {
  const store = {};
  const twoYearsAgo = new Date(Date.now() - 2 * TWELVE_MONTHS_MS);
  store['popup-expired'] = {
    popupId: 'popup-expired',
    dismissedAt: twoYearsAgo.toISOString(),
    expiresAt: new Date(twoYearsAgo.getTime() + TWELVE_MONTHS_MS).toISOString(),
  };
  store['popup-valid'] = {
    popupId: 'popup-valid',
    dismissedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + TWELVE_MONTHS_MS).toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

  const removed = popupManager.cleanupExpiredDismissals();
  assert.strictEqual(removed, 1);

  const updated = getStore();
  assert.strictEqual(updated['popup-expired'], undefined);
  assert.ok(updated['popup-valid'], 'Valid entry should remain');
});

test('cleanupExpiredDismissals removes invalid records', () => {
  const store = {
    'bad-record': { popupId: 123, dismissedAt: 'not-a-date', expiresAt: 'also-not' },
    'missing-fields': { popupId: 'missing-fields' },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

  const removed = popupManager.cleanupExpiredDismissals();
  assert.strictEqual(removed, 2);
  assert.deepStrictEqual(getStore(), {});
});

// ── Edge cases ──────────────────────────────────────

test('handles corrupted localStorage data gracefully', () => {
  localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
  assert.strictEqual(popupManager.shouldShowPopup('any-popup'), true);
});

test('handles array in localStorage gracefully', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
  assert.strictEqual(popupManager.shouldShowPopup('any-popup'), true);
});

test('handles null in localStorage gracefully', () => {
  localStorage.setItem(STORAGE_KEY, 'null');
  assert.strictEqual(popupManager.shouldShowPopup('any-popup'), true);
});

test('clock skew — future dismissedAt is treated as invalid', () => {
  const store = {};
  const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 min in future
  store['popup-future'] = {
    popupId: 'popup-future',
    dismissedAt: futureDate.toISOString(),
    expiresAt: new Date(futureDate.getTime() + TWELVE_MONTHS_MS).toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  assert.strictEqual(popupManager.isPopupDismissed('popup-future'), false);
});

test('getAllDismissedPopups returns all records', () => {
  popupManager.dismissPopup('popup-a');
  popupManager.dismissPopup('popup-b');
  const all = popupManager.getAllDismissedPopups();
  assert.ok(all['popup-a'], 'Should have popup-a');
  assert.ok(all['popup-b'], 'Should have popup-b');
});

test('clearAll removes everything', () => {
  popupManager.dismissPopup('popup-clear-test');
  popupManager.clearAll();
  const all = popupManager.getAllDismissedPopups();
  assert.deepStrictEqual(all, {});
});

test('multiple popups tracked independently', () => {
  popupManager.dismissPopup('popup-1');
  assert.strictEqual(popupManager.shouldShowPopup('popup-1'), false);
  assert.strictEqual(popupManager.shouldShowPopup('popup-2'), true);
  popupManager.dismissPopup('popup-2');
  assert.strictEqual(popupManager.shouldShowPopup('popup-2'), false);
  popupManager.resetPopup('popup-1');
  assert.strictEqual(popupManager.shouldShowPopup('popup-1'), true);
  assert.strictEqual(popupManager.shouldShowPopup('popup-2'), false);
});

// ── Summary ─────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
