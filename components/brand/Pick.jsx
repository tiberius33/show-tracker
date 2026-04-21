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
      {/* Pick body — green gradient */}
      <defs>
        <linearGradient id="mys-pick-g" x1="20" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd99a" />
          <stop offset="1" stopColor="#4bc86a" />
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
