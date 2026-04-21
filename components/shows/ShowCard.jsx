// components/shows/ShowCard.jsx
//
// Grid card for the /shows page and anywhere shows are surfaced in 2–4 column
// grids. Hover-lift + click navigates to /shows/[id].

import React from 'react';
import Link from 'next/link';
import ShowCover from './ShowCover';
import Badge from '../ui/Badge';

export default function ShowCard({ show, onClick }) {
  const {
    id, artist, venue, city,
    date, year, rating, night,
    tags = [],     // [{ label, tone }]
    variant,
  } = show;

  const Wrapper = onClick
    ? ({ children, ...props }) => <div {...props} onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>{children}</div>
    : ({ children, ...props }) => <Link href={`/shows/${id}`} {...props}>{children}</Link>;

  return (
    <Wrapper
      className="group block bg-surface border border-subtle rounded-2xl overflow-hidden transition-all duration-150 hover:border-active hover:-translate-y-0.5 hover:shadow-theme-md cursor-pointer"
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
    </Wrapper>
  );
}
