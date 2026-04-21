// components/upcoming/UpcomingItem.jsx
//
// Countdown-forward row for /upcoming. Date block on the left, artist/venue
// center, countdown on the right. Countdown computed from ISO date.

import React from 'react';
import Badge from '../ui/Badge';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function daysUntil(iso) {
  const target = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export default function UpcomingItem({
  artist, venue, city, time,
  date,             // ISO string
  tags = [],
  onClick,
}) {
  const d = new Date(date);
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  const days = daysUntil(date);

  return (
    <div
      onClick={onClick}
      className="grid grid-cols-[72px_1fr_auto] gap-4 items-center bg-surface border border-subtle rounded-2xl px-4 py-4 mb-2 cursor-pointer hover:border-active transition-colors"
    >
      <div className="bg-base rounded-xl p-2.5 text-center border border-subtle">
        <div className="text-[10px] font-extrabold tracking-[0.1em] uppercase text-brand">{month}</div>
        <div className="text-[22px] font-extrabold tracking-[-0.02em] leading-none mt-0.5">{day}</div>
      </div>
      <div className="min-w-0">
        <div className="text-[16px] font-extrabold truncate">{artist}</div>
        <div className="text-[12px] text-secondary mt-0.5 truncate">
          {venue}{city && ` · ${city}`}{time && ` · ${time}`}
        </div>
        {tags.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {tags.map((t, i) => (
              <Badge key={i} tone={t.tone || 'neutral'} size="sm">{t.label}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="font-mono text-[18px] font-extrabold tracking-[-0.01em] flex items-baseline gap-1 whitespace-nowrap">
        {days > 0 ? days : 0}
        <small className="text-[10px] font-semibold text-muted tracking-[0.06em] uppercase">
          {days === 1 ? ' day' : ' days'}
        </small>
      </div>
    </div>
  );
}
