// components/runs/TourDetailView.jsx
//
// A tour: every stop the user caught, in date order, with venues and
// ratings — near-free since setlist.fm already supplies show.tour and the
// show card already displays it (see lib/runIndex.js's buildTourIndex).

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, StatFigure } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function TourDetailView({ tour }) {
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
        href="/shows/"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg"
      >
        <ArrowLeft className="w-4 h-4" />
        All shows
      </Link>

      <div className="bg-surface border border-subtle rounded-2xl p-6 mb-6">
        <h1 className="text-2xl font-bold text-primary mb-1">{tour.tourName}</h1>
        <Link
          href={`/shows/?artist=${encodeURIComponent(tour.artistName)}`}
          className="text-sm text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
        >
          {tour.artistName}
        </Link>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
          <Card padding="sm"><StatFigure value={tour.stopCount} label="Stops You Caught" /></Card>
          <Card padding="sm">
            <StatFigure value={formatDate(tour.dateRange.start)} label="First Stop" />
          </Card>
          <Card padding="sm"><StatFigure value={tour.venuesCount} label="Venues" /></Card>
          <Card padding="sm"><StatFigure value={tour.countriesVisited} label="Countries" /></Card>
          <Card padding="sm"><StatFigure value={tour.uniqueSongs} label="Unique Songs" /></Card>
          <Card padding="sm">
            <StatFigure value={tour.avgRating != null ? tour.avgRating.toFixed(1) : '—'} label="Avg Rating" />
          </Card>
        </div>
      </div>

      <Card padding="none">
        <ul className="list-none p-0 m-0 divide-y divide-subtle">
          {tour.stops.map((stop, i) => (
            <li key={stop.showId}>
              <button
                type="button"
                onClick={() => goToShow(stop.showId)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-primary">
                    Stop {i + 1} · {formatDate(stop.date)}
                  </div>
                  <div className="text-xs text-secondary mt-0.5 truncate">
                    {stop.venue}{stop.city ? `, ${stop.city}` : ''}
                  </div>
                </div>
                {stop.rating > 0 && (
                  <div className="flex items-center gap-1 text-sm font-semibold text-amber flex-shrink-0">
                    <Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    {stop.rating}/10
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
