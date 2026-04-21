// components/shows/ShowRow.jsx
//
// Horizontal list row for dense listings (recent activity, search results).

import React from 'react';
import Link from 'next/link';
import ShowCover from './ShowCover';
import RatingStars from '../ui/RatingStars';

export default function ShowRow({ show, trailing }) {
  const { id, artist, venue, city, date, year, rating } = show;
  return (
    <Link
      href={`/shows/${id}`}
      className="grid grid-cols-[64px_90px_1fr_auto] md:grid-cols-[64px_120px_1fr_auto_80px] gap-4 items-center bg-surface border border-subtle rounded-xl px-4 py-3 mb-2 transition-colors hover:border-active"
    >
      <div className="w-16 h-16">
        <ShowCover seed={id} rounded="rounded-xl" aspectRatio="1 / 1" />
      </div>
      <div className="font-mono text-xs font-bold text-secondary leading-tight">
        <strong className="block text-lg text-primary font-sans font-extrabold">{date}</strong>
        {year}
      </div>
      <div className="min-w-0">
        <div className="text-[16px] font-extrabold tracking-[-0.01em] text-primary truncate">{artist}</div>
        <div className="text-[12px] text-secondary mt-0.5 truncate">{venue}{city && ` · ${city}`}</div>
      </div>
      {typeof rating === 'number' && (
        <RatingStars value={rating} size={14} className="hidden md:inline-flex" />
      )}
      {trailing && <div className="text-right">{trailing}</div>}
    </Link>
  );
}
