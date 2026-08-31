// components/shows/ToursTabView.jsx
//
// "Tours" tab on the Shows page — collapsible cards, one per tour, built
// from the same tour index as the tour badge on individual show cards
// (see lib/runIndex.js buildTourIndex). Expanding a card lists every stop;
// the tour name links to the full /tours/ detail page.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function ToursTabView({ tours, onSelectShow, shows }) {
  const [expandedKey, setExpandedKey] = useState(null);

  if (tours.length === 0) {
    return (
      <Card padding="lg" className="text-center">
        <p className="text-secondary text-sm">
          No tours yet — tours are detected automatically from setlist.fm tour names on your imported shows.
        </p>
      </Card>
    );
  }

  const goToShow = (showId) => {
    const show = shows.find(s => s.id === showId);
    if (show && onSelectShow) onSelectShow(show);
  };

  return (
    <div className="space-y-3 mb-8">
      {tours.map(tour => {
        const isExpanded = expandedKey === tour.key;
        return (
          <Card key={tour.key} padding="none" className="overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedKey(isExpanded ? null : tour.key)}
              className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left hover:bg-hover transition-colors"
            >
              <div className="min-w-0 flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-primary truncate">{tour.tourName}</div>
                  <div className="text-xs text-secondary truncate">
                    {tour.artistName} &middot; {formatDate(tour.dateRange.start)}
                    {tour.dateRange.end !== tour.dateRange.start ? ` – ${formatDate(tour.dateRange.end)}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs font-medium text-secondary hidden sm:inline">
                  {tour.stopCount} stop{tour.stopCount !== 1 ? 's' : ''} &middot; {tour.venuesCount} venue{tour.venuesCount !== 1 ? 's' : ''}
                </span>
                {tour.avgRating != null && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {tour.avgRating.toFixed(1)}
                  </span>
                )}
                <Link
                  href={`/tours/?tour=${encodeURIComponent(tour.key)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Tour page
                </Link>
              </div>
            </button>

            {isExpanded && (
              <ul className="list-none p-0 m-0 divide-y divide-subtle border-t border-subtle">
                {tour.stops.map((stop, i) => (
                  <li key={stop.showId}>
                    <button
                      type="button"
                      onClick={() => goToShow(stop.showId)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-hover transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-primary">
                          Stop {i + 1} &middot; {formatDate(stop.date)}
                        </div>
                        <div className="text-xs text-secondary truncate">
                          {stop.venue}{stop.city ? `, ${stop.city}` : ''}
                        </div>
                      </div>
                      {stop.rating > 0 && (
                        <div className="flex items-center gap-1 text-xs font-semibold text-amber flex-shrink-0">
                          <Star className="w-3 h-3 fill-current" />
                          {stop.rating}/10
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
