'use client';

import React from 'react';

function RatingSelect({ value, onChange, max = 10, label }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs font-medium text-white/50">{label}</span>}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        onClick={(e) => e.stopPropagation()}
        className="px-2.5 py-1.5 bg-white/10 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
      >
        <option value="" className="bg-slate-800">--</option>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <option key={n} value={n} className="bg-slate-800">{n}</option>
        ))}
      </select>
      {value && (
        <span className="text-sm font-semibold text-emerald-400">{value}/10</span>
      )}
    </div>
  );
}

export default RatingSelect;
