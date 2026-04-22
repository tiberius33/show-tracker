// components/shows/ShowCard.jsx
//
// Grid card for the /shows page. Always uses an onClick handler (no Link)
// so the parent can render ShowDetailView inline without any page navigation
// or static-export routing issues.

import React from 'react';
import { Trash2 } from 'lucide-react';
import ShowCover from './ShowCover';
import Badge from '../ui/Badge';

export default function ShowCard({ show, onClick, onDelete }) {
  const {
    id, artist, venue, city,
    date, year, rating, night,
    tags = [],
    variant,
  } = show;

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

      {/* Delete button — visible on hover */}
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
