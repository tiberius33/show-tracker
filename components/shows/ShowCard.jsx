// components/shows/ShowCard.jsx
//
// Grid card for the /shows page. Renders a full-image card when artistImage is
// available (MusicBrainz/Wikipedia photo), otherwise falls back to the CSS
// gradient ShowCover design. Always uses onClick — no page navigation.

import React, { useState } from 'react';
import { Trash2, Star } from 'lucide-react';
import ShowCover from './ShowCover';
import Badge from '../ui/Badge';

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function ShowCard({ show, onClick, onDelete }) {
  const {
    id, artist, venue, city,
    date, year, rating, night,
    tags = [],
    variant,
    artistImage,
  } = show;

  const [imgError, setImgError] = useState(false);
  const hasImage = artistImage && !imgError;
  const displayDate = formatDate(date);

  if (hasImage) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
        className="group relative h-64 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl"
      >
        {/* Artist photo background */}
        <img
          src={artistImage}
          alt={artist}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />

        {/* Dark gradient overlay — heavier at bottom for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />

        {/* Content */}
        <div className="relative h-full flex flex-col p-4">
          {/* Top row: date + rating */}
          <div className="flex items-start justify-between">
            {displayDate && (
              <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-orange-400 drop-shadow">
                {displayDate}
              </span>
            )}
            {typeof rating === 'number' && (
              <span className="inline-flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[11px] font-extrabold">
                <Star size={9} fill="currentColor" strokeWidth={0} />
                {rating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom: artist + venue */}
          <div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map((t, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold tracking-wide uppercase bg-black/40 backdrop-blur-sm text-white/90 px-2 py-0.5 rounded-full"
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            )}
            <h3 className="text-[22px] font-extrabold leading-tight text-white drop-shadow-md">
              {artist}
            </h3>
            <p className="text-[12px] text-white/70 mt-0.5 leading-snug line-clamp-1">
              {venue}{city && ` · ${city}`}
            </p>
            {night && (
              <p className="text-[10px] font-bold tracking-wide text-white/50 mt-0.5 uppercase">
                {night}
              </p>
            )}
          </div>
        </div>

        {/* Delete button */}
        {onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            onKeyDown={e => { e.stopPropagation(); }}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-gray-300 hover:text-red-400 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all"
            title="Delete show"
            aria-label="Delete show"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Fallback: gradient ShowCover + text below
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      className="group relative block bg-surface border border-subtle rounded-2xl overflow-hidden transition-all duration-150 hover:border-active hover:-translate-y-0.5 hover:shadow-theme-md cursor-pointer"
    >
      <ShowCover
        variant={variant}
        seed={id}
        date={date}
        year={year}
        rating={rating}
        night={night}
        rounded="rounded-none"
      />
      <div className="p-4">
        <h3 className="text-[16px] font-extrabold tracking-[-0.01em] text-primary">{artist}</h3>
        <p className="text-[12px] text-secondary mt-1 leading-snug line-clamp-2">
          {venue}{city && ` · ${city}`}
        </p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {tags.map((t, i) => (
              <Badge key={i} tone={t.tone || 'neutral'} size="sm">{t.label}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          onKeyDown={e => { e.stopPropagation(); }}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-gray-300 hover:text-red-400 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete show"
          aria-label="Delete show"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
