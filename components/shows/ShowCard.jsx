import React, { useState } from 'react';
import { Star, Users, Trash2 } from 'lucide-react';
import { parseDate } from '@/lib/utils';

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = parseDate(dateStr);
  if (!d || isNaN(d.getTime()) || d.getFullYear() < 1900) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ShowCard({ show, onClick, onDelete }) {
  const {
    artist, venue, city,
    date, rating,
    tags = [],
    taggedFriends = [],
    artistImage,
  } = show;

  const [imgError, setImgError] = useState(false);
  const hasImage = artistImage && !imgError;
  const displayDate = formatDate(date);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      className="group relative bg-surface border-2 border-subtle rounded-xl overflow-hidden cursor-pointer hover:border-brand hover:shadow-theme-lg transition-all duration-200"
    >
      {/* Artist image banner */}
      {hasImage && (
        <div className="relative h-36 overflow-hidden">
          <img
            src={artistImage}
            alt={artist}
            className="w-full h-full object-cover object-top"
            onError={() => setImgError(true)}
          />
          {/* Subtle bottom fade so image blends into card body */}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface to-transparent" />

          {/* Rating badge overlaid on image */}
          {typeof rating === 'number' && (
            <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 bg-black/70 backdrop-blur-sm text-on-dark px-2.5 py-1 rounded-md text-sm font-semibold">
              <Star className="w-3.5 h-3.5 fill-current" strokeWidth={0} />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
      )}

      {/* Card body */}
      <div className="p-5">
        {/* Header: date + rating (when no image) */}
        {!hasImage && (
          <div className="flex items-start justify-between mb-3">
            {displayDate && (
              <span className="text-sm font-semibold text-amber">{displayDate}</span>
            )}
            {typeof rating === 'number' && (
              <span className="inline-flex items-center gap-1 bg-elevated text-primary px-2.5 py-1 rounded-md text-sm font-semibold">
                <Star className="w-3.5 h-3.5 fill-current" strokeWidth={0} />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
        )}

        {/* Date below image */}
        {hasImage && displayDate && (
          <p className="text-sm font-semibold text-amber mb-2">{displayDate}</p>
        )}

        {/* Artist name */}
        <h3 className="text-xl font-bold text-primary mb-2 line-clamp-2">{artist}</h3>

        {/* Venue */}
        {venue && (
          <p className="text-sm text-secondary line-clamp-1">{venue}</p>
        )}

        {/* City */}
        {city && (
          <p className="text-sm text-muted">{city}</p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {tags.map((t, i) => (
              <span
                key={i}
                className="text-[11px] font-bold tracking-wide uppercase bg-hover text-secondary px-2 py-0.5 rounded-full"
              >
                {t.label}
              </span>
            ))}
          </div>
        )}

        {/* Friend tags */}
        {taggedFriends.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-subtle">
            <Users className="w-4 h-4 text-muted" />
            <span className="text-xs text-muted">
              {taggedFriends.length} friend{taggedFriends.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          onKeyDown={e => e.stopPropagation()}
          className="absolute top-2.5 left-2.5 p-1.5 rounded-lg bg-black/40 text-on-dark hover:text-danger hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete show"
          aria-label="Delete show"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
