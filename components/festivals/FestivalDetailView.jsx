// components/festivals/FestivalDetailView.jsx
//
// One festival: every artist you saw there, every show, in date order.
// See lib/festivalIndex.js for how the grouping is built.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, StatFigure } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function FestivalDetailView({ festival }) {
  const router = useRouter();
  const { shows, setSelectedShow } = useApp();

  const goToShow = (showId) => {
    const show = shows.find(s => s.id === showId);
    if (show) {
      setSelectedShow(show);
      router.push('/shows/');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/festivals/"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg"
      >
        <ArrowLeft className="w-4 h-4" />
        All festivals
      </Link>

      <div className="bg-surface border border-subtle rounded-2xl p-6 mb-6">
        <h1 className="text-2xl font-bold text-primary mb-1">{festival.name}</h1>
        <p className="text-sm text-secondary">
          {festival.artists.join(', ')}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
          <Card padding="sm"><StatFigure value={festival.showCount} label="Shows You Caught" /></Card>
          <Card padding="sm"><StatFigure value={festival.artistCount} label="Artists" /></Card>
          <Card padding="sm">
            <StatFigure value={formatDate(festival.dateRange.start)} label="First Day" />
          </Card>
          <Card padding="sm"><StatFigure value={festival.venuesCount} label="Venues" /></Card>
          <Card padding="sm"><StatFigure value={festival.countriesVisited} label="Countries" /></Card>
          <Card padding="sm">
            <StatFigure value={festival.avgRating != null ? festival.avgRating.toFixed(1) : '—'} label="Avg Rating" />
          </Card>
        </div>
      </div>

      <Card padding="none">
        <ul className="list-none p-0 m-0 divide-y divide-subtle">
          {festival.shows.map(show => (
            <li key={show.showId}>
              <button
                type="button"
                onClick={() => goToShow(show.showId)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-primary truncate">{show.artist}</div>
                  <div className="text-xs text-secondary mt-0.5 truncate">
                    {formatDate(show.date)} · {show.venue}{show.city ? `, ${show.city}` : ''}
                  </div>
                </div>
                {show.rating > 0 && (
                  <div className="flex items-center gap-1 text-sm font-semibold text-amber flex-shrink-0">
                    <Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    {show.rating}/10
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
