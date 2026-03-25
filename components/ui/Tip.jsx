'use client';

import React from 'react';

function Tip({ text, children, position }) {
  if (!text) return children;
  const cls = position === 'bottom' ? 'tooltip-wrap tooltip-bottom' : 'tooltip-wrap';
  return (
    <span className={cls}>
      {children}
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

export default Tip;
