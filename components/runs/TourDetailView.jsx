// components/runs/TourDetailView.jsx
//
// A tour: every stop the user caught, in date order, with venues and
// ratings — near-free since setlist.fm already supplies show.tour and the
// show card already displays it (see lib/runIndex.js's buildTourIndex).
//
// Everything on this page that represents something else in the app is a
// link: the artist and each stop's venue drill into the Shows list the
// same way the Top Artists / Top Venues rows do (`/shows/?artist=` and
// `/shows/?venue=`), each stop opens that show's detail, and every song in
// "New songs on this tour" opens its song page.

'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, ChevronRight, Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import useSongIndex from '@/hooks/useSongIndex';
import { Card, StatFigure } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { newSongsOnTour } from '@/lib/runIndex';
import { songSlugFromTitle } from '@/lib/songIndex';
import TourFavoriteButton from './TourFavoriteButton';

export default function TourDetailView({ tour, favorites = null }) {
  const router = useRouter();
  const { shows, setSelectedShow } = useApp();
  const songIndex = useSongIndex();

  const goToShow = (showId) => {
    const show = shows.find(s => s.id === showId);
    if (show) {
      setSelectedShow(show);
      router.push('/shows/');
    }
  };

  // Songs the user heard for the first time ever on one of this tour's
  // stops, straight off the song index's own firstSeen data.
  const newSongs = useMemo(() => newSongsOnTour(tour, songIndex), [tour, songIndex]);

  const songHref = (title) => {
    const slug = songSlugFromTitle(title);
    return slug ? `/songs/?artist=${tour.artistSlug}&song=${slug}` : null;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/tours/"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg"
      >
        <ArrowLeft className="w-4 h-4" />
        All tours
      </Link>

      <div className="bg-surface border border-subtle rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-primary mb-1">{tour.tourName}</h1>
            <Link
              href={`/shows/?artist=${encodeURIComponent(tour.artistName)}`}
              className="text-sm text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
            >
              {tour.artistName}
            </Link>
          </div>
          {favorites && (
            <TourFavoriteButton
              tour={tour}
              isFavorite={favorites.isFavorite(tour.key)}
              pending={favorites.pendingKeys.has(tour.key)}
              onToggle={favorites.toggleFavorite}
            />
          )}
        </div>

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

      <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-muted mb-2">Stops</p>
      <Card padding="none">
        <ul className="list-none p-0 m-0 divide-y divide-subtle">
          {tour.stops.map((stop, i) => (
            <li key={stop.showId} className="group flex items-center">
              <button
                type="button"
                onClick={() => goToShow(stop.showId)}
                className="flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-primary">
                    Stop {i + 1} · {formatDate(stop.date)}
                  </div>
                  <div className="text-xs text-secondary mt-0.5 truncate">
                    {stop.city || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {stop.rating > 0 && (
                    <div className="flex items-center gap-1 text-sm font-semibold text-amber">
                      <Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                      {stop.rating}/10
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted" />
                </div>
              </button>
              {/* The venue is its own link (to that venue's shows) rather
                  than part of the stop button, so a nested-interactive
                  element never swallows the other's click. */}
              {stop.venue && (
                <Link
                  href={`/shows/?venue=${encodeURIComponent(stop.venue)}`}
                  className="px-3 py-3.5 text-xs text-secondary hover:text-brand hover:underline truncate max-w-[38%] flex-shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
                  title={`All your shows at ${stop.venue}`}
                >
                  {stop.venue}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* New songs — first-ever performances in the user's own history that
          landed on one of this tour's stops. */}
      <div className="flex items-center gap-2 mt-8 mb-2">
        <Sparkles className="w-4 h-4 text-brand" aria-hidden="true" />
        <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-muted">
          New songs on this tour
        </p>
      </div>
      <Card padding={newSongs.length === 0 ? 'lg' : 'none'}>
        {newSongs.length === 0 ? (
          <p className="text-sm text-secondary text-center">
            No first-timers here — you&apos;d already caught every song {tour.artistName} played on this
            tour before it started.
          </p>
        ) : (
          <ul className="list-none p-0 m-0 divide-y divide-subtle">
            {newSongs.map(song => {
              const href = songHref(song.title);
              const RowTag = href ? Link : 'div';
              return (
                <li key={song.key}>
                  <RowTag
                    {...(href ? { href } : {})}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-primary truncate">{song.title}</div>
                      <div className="text-xs text-secondary mt-0.5 truncate">
                        First heard {formatDate(song.firstSeen.date)}
                        {song.firstSeen.venue ? ` · ${song.firstSeen.venue}` : ''}
                        {song.firstSeen.city ? `, ${song.firstSeen.city}` : ''}
                      </div>
                    </div>
                    {href && <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />}
                  </RowTag>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
