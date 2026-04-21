// components/ui/StatTile.jsx
//
// Single big-number stat. Mixed in with Cards — drop-in for any page.
// Optional delta + trend (up/down/flat) for when you're comparing periods.
//
//   <StatTile value="87" label="Shows this year" />
//   <StatTile value="3.2" unit="M" label="Shows indexed" tone="brand" />
//   <StatTile value="12" label="This month" delta="+3" trend="up" />

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const TONES = {
  default: 'text-primary',
  brand:   'text-brand',
  amber:   'text-amber',
};

const TREND = {
  up:   { icon: TrendingUp,   cls: 'text-brand bg-brand-subtle' },
  down: { icon: TrendingDown, cls: 'text-danger bg-[#fdecec]' },
  flat: { icon: Minus,        cls: 'text-muted bg-hover' },
};

export default function StatTile({
  value,
  unit,
  label,
  delta,
  trend = 'up',
  tone = 'default',
  className = '',
}) {
  const TrendIcon = TREND[trend]?.icon;

  return (
    <div
      className={`bg-surface border border-subtle rounded-2xl p-5 md:p-6 ${className}`}
    >
      <div className="flex items-baseline gap-1">
        <div className={`text-[40px] md:text-[48px] font-extrabold leading-none tracking-[-0.03em] ${TONES[tone]}`}>
          {value}
        </div>
        {unit && (
          <div className="text-[22px] md:text-[26px] font-extrabold text-brand leading-none">
            {unit}
          </div>
        )}
      </div>
      <div className="text-[13px] text-secondary font-medium mt-2">{label}</div>
      {delta && (
        <div className={`inline-flex items-center gap-1 mt-3 text-[11px] font-bold px-2 py-0.5 rounded-md ${TREND[trend].cls}`}>
          {TrendIcon && <TrendIcon size={11} strokeWidth={2.6} />}
          {delta}
        </div>
      )}
    </div>
  );
}
