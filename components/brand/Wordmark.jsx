// "my · setlists · .net" lockup. Use `inverse` on dark backgrounds.

import React from 'react';

export default function Wordmark({ size = 18, inverse = false, showTld = false, className = '' }) {
  const prefix = inverse ? 'text-on-dark' : 'text-primary';
  const muted = inverse ? 'text-on-dark-muted' : 'text-muted';
  return (
    <span
      className={`inline-flex items-baseline font-extrabold tracking-[-0.02em] leading-none ${className}`}
      style={{ fontSize: size }}
      aria-label="MySetlists"
    >
      <span className={prefix}>my</span>
      <span className="text-[#f5a623]">setlists</span>
      {showTld && <span className={`${muted} font-bold`} style={{ fontSize: size * 0.75 }}>.net</span>}
    </span>
  );
}
