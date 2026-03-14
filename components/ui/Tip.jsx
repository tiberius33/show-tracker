'use client';

import React from 'react';

function Tip({ text, children }) {
  if (!text) return children;
  return (
    <span className="tooltip-wrap">
      {children}
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

export default Tip;
