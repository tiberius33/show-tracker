// Gradient cover artwork for a show. Six deterministic variants via seed string.
//
//   <ShowCover seed={show.id} date="Oct 31" year={1994} rating={4.8} night="Halloween" />

import React from 'react';
import { Star } from 'lucide-react';

const VARIANTS = [
  // 0 — amber/green
  {
    a: 'radial-gradient(ellipse at 25% 20%, rgba(245,166,35,0.50), transparent 60%)',
    b: 'radial-gradient(ellipse at 75% 80%, rgba(75,200,106,0.55), transparent 60%)',
  },
  // 1 — green/blue
  {
    a: 'radial-gradient(ellipse at 30% 30%, rgba(125,217,154,0.55), transparent 60%)',
    b: 'radial-gradient(ellipse at 80% 70%, rgba(100,140,255,0.40), transparent 60%)',
  },
  // 2 — red/gold
  {
    a: 'radial-gradient(ellipse at 20% 70%, rgba(224,85,85,0.50), transparent 60%)',
    b: 'radial-gradient(ellipse at 80% 20%, rgba(251,191,90,0.50), transparent 60%)',
  },
  // 3 — purple/blue
  {
    a: 'radial-gradient(ellipse at 30% 60%, rgba(167,139,250,0.55), transparent 60%)',
    b: 'radial-gradient(ellipse at 70% 30%, rgba(96,165,250,0.50), transparent 60%)',
  },
  // 4 — amber/red (sunset)
  {
    a: 'radial-gradient(ellipse at 50% 20%, rgba(245,166,35,0.60), transparent 60%)',
    b: 'radial-gradient(ellipse at 30% 80%, rgba(224,85,85,0.45), transparent 60%)',
  },
  // 5 — green/amber
  {
    a: 'radial-gradient(ellipse at 65% 35%, rgba(75,200,106,0.55), transparent 60%)',
    b: 'radial-gradient(ellipse at 30% 65%, rgba(245,166,35,0.40), transparent 55%)',
  },
];

function variantFor(key) {
  let h = 0;
  for (let i = 0; i < (key || '').length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % VARIANTS.length;
}

export default function ShowCover({
  variant,
  seed,
  date,
  year,
  rating,
  night,
  aspectRatio = '16 / 10',
  rounded = 'rounded-t-2xl',
  className = '',
}) {
  const v = VARIANTS[variant ?? variantFor(seed || '')];
  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{ aspectRatio, background: 'linear-gradient(135deg, #1e2538 0%, #2a3250 100%)' }}
    >
      <div className="absolute inset-0" style={{ background: `${v.a}, ${v.b}` }} />
      {(date || year) && (
        <div className="absolute top-3 left-4 text-[10px] font-extrabold tracking-[0.1em] uppercase text-amber-light">
          {date}{date && year && ' · '}{year}
        </div>
      )}
      {typeof rating === 'number' && (
        <div className="absolute top-3 right-4 inline-flex items-center gap-1 bg-black/45 backdrop-blur text-white px-2 py-0.5 rounded-full text-[11px] font-extrabold">
          <Star size={10} fill="currentColor" strokeWidth={0} />
          {rating.toFixed(1)}
        </div>
      )}
      {night && (
        <div className="absolute bottom-3 right-4 text-[10px] font-bold tracking-wide text-white/80">
          {night}
        </div>
      )}
    </div>
  );
}
