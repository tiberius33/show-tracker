// Big gradient hero at the top of a show detail page.
// Use negative top-margin on the content below: className="-mt-20 relative z-10"

import React from 'react';
import Badge from '@/components/ui/Badge';

export default function ShowHero({
  artist,
  venue,
  city,
  dateFull,     // "Mon · Oct 31 · 1994 · Halloween"
  rating,
  badges = [],  // [{ label, tone }]
  height = 320,
}) {
  return (
    <div className="relative rounded-3xl overflow-hidden -mb-20" style={{ height }}>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 30% 30%, rgba(245,166,35,0.70), transparent 55%),' +
            'radial-gradient(ellipse at 70% 70%, rgba(75,200,106,0.55), transparent 55%),' +
            'linear-gradient(135deg, #1e2538 0%, #2a3250 100%)',
        }}
      />
      <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-11 text-white">
        {dateFull && (
          <div className="text-[12px] font-extrabold tracking-[0.12em] uppercase text-amber-light">
            {dateFull}
          </div>
        )}
        <h1 className="text-[44px] md:text-[56px] font-extrabold tracking-[-0.03em] leading-[1] mt-3 mb-1">
          {artist}
        </h1>
        <p className="text-base text-white/75 m-0">
          {venue}{city && ` · ${city}`}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-4">
          {typeof rating === 'number' && (
            <Badge tone="amber" size="md">★ {rating.toFixed(1)}</Badge>
          )}
          {badges.map((b, i) => (
            <Badge key={i} tone={b.tone || 'neutral'} size="md">{b.label}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
