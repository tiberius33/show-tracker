'use client';

import React from 'react';

function RatingSelect({ value, onChange, max = 10, label }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs font-medium text-secondary">{label}</span>}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        onClick={(e) => e.stopPropagation()}
        className="px-2.5 py-1.5 bg-highlight border border-subtle rounded-lg text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-amber/50 cursor-pointer"
      >
        <option value="" className="bg-elevated">--</option>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <option key={n} value={n} className="bg-elevated">{n}</option>
        ))}
      </select>
      {value && (
        <span className="text-sm font-semibold text-accent-amber">{value}/10</span>
      )}
    </div>
  );
}

export default RatingSelect;
