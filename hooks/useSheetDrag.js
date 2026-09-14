// hooks/useSheetDrag.js
//
// Swipe-down-to-dismiss for bottom sheets. Edge-swipe is the wrong idiom
// here — iOS dismisses a sheet with a downward drag, and a sheet covers the
// left edge anyway.
//
// Two rules keep it from fighting the content:
//
//   • The drag region is the grabber and the header row, not the whole
//     sheet. Dragging the body is scrolling.
//   • It only engages when the scrollable body is already at scrollTop 0,
//     so a half-scrolled list never dismisses when you meant to scroll up.
//
// Returns props to spread on the drag handle, plus refs for the sheet and
// its backdrop, which are transformed directly rather than through state —
// a re-render per frame would make this worse than not having it.

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { impact } from '@/lib/capacitor';
import { TOUCH_GESTURES_ENABLED } from '@/lib/platform';

/** Fraction of sheet height past which release dismisses. */
export const SHEET_DISMISS_FRACTION = 0.25;

/** Or a downward flick faster than this, in px/ms. */
export const SHEET_DISMISS_VELOCITY = 0.5;

const SETTLE_MS = 220;
const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

function reducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * @param {{ enabled?: boolean, onDismiss?: () => void }} options
 */
export default function useSheetDrag({ enabled: enabledByCaller = true, onDismiss } = {}) {
  // Gated by the master switch as well as the caller's own condition — see
  // TOUCH_GESTURES_ENABLED in lib/platform.js. Every caller passes
  // `enabled: isMobileViewport`, so a default alone would not turn this off.
  // The refs are returned either way: the sheet, backdrop and scroll
  // container are laid out through them whether or not it can be dragged.
  const enabled = TOUCH_GESTURES_ENABLED && enabledByCaller;
  const sheetRef = useRef(null);
  const backdropRef = useRef(null);
  const scrollRef = useRef(null);
  const drag = useRef(null);

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const paint = useCallback((dy, { animate = false } = {}) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const height = sheet.offsetHeight || 1;
    const progress = Math.min(1, Math.max(0, dy / height));
    const transition = animate
      ? `transform ${SETTLE_MS}ms ${EASING}, opacity ${SETTLE_MS}ms ${EASING}`
      : '';

    sheet.style.transition = transition;
    sheet.style.transform = dy > 0 ? `translate3d(0, ${dy}px, 0)` : '';

    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.style.transition = transition;
      backdrop.style.opacity = String(1 - progress);
    }
  }, []);

  const reset = useCallback(() => {
    const sheet = sheetRef.current;
    if (sheet) {
      sheet.style.transition = '';
      sheet.style.transform = '';
      sheet.style.willChange = '';
    }
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.style.transition = '';
      backdrop.style.opacity = '';
    }
    drag.current = null;
  }, []);

  const onPointerDown = useCallback((e) => {
    if (!enabled || e.pointerType === 'mouse' || !e.isPrimary) return;
    // Never start a dismissal from a half-scrolled body.
    if (scrollRef.current && scrollRef.current.scrollTop > 0) return;

    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      startX: e.clientX,
      samples: [{ y: e.clientY, t: e.timeStamp }],
      claimed: false,
    };
    if (sheetRef.current) sheetRef.current.style.willChange = 'transform';
  }, [enabled]);

  const onPointerMove = useCallback((e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;

    const dy = e.clientY - d.startY;
    const dx = e.clientX - d.startX;
    d.samples.push({ y: e.clientY, t: e.timeStamp });
    if (d.samples.length > 16) d.samples.shift();

    if (!d.claimed) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      // Downward and more vertical than horizontal, or it is not ours.
      if (dy <= 0 || Math.abs(dy) <= Math.abs(dx)) {
        drag.current = null;
        return;
      }
      d.claimed = true;
      // Capture only now. Capturing on pointerdown would retarget the
      // click, and the header row this is spread across holds real buttons
      // (the setlist editor alone has eight) that must still be tappable.
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Capture is an optimisation, not a requirement.
      }
    }

    if (reducedMotion()) return;
    // Resist upward travel rather than letting the sheet fly off the top.
    paint(dy > 0 ? dy : dy * 0.15);
  }, [paint]);

  const finish = useCallback((e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    if (!d.claimed) {
      reset();
      return;
    }

    const dy = Math.max(0, e.clientY - d.startY);
    const sheet = sheetRef.current;
    const height = sheet?.offsetHeight || 1;

    const recent = d.samples[Math.max(0, d.samples.length - 5)];
    const last = d.samples[d.samples.length - 1];
    const dt = last.t - recent.t;
    const velocity = dt > 0 ? (last.y - recent.y) / dt : 0;

    const dismiss = dy > height * SHEET_DISMISS_FRACTION || velocity > SHEET_DISMISS_VELOCITY;

    if (!dismiss) {
      paint(0, { animate: true });
      window.setTimeout(reset, SETTLE_MS);
      return;
    }

    impact('light');
    if (reducedMotion() || !sheet) {
      reset();
      onDismissRef.current?.();
      return;
    }
    paint(height, { animate: true });
    window.setTimeout(() => {
      reset();
      onDismissRef.current?.();
    }, SETTLE_MS);
  }, [paint, reset]);

  // Clean up if the sheet unmounts mid-drag.
  useEffect(() => reset, [reset]);

  return {
    sheetRef,
    backdropRef,
    scrollRef,
    /** Spread on the grabber + header row. */
    dragHandleProps: enabled
      ? {
        onPointerDown,
        onPointerMove,
        onPointerUp: finish,
        onPointerCancel: finish,
        style: { touchAction: 'none' },
      }
      : {},
  };
}
