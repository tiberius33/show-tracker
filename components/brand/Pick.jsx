// components/brand/Pick.jsx
// The guitar-pick + horizontal lines mark. Pair with <Wordmark /> for the full lockup.

import React from 'react';

export default function Pick({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="MySetlists"
    >
      {/* Pick body — brand gold gradient, matches --green-primary / --green-light */}
      {/*
        KNOWN ISSUE: this gradient id is a fixed string, so two <Pick>s on one
        page both declare `mys-pick-g` and every reference resolves to
        whichever is first in document order. The gradient is
        gradientUnits="userSpaceOnUse", so a 32px Pick borrowing a 24px
        Pick's gradient renders a subtly different fill.
        That is what used to happen on every screen: the mobile header
        rendered a 24px Pick above the sidebar's 32px one. Since 5.36.0 the
        header shows a screen title instead of the wordmark on pushed
        routes, so on those the sidebar is alone and now uses its own,
        correctly-scaled gradient — a ~380px difference in a 20x26 box.
        The current rendering is the correct one.
        Fixing it properly (a per-instance id via React's useId) would change
        the logo's rendering slightly on EVERY route, including desktop, so
        it is deliberately not bundled into a navigation change.
      */}
      <defs>
        <linearGradient id="mys-pick-g" x1="20" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--green-light, #ffe45c)" />
          <stop offset="1" stopColor="var(--green-primary, #ffd700)" />
        </linearGradient>
      </defs>
      <path
        d="M20 4c-6.2 0-12 3.6-12 10.2 0 8.8 9.6 20 12 21.8 2.4-1.8 12-13 12-21.8C32 7.6 26.2 4 20 4Z"
        fill="url(#mys-pick-g)"
      />
      {/* Setlist lines */}
      <rect x="12.5" y="13" width="15" height="1.6" rx="0.8" fill="#fff" opacity="0.95" />
      <rect x="12.5" y="17" width="12" height="1.6" rx="0.8" fill="#fff" opacity="0.8" />
      <rect x="12.5" y="21" width="9" height="1.6" rx="0.8" fill="#fff" opacity="0.65" />
    </svg>
  );
}
