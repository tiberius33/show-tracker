// hooks/useEdgeSwipeBack.js
//
// Pointer Events, not touch events: one code path covers touch, pen and a
// trackpad, and pointer capture gives us the gesture even when the finger
// leaves the element it started on.
//
// The gesture never calls preventDefault. Instead the content wrapper gets
// `touch-action: pan-y`, which tells the browser up front that horizontal
// panning is ours and vertical scrolling is still the page's — no fighting
// the compositor for a scroll that was never in question.
//
// Everything decidable lives in lib/swipeGesture.js; this hook reads
// events and the DOM and asks that module.

'use client';

import { useEffect, useRef } from 'react';
import {
  abortReason, decideSwipe, isEdgeStart, resolveDirectionLock, clampDx,
} from '@/lib/swipeGesture';

const FORM_FIELD_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/** How much of the layout viewport the on-screen keyboard covers, in px. */
function currentKeyboardHeight() {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--keyboard-height');
    const px = parseFloat(raw);
    return Number.isFinite(px) ? px : 0;
  } catch {
    return 0;
  }
}

/**
 * Is this element, or an ancestor, something the gesture must not steal from?
 *
 * A horizontal scroller only counts when it can *actually* scroll
 * horizontally — `overflow-x: auto` on a strip narrow enough to fit is not
 * a reason to disable back, and several of this app's chip strips are
 * exactly that on a wide phone.
 */
function gestureBlockers(target) {
  const result = { isFormField: false, inNoSwipeRegion: false, inHorizontalScroller: false };
  if (!target || typeof target.closest !== 'function') return result;

  if (target.closest(FORM_FIELD_SELECTOR)) result.isFormField = true;
  if (target.closest('[data-no-swipe]')) result.inNoSwipeRegion = true;

  let node = target;
  while (node && node !== document.body && node.nodeType === 1) {
    if (node.scrollWidth > node.clientWidth) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') {
        result.inHorizontalScroller = true;
        break;
      }
    }
    node = node.parentElement;
  }
  return result;
}

/**
 * @param {{
 *   enabled?: boolean,
 *   onStart?: () => void,
 *   onProgress?: (dx: number) => void,
 *   onCommit?: () => void,
 *   onCancel?: () => void,
 * }} options
 */
export default function useEdgeSwipeBack({
  enabled = true,
  onStart,
  onProgress,
  onCommit,
  onCancel,
} = {}) {
  // Handlers are read through a ref so re-renders of the consuming
  // component do not tear down and re-attach the listeners mid-gesture.
  const handlers = useRef({ onStart, onProgress, onCommit, onCancel });
  handlers.current = { onStart, onProgress, onCommit, onCancel };

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    /** @type {null | {id:number, samples:Array, phase:string, abort:string|null}} */
    let gesture = null;

    const finish = (outcome) => {
      if (outcome === 'commit') handlers.current.onCommit?.();
      else handlers.current.onCancel?.();
      gesture = null;
    };

    const onPointerDown = (e) => {
      if (gesture) return;
      // Touch and pen only. A mouse near the left edge is not a back gesture,
      // and claiming it would break text selection on a touchscreen laptop.
      if (e.pointerType === 'mouse') return;
      if (!e.isPrimary) return;
      if (!isEdgeStart(e.clientX)) return;

      const abort = abortReason({
        startX: e.clientX,
        keyboardHeight: currentKeyboardHeight(),
        ...gestureBlockers(e.target),
      });
      if (abort) return;

      gesture = {
        id: e.pointerId,
        samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
        phase: 'pending',
        abort: null,
      };
    };

    const onPointerMove = (e) => {
      if (!gesture || e.pointerId !== gesture.id) return;

      gesture.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      // Keep the buffer short — only the tail matters for velocity.
      if (gesture.samples.length > 24) gesture.samples.splice(0, gesture.samples.length - 24);

      const first = gesture.samples[0];
      const dx = e.clientX - first.x;
      const dy = e.clientY - first.y;

      if (gesture.phase === 'pending') {
        const lock = resolveDirectionLock(dx, dy);
        if (lock === 'pending') return;
        if (lock === 'abandoned') {
          // Abandoned for good on this pointer — no onCancel, because
          // nothing was ever claimed and nothing was moved.
          gesture = null;
          return;
        }
        gesture.phase = 'claimed';
        handlers.current.onStart?.();
      }

      handlers.current.onProgress?.(clampDx(dx));
    };

    const onPointerUp = (e) => {
      if (!gesture || e.pointerId !== gesture.id) return;
      if (gesture.phase !== 'claimed') {
        gesture = null;
        return;
      }
      gesture.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      finish(decideSwipe({
        samples: gesture.samples,
        viewportWidth: window.innerWidth,
      }));
    };

    const onPointerCancel = (e) => {
      if (!gesture || e.pointerId !== gesture.id) return;
      const claimed = gesture.phase === 'claimed';
      gesture = null;
      if (claimed) handlers.current.onCancel?.();
    };

    // Capture phase, so a stopPropagation deeper in the tree cannot silently
    // disable navigation for a whole screen.
    const opts = { passive: true, capture: true };
    window.addEventListener('pointerdown', onPointerDown, opts);
    window.addEventListener('pointermove', onPointerMove, opts);
    window.addEventListener('pointerup', onPointerUp, opts);
    window.addEventListener('pointercancel', onPointerCancel, opts);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, opts);
      window.removeEventListener('pointermove', onPointerMove, opts);
      window.removeEventListener('pointerup', onPointerUp, opts);
      window.removeEventListener('pointercancel', onPointerCancel, opts);
    };
  }, [enabled]);
}
