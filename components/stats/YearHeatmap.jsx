// components/stats/YearHeatmap.jsx
//
// 12-month heatmap of shows-per-month. Auto-buckets counts into 4 heat levels.
//
//   <YearHeatmap counts={[3, 4, 7, 5, 11, 14, 8, 9, 8, 6, 6, 3]} year={2024} />

import React from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function level(n, max) {
  if (n <= 0) return 0;
  if (max <= 0) return 1;
  const pct = n / max;
  if (pct >= 0.85) return 4; // hot
  if (pct >= 0.6)  return 3; // warm
  if (pct >= 0.35) return 2; // cool
  return 1;                  // mild
}

const LEVEL_CLS = {
  0: 'bg-hover text-muted',
  1: 'bg-brand-subtle text-[#2a8a47]',
  2: 'bg-brand-light text-white',
  3: 'bg-brand text-white',
  4: 'bg-[#225732] text-white',
};

export default function YearHeatmap({ counts = [], year, className = '' }) {
  const max = Math.max(1, ...counts);
  return (
    <div className={className}>
      <div className="grid grid-cols-12 gap-[3px] mb-2">
        {MONTHS.map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded flex items-center justify-center text-[10px] font-extrabold ${LEVEL_CLS[level(counts[i] || 0, max)]}`}
          >
            {counts[i] || 0}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 text-[10px] font-bold text-muted tracking-[0.1em] uppercase text-center">
        {MONTHS.map((m) => <span key={m}>{m}</span>)}
      </div>
      {year && (
        <div className="mt-3 text-[11px] text-muted font-semibold">
          {year} · {counts.reduce((a, b) => a + b, 0)} shows
        </div>
      )}
    </div>
  );
}
