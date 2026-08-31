// components/festivals/FestivalListView.jsx
//
// All detected festivals (see lib/festivalIndex.js) with top-level stats.

'use client';

import Link from 'next/link';
import { Tent, Star } from 'lucide-react';
import { Card, StatFigure, PageHeader, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function FestivalListView({ festivals }) {
  const festivalShowsTotal = festivals.reduce((sum, f) => sum + f.showCount, 0);
  const favorite = festivals.reduce((best, f) => {
    if (f.avgRating == null) return best;
    if (!best || f.avgRating > best.avgRating || (f.avgRating === best.avgRating && f.showCount > best.showCount)) return f;
    return best;
  }, null);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader eyebrow="Festivals" title="Your festivals" />

      {festivals.length === 0 ? (
        <EmptyState
          icon={Tent}
          tone="brand"
          title="No festivals detected yet"
          body="Festivals are detected automatically when two or more artists in your show history share the same setlist.fm tour/event name (e.g. multiple artists all tagged “Bonnaroo 2023”)."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3.5 mb-8">
            <Card padding="sm"><StatFigure value={festivals.length} label="Festivals Attended" /></Card>
            <Card padding="sm"><StatFigure value={festivalShowsTotal} label="Festival Shows" /></Card>
            <Card padding="sm" className="min-w-0">
              <div className="text-[22px] font-extrabold tracking-[-0.02em] truncate" title={favorite ? favorite.name : undefined}>
                {favorite ? favorite.name : '—'}
              </div>
              <div className="text-[11px] text-muted font-semibold tracking-[0.08em] uppercase">Favorite Festival</div>
            </Card>
          </div>

          <div className="space-y-3">
            {festivals.map(festival => (
              <Link
                key={festival.key}
                href={`/festivals/?festival=${encodeURIComponent(festival.key)}`}
                className="block"
              >
                <Card padding="md" className="hover:bg-hover transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-primary truncate">{festival.name}</div>
                      <div className="text-sm text-secondary mt-0.5">
                        {formatDate(festival.dateRange.start)}
                        {festival.dateRange.end !== festival.dateRange.start ? ` – ${formatDate(festival.dateRange.end)}` : ''}
                        {' · '}{festival.artistCount} artist{festival.artistCount !== 1 ? 's' : ''}
                        {' · '}{festival.showCount} show{festival.showCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {festival.avgRating != null && (
                      <div className="flex items-center gap-1 text-sm font-semibold text-amber flex-shrink-0">
                        <Star className="w-4 h-4 fill-current" />
                        {festival.avgRating.toFixed(1)}
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
