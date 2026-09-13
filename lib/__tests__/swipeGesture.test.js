/**
 * Unit tests for lib/swipeGesture.js — the decidable half of the
 * edge-swipe-back gesture.
 *
 * WHY THESE EXIST. Playwright cannot drive a native-feeling pointer
 * gesture, so the parts that can actually be got wrong — the two commit
 * thresholds, the direction lock, and every abort condition — are pure
 * functions, and this is where they are pinned. What is left in
 * hooks/useEdgeSwipeBack.js is plumbing that reads events and asks these.
 *
 * The bias throughout is towards CANCEL. A false cancel costs the user a
 * second swipe; a false commit navigates the screen out from under them
 * mid-scroll, which is the failure that makes a gesture feel broken.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/swipeGesture.test.js
 */

import assert from 'assert';
import {
  EDGE_START_MAX_X, DIRECTION_LOCK_DISTANCE, COMMIT_DISTANCE_FRACTION,
  COMMIT_VELOCITY,
  abortReason, clampDx, decideSwipe, isEdgeStart, resolveDirectionLock,
  velocityFrom,
} from '@/lib/swipeGesture';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`✗ ${name}\n  ${err.message}`);
  }
}

/** Build a straight horizontal drag: `distance` px over `ms`, from x=0. */
function drag({ distance, ms, dy = 0, steps = 10, startX = 0 }) {
  const samples = [];
  for (let i = 0; i <= steps; i += 1) {
    samples.push({
      x: startX + (distance * i) / steps,
      y: (dy * i) / steps,
      t: (ms * i) / steps,
    });
  }
  return samples;
}

const WIDTH = 390; // iPhone 14 logical width; 35% of it is 136.5px

// ── The edge ──────────────────────────────────────────────────────────

test('a touch within 24px of the left edge starts the gesture', () => {
  assert.strictEqual(isEdgeStart(0), true);
  assert.strictEqual(isEdgeStart(EDGE_START_MAX_X), true);
});

test('a touch past the edge zone does not', () => {
  assert.strictEqual(isEdgeStart(EDGE_START_MAX_X + 1), false);
  assert.strictEqual(isEdgeStart(200), false);
});

test('a missing coordinate is not an edge start', () => {
  // Guards against an event with no clientX silently arming the gesture.
  assert.strictEqual(isEdgeStart(undefined), false);
  assert.strictEqual(isEdgeStart(null), false);
});

// ── The direction lock ────────────────────────────────────────────────

test('below the lock distance the gesture is still undecided', () => {
  assert.strictEqual(resolveDirectionLock(5, 2), 'pending');
  assert.strictEqual(resolveDirectionLock(DIRECTION_LOCK_DISTANCE - 1, 0), 'pending');
});

test('a horizontal drag is claimed', () => {
  assert.strictEqual(resolveDirectionLock(40, 5), 'claimed');
});

test('a vertical drag is abandoned, not merely paused', () => {
  // This is the scroll case: the page must keep it, permanently.
  assert.strictEqual(resolveDirectionLock(5, 40), 'abandoned');
});

test('a diagonal drag inside the 1.5x ratio is abandoned', () => {
  // dx must beat dy by 1.5x. 30 vs 25 does not, so a sloppy scroll that
  // drifts sideways never becomes a navigation.
  assert.strictEqual(resolveDirectionLock(30, 25), 'abandoned');
  // 40 vs 25 does (40 > 37.5).
  assert.strictEqual(resolveDirectionLock(40, 25), 'claimed');
});

test('the ratio is applied on the magnitude, so upward drift behaves like downward', () => {
  assert.strictEqual(resolveDirectionLock(30, -25), 'abandoned');
  assert.strictEqual(resolveDirectionLock(40, -25), 'claimed');
});

// ── Clamping ──────────────────────────────────────────────────────────

test('leftward travel clamps to zero rather than going negative', () => {
  assert.strictEqual(clampDx(-50), 0);
  assert.strictEqual(clampDx(0), 0);
  assert.strictEqual(clampDx(12), 12);
});

// ── Velocity ──────────────────────────────────────────────────────────

test('velocity is zero without at least two samples', () => {
  assert.strictEqual(velocityFrom([]), 0);
  assert.strictEqual(velocityFrom([{ x: 0, y: 0, t: 0 }]), 0);
  assert.strictEqual(velocityFrom(null), 0);
});

test('velocity is zero when no time passed, rather than infinite', () => {
  assert.strictEqual(velocityFrom([{ x: 0, t: 5 }, { x: 80, t: 5 }]), 0);
});

test('velocity is measured over the tail, so a slow drag ending in a flick is fast', () => {
  // 20px over the first 400ms (0.05 px/ms), then 60px in the last 60ms
  // (1.0 px/ms). A whole-gesture average would report ~0.17 and cancel.
  const samples = [
    { x: 0, t: 0 }, { x: 10, t: 200 }, { x: 20, t: 400 },
    { x: 50, t: 430 }, { x: 80, t: 460 },
  ];
  assert.ok(velocityFrom(samples) > COMMIT_VELOCITY, 'tail flick should read as fast');
});

test('a leftward flick at the end of a drag reads as zero speed, not fast', () => {
  const samples = [{ x: 100, t: 0 }, { x: 60, t: 30 }, { x: 20, t: 60 }];
  assert.strictEqual(velocityFrom(samples), 0);
});

// ── The distance threshold ────────────────────────────────────────────

test('past 35% of viewport width, a slow drag still commits', () => {
  const distance = WIDTH * COMMIT_DISTANCE_FRACTION + 10; // ~146px
  const samples = drag({ distance, ms: 2000 }); // deliberately far too slow to flick
  assert.ok(velocityFrom(samples) < COMMIT_VELOCITY, 'precondition: not a flick');
  assert.strictEqual(decideSwipe({ samples, viewportWidth: WIDTH }), 'commit');
});

test('just short of 35%, a slow drag cancels', () => {
  const distance = WIDTH * COMMIT_DISTANCE_FRACTION - 10; // ~127px
  const samples = drag({ distance, ms: 2000 });
  assert.strictEqual(decideSwipe({ samples, viewportWidth: WIDTH }), 'cancel');
});

test('the threshold is a fraction, so it scales with the screen', () => {
  const distance = 150;
  const samples = drag({ distance, ms: 2000 });
  // 150px is past 35% of a 390px phone…
  assert.strictEqual(decideSwipe({ samples, viewportWidth: 390 }), 'commit');
  // …and nowhere near 35% of a 1024px tablet.
  assert.strictEqual(decideSwipe({ samples, viewportWidth: 1024 }), 'cancel');
});

test('a zero viewport width does not commit on distance alone', () => {
  // Guards against a divide-by-nothing making every short drag commit.
  const samples = drag({ distance: 30, ms: 1000 });
  assert.strictEqual(decideSwipe({ samples, viewportWidth: 0 }), 'cancel');
});

// ── The velocity threshold ────────────────────────────────────────────

test('a fast short flick commits even well short of 35%', () => {
  // 60px in 60ms = 1.0 px/ms, against a 136px distance threshold.
  const samples = drag({ distance: 60, ms: 60 });
  assert.ok(60 < WIDTH * COMMIT_DISTANCE_FRACTION, 'precondition: under the distance threshold');
  assert.strictEqual(decideSwipe({ samples, viewportWidth: WIDTH }), 'commit');
});

test('a short drag that is neither far nor fast cancels', () => {
  const samples = drag({ distance: 40, ms: 500 });
  assert.strictEqual(decideSwipe({ samples, viewportWidth: WIDTH }), 'cancel');
});

// ── The direction lock, through decideSwipe ───────────────────────────

test('a long fast VERTICAL drag never commits', () => {
  // The scroll case end-to-end: far enough and fast enough on distance
  // alone, but the lock rejects it.
  const samples = drag({ distance: 20, ms: 60, dy: 300 });
  assert.strictEqual(decideSwipe({ samples, viewportWidth: WIDTH }), 'cancel');
});

test('a long drag that ends back at the origin cancels', () => {
  // Reversing mid-drag has to be a real cancel — this is the "I changed my
  // mind" gesture, and it must not navigate.
  const samples = [
    { x: 0, y: 0, t: 0 }, { x: 100, y: 0, t: 100 },
    { x: 200, y: 0, t: 200 }, { x: 0, y: 0, t: 300 },
  ];
  assert.strictEqual(decideSwipe({ samples, viewportWidth: WIDTH }), 'cancel');
});

test('fewer than two samples cancels', () => {
  assert.strictEqual(decideSwipe({ samples: [], viewportWidth: WIDTH }), 'cancel');
  assert.strictEqual(decideSwipe({ samples: [{ x: 0, y: 0, t: 0 }], viewportWidth: WIDTH }), 'cancel');
});

test('decideSwipe with no arguments at all cancels', () => {
  assert.strictEqual(decideSwipe(), 'cancel');
});

// ── The abort conditions ──────────────────────────────────────────────

test('a clean edge start has no abort reason', () => {
  assert.strictEqual(abortReason({ startX: 10 }), null);
});

test('a start away from the edge aborts', () => {
  assert.strictEqual(abortReason({ startX: 120 }), 'not-edge');
});

test('an open keyboard aborts', () => {
  // A drag with the keyboard up is someone reaching for a field or
  // dismissing the keyboard, never a navigation.
  assert.strictEqual(abortReason({ startX: 5, keyboardHeight: 336 }), 'keyboard-open');
});

test('a text field aborts', () => {
  assert.strictEqual(abortReason({ startX: 5, isFormField: true }), 'form-field');
});

test('a [data-no-swipe] region aborts', () => {
  assert.strictEqual(abortReason({ startX: 5, inNoSwipeRegion: true }), 'no-swipe-region');
});

test('a horizontally scrollable ancestor aborts', () => {
  assert.strictEqual(abortReason({ startX: 5, inHorizontalScroller: true }), 'horizontal-scroller');
});

test('every abort condition is checked, not just the first flag passed', () => {
  // Each one alone must be enough; a regression that only ever consulted
  // one of them would pass a single-flag test.
  const conditions = ['isFormField', 'inNoSwipeRegion', 'inHorizontalScroller'];
  conditions.forEach((flag) => {
    assert.notStrictEqual(
      abortReason({ startX: 5, [flag]: true }), null,
      `${flag} alone must abort`,
    );
  });
});

test('an abort beats a textbook committing drag', () => {
  // The abort is authoritative: a perfect swipe inside a carousel is still
  // the carousel's gesture.
  const samples = drag({ distance: 300, ms: 100 });
  assert.strictEqual(
    decideSwipe({ samples, viewportWidth: WIDTH, abort: 'horizontal-scroller' }),
    'cancel',
  );
});

// ── Summary ───────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
