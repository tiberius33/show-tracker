// components/layout/SwipeBackLayer.jsx
//
// The interactive half of the back gesture: the content follows the finger,
// an iOS-style parallax shim trails behind it, and reversing mid-drag
// cancels. That interactivity is the whole point — a gesture that just
// fires router.back() on release still reads as clunky, and being able to
// back out of it mid-drag is what makes it feel trustworthy rather than
// like a trap.
//
// transform and opacity only, so every frame stays on the compositor.
//
// Mounted only on small screens, and only where the gesture is enabled
// (see lib/platform.js): on desktop and tablet this renders its children
// and nothing else — no listeners, no wrapper, no cost.

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useEdgeSwipeBack from '@/hooks/useEdgeSwipeBack';
import useIsMobile from '@/hooks/useIsMobile';
import { useDismissStack } from '@/context/DismissStackContext';
import { isEdgeSwipeBackEnabled } from '@/lib/platform';
import { impact } from '@/lib/capacitor';

const COMMIT_MS = 250;
const COMMIT_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SHIM_TRAVEL = 30; // % of viewport the layer behind starts offset by
const SHIM_DIM = 0.25;  // backdrop opacity at rest

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export default function SwipeBackLayer({ children }) {
  const isMobile = useIsMobile();
  const enabled = isMobile && isEdgeSwipeBackEnabled(isMobile);

  const router = useRouter();
  const { popTop, depth, canGoBack } = useDismissStack();

  const contentRef = useRef(null);
  const shimRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // Read at pointerup, where a stale closure would decide against the wrong
  // state — so the live values go in a ref rather than through the closure.
  const stateRef = useRef({ depth, canGoBack });
  stateRef.current = { depth, canGoBack };

  const paint = useCallback((dx, { animate = false } = {}) => {
    const content = contentRef.current;
    const shim = shimRef.current;
    if (!content) return;

    const width = window.innerWidth || 1;
    const progress = Math.min(1, Math.max(0, dx / width));
    const transition = animate ? `transform ${COMMIT_MS}ms ${COMMIT_EASING}, opacity ${COMMIT_MS}ms ${COMMIT_EASING}` : '';

    content.style.transition = transition;
    content.style.transform = dx ? `translate3d(${dx}px, 0, 0)` : '';

    if (shim) {
      shim.style.transition = transition;
      // Trails at a third of the content's speed, the parallax iOS uses.
      shim.style.transform = `translate3d(${-SHIM_TRAVEL + SHIM_TRAVEL * progress}%, 0, 0)`;
      shim.style.opacity = String(SHIM_DIM * (1 - progress));
    }
  }, []);

  const reset = useCallback(() => {
    const content = contentRef.current;
    const shim = shimRef.current;
    if (content) {
      content.style.transition = '';
      content.style.transform = '';
      content.style.willChange = '';
    }
    if (shim) {
      shim.style.transition = '';
      shim.style.transform = '';
      shim.style.opacity = '0';
    }
    setDragging(false);
  }, []);

  /**
   * What a committed swipe actually does, in order:
   *   1. an overlay is open  → close the topmost one
   *   2. we have in-app history → go back
   *   3. neither → nothing. No dead-end swipes off the app.
   */
  const performBack = useCallback(() => {
    const { depth: overlayDepth, canGoBack: hasHistory } = stateRef.current;
    if (overlayDepth > 0) return popTop();
    if (hasHistory) {
      router.back();
      return true;
    }
    return false;
  }, [popTop, router]);

  const handleStart = useCallback(() => {
    // Nothing to go back to and nothing open — let the drag rubber-band
    // rather than pretending it will do something.
    const { depth: overlayDepth, canGoBack: hasHistory } = stateRef.current;
    if (overlayDepth === 0 && !hasHistory) return;
    setDragging(true);
    if (contentRef.current) contentRef.current.style.willChange = 'transform';
  }, []);

  const handleProgress = useCallback((dx) => {
    if (prefersReducedMotion()) return;
    const { depth: overlayDepth, canGoBack: hasHistory } = stateRef.current;
    // Rubber-band at a floor: the gesture is felt, but it goes nowhere.
    const travel = overlayDepth === 0 && !hasHistory ? dx * 0.25 : dx;
    paint(travel);
  }, [paint]);

  const handleCommit = useCallback(() => {
    const { depth: overlayDepth, canGoBack: hasHistory } = stateRef.current;
    if (overlayDepth === 0 && !hasHistory) {
      reset();
      return;
    }

    impact('light');

    if (prefersReducedMotion() || !contentRef.current) {
      performBack();
      reset();
      return;
    }

    // Animate out, then act — acting first would swap the content underneath
    // the animation and show the new screen sliding away.
    paint(window.innerWidth, { animate: true });
    window.setTimeout(() => {
      performBack();
      reset();
    }, COMMIT_MS);
  }, [paint, performBack, reset]);

  const handleCancel = useCallback(() => {
    if (prefersReducedMotion()) {
      reset();
      return;
    }
    paint(0, { animate: true });
    window.setTimeout(reset, COMMIT_MS);
  }, [paint, reset]);

  useEdgeSwipeBack({
    enabled,
    onStart: handleStart,
    onProgress: handleProgress,
    onCommit: handleCommit,
    onCancel: handleCancel,
  });

  // Leave no inline styles behind if the gesture stops being enabled
  // mid-session (rotating a tablet across the breakpoint, say).
  useEffect(() => {
    if (!enabled) reset();
  }, [enabled, reset]);

  if (!enabled) return children;

  return (
    <>
      {/* The screen "behind" the current one. Purely decorative: it is a
          dimmed shim, not a render of the previous route — rendering the
          real previous screen would mean keeping it mounted for every
          route in the app, at a cost far beyond what a 250ms transition
          is worth. */}
      <div
        ref={shimRef}
        aria-hidden="true"
        className="md:hidden fixed inset-0 z-[100] pointer-events-none bg-black"
        style={{ opacity: 0, transform: `translate3d(${-SHIM_TRAVEL}%, 0, 0)` }}
      />
      <div
        ref={contentRef}
        data-swipe-content
        // pan-y hands vertical scrolling back to the browser while claiming
        // the horizontal axis, instead of calling preventDefault and
        // fighting for both.
        //
        // Applied only while a gesture is actually claimed, NOT permanently.
        // touch-action is intersected down the ancestor chain, so a standing
        // `pan-y` on this wrapper would disable horizontal panning for
        // everything inside it — the Tabs strip, the /stats period chips and
        // every other horizontal scroller in the app — and a descendant
        // cannot opt back in. Since the recognizer already aborts inside a
        // genuinely scrollable horizontal region, at-rest scrolling is
        // untouched, and the page has no horizontal overflow of its own for
        // the drag to scroll.
        style={{ touchAction: dragging ? 'pan-y' : undefined }}
      >
        {children}
      </div>
    </>
  );
}
