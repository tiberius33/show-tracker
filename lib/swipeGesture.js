// lib/swipeGesture.js
//
// The decidable half of the edge-swipe-back gesture, with no DOM in it.
//
// Playwright cannot drive a native-feeling pointer gesture, so the part
// that can actually be got wrong — thresholds, the direction lock, the
// abort conditions — lives here as pure functions and is unit-tested in
// lib/__tests__/swipeGesture.test.js. The hook (hooks/useEdgeSwipeBack.js)
// is then only plumbing: read pointer events, ask these functions.

/** A pointerdown further than this from the left edge is not an edge swipe. */
export const EDGE_START_MAX_X = 24;

/** Movement before we decide whether this is a horizontal gesture at all. */
export const DIRECTION_LOCK_DISTANCE = 10;

/** Horizontal travel must beat vertical travel by this factor to be claimed. */
export const DIRECTION_LOCK_RATIO = 1.5;

/** Past this fraction of viewport width, release commits. */
export const COMMIT_DISTANCE_FRACTION = 0.35;

/** Or past this speed in px/ms, however short the drag. */
export const COMMIT_VELOCITY = 0.4;

/** Samples older than this are ignored when measuring release velocity. */
export const VELOCITY_WINDOW_MS = 100;

export function isEdgeStart(clientX) {
  return typeof clientX === 'number' && clientX <= EDGE_START_MAX_X;
}

/**
 * Has the gesture travelled far enough to call it, and is it ours?
 *
 * 'pending'   — not enough movement to judge yet
 * 'claimed'   — horizontal; this is a back swipe
 * 'abandoned' — vertical or diagonal; hand it back to the page, for good.
 *               Once abandoned a gesture is never reclaimed on the same
 *               pointer, otherwise a diagonal scroll turns into a
 *               navigation the moment it straightens out.
 */
export function resolveDirectionLock(dx, dy) {
  const travelled = Math.max(Math.abs(dx), Math.abs(dy));
  if (travelled < DIRECTION_LOCK_DISTANCE) return 'pending';
  return Math.abs(dx) > Math.abs(dy) * DIRECTION_LOCK_RATIO ? 'claimed' : 'abandoned';
}

/**
 * Why this gesture must not run, or null if it may.
 *
 * Kept separate from the DOM walk that produces these flags so each
 * condition is testable on its own.
 */
export function abortReason({
  startX,
  keyboardHeight = 0,
  isFormField = false,
  inNoSwipeRegion = false,
  inHorizontalScroller = false,
} = {}) {
  if (!isEdgeStart(startX)) return 'not-edge';
  // A drag while the keyboard is up is almost always someone reaching for
  // a field or dismissing the keyboard, never a navigation.
  if (keyboardHeight > 0) return 'keyboard-open';
  if (isFormField) return 'form-field';
  if (inNoSwipeRegion) return 'no-swipe-region';
  if (inHorizontalScroller) return 'horizontal-scroller';
  return null;
}

/** Horizontal travel, clamped: dragging back past the origin is not negative progress. */
export function clampDx(dx) {
  return dx > 0 ? dx : 0;
}

/**
 * Release velocity in px/ms, measured over the last VELOCITY_WINDOW_MS.
 *
 * A whole-gesture average would under-report a slow drag that ends in a
 * flick, which is exactly the gesture people make when they mean it.
 */
export function velocityFrom(samples) {
  if (!Array.isArray(samples) || samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = samples[0];
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    if (last.t - samples[i].t > VELOCITY_WINDOW_MS) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  // Clamped, so a leftward flick at the end of a drag reads as zero speed
  // rather than as a fast commit in the wrong direction.
  return clampDx(last.x - first.x) / dt;
}

/**
 * The whole decision: commit the navigation, or spring back.
 *
 * @param {{
 *   samples?: Array<{x:number,y:number,t:number}>,
 *   viewportWidth?: number,
 *   abort?: string|null,
 * }} input
 * @returns {'commit'|'cancel'}
 */
export function decideSwipe({ samples = [], viewportWidth = 0, abort = null } = {}) {
  if (abort) return 'cancel';
  if (!Array.isArray(samples) || samples.length < 2) return 'cancel';

  const first = samples[0];
  const last = samples[samples.length - 1];
  const dx = clampDx(last.x - first.x);
  const dy = last.y - first.y;

  if (resolveDirectionLock(dx, dy) !== 'claimed') return 'cancel';
  if (viewportWidth > 0 && dx > viewportWidth * COMMIT_DISTANCE_FRACTION) return 'commit';
  if (velocityFrom(samples) > COMMIT_VELOCITY) return 'commit';
  return 'cancel';
}
