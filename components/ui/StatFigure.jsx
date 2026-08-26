// components/ui/StatFigure.jsx
//
// Single stat numeral + label, no box chrome of its own. Extracted from
// ProfileHero so any page can reuse the same value/label typography.
//
//   <StatFigure value={87} label="Shows" />

import React from 'react';

export default function StatFigure({ value, label, className = '' }) {
  return (
    <div className={className}>
      <div className="text-[22px] font-extrabold tracking-[-0.02em]">{value}</div>
      <div className="text-[11px] text-muted font-semibold tracking-[0.08em] uppercase">{label}</div>
    </div>
  );
}
