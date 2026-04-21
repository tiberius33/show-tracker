// components/ui/Tooltip.jsx
//
// Piggybacks on globals.css `.tooltip-wrap` / `.tooltip-text` classes already
// in your stylesheet — so it stays visually identical to existing tooltips.
//
//   <Tooltip text="Sort by date"><button>…</button></Tooltip>

import React from 'react';

export default function Tooltip({ text, children, position = 'top', className = '' }) {
  return (
    <span className={`tooltip-wrap ${position === 'bottom' ? 'tooltip-bottom' : ''} ${className}`}>
      {children}
      <span className="tooltip-text" role="tooltip">{text}</span>
    </span>
  );
}
