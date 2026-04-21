// components/ui/RatingStars.jsx
//
// Five-star rating. Works read-only (display) or interactive.
//
//   <RatingStars value={4.8} />
//   <RatingStars value={rating} onChange={setRating} />

import React, { useState } from 'react';
import { Star } from 'lucide-react';

export default function RatingStars({
  value = 0,
  onChange,
  size = 18,
  className = '',
  showValue = false,
}) {
  const [hover, setHover] = useState(null);
  const interactive = !!onChange;
  const display = hover ?? value;

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <div className="flex" role={interactive ? 'radiogroup' : 'img'} aria-label={`Rating: ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = display >= n;
          const half = !filled && display >= n - 0.5;
          return (
            <button
              key={n}
              type="button"
              disabled={!interactive}
              onMouseEnter={interactive ? () => setHover(n) : undefined}
              onMouseLeave={interactive ? () => setHover(null) : undefined}
              onClick={interactive ? () => onChange(n) : undefined}
              className={`p-0.5 ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
            >
              <Star
                size={size}
                className={filled || half ? 'text-amber' : 'text-[#e0e4ec]'}
                fill={filled ? 'currentColor' : half ? 'url(#half-star)' : 'transparent'}
                strokeWidth={1.8}
              />
            </button>
          );
        })}
      </div>
      {showValue && value > 0 && (
        <span className="text-sm font-bold text-primary ml-1">{value.toFixed(1)}</span>
      )}
      {/* Half-star gradient. Inlined once per component. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="half-star" x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
