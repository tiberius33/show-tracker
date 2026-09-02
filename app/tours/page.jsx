'use client';

// Tours landing (no `?tour=` param) or a single tour's detail
// (?tour=<tourKey>) — same static query-param routing approach as
// /songs/ and /runs/. See lib/runIndex.js for the shared tour-building
// logic. The landing list here replaces the old Tours tab on the Shows
// page (components/shows/ToursTabView.jsx, removed) — /tours is now the
// single place a tour list is rendered.

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Map, Heart, ArrowLeft, Star, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useTourIndex } from '@/hooks/useRunIndex';
import useFavoriteTours from '@/hooks/useFavoriteTours';
import TourDetailView from '@/components/runs/TourDetailView';
import TourFavoriteButton from '@/components/runs/TourFavoriteButton';
import { Button, PageHeader, EmptyState, Card, SearchField } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { tourHref } from '@/lib/runIndex';

// Sorts a tour list. "stops" (most stops you caught first) is the default —
// the Tours page is about which tours you followed hardest, so the tour you
// caught eight nights of should outrank a one-off from last month.
const SORTS = {
  stops: { label: 'Stops', compare: (a, b) => b.stopCount - a.stopCount || (a.dateRange.start < b.dateRange.start ? 1 : -1) },
  recent: { label: 'Recent', compare: (a, b) => (a.dateRange.start < b.dateRange.start ? 1 : -1) },
  artist: { label: 'Artist', compare: (a, b) => a.artistName.localeCompare(b.artistName) || a.tourName.localeCompare(b.tourName) },
  rating: {
    label: 'Rating',
    compare: (a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1) || b.stopCount - a.stopCount,
  },
};

function ToursLandingView({ tours, favorites }) {
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterArtist, setFilterArtist] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState('stops');

  const availableYears = useMemo(() => {
    const set = new Set();
    tours.forEach(t => (t.years || []).forEach(y => set.add(y)));
    return Array.from(set).sort().reverse();
  }, [tours]);

  const availableArtists = useMemo(
    () => Array.from(new Set(tours.map(t => t.artistName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [tours]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tours
      .filter(t => !favoritesOnly || favorites.isFavorite(t.key))
      .filter(t => !filterYear || (t.years || []).includes(filterYear))
      .filter(t => !filterArtist || t.artistName === filterArtist)
      .filter(t => !q || t.tourName.toLowerCase().includes(q) || t.artistName.toLowerCase().includes(q))
      .sort(SORTS[sortBy].compare);
  }, [tours, search, filterYear, filterArtist, favoritesOnly, sortBy, favorites]);

  const filtersActive = !!(search || filterYear || filterArtist || favoritesOnly);
  const clearFilters = () => {
    setSearch('');
    setFilterYear('');
    setFilterArtist('');
    setFavoritesOnly(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow="Tours" title="Your tours" />

      {tours.length === 0 ? (
        <EmptyState
          icon={Map}
          tone="brand"
          title="No tours yet"
          body="Tours are detected automatically from setlist.fm tour names on your imported shows — once a tour has two or more stops in your history, it'll show up here."
        />
      ) : (
        <>
          {/* Search, filter & sort — same Card + inline controls convention
              as the Shows page's filter bar. */}
          <Card padding="sm" className="mb-6 shadow-theme-sm">
            <div className="flex gap-3 flex-wrap items-center">
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Filter by tour or artist..."
                className="flex-1 min-w-[200px]"
              />

              {availableYears.length > 1 && (
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  aria-label="Filter tours by year"
                  className="px-3 py-2.5 bg-surface border border-subtle rounded-xl text-sm font-medium text-secondary focus:outline-none focus:ring-2 focus:ring-brand/50 cursor-pointer"
                >
                  <option value="">All Years</option>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}

              {availableArtists.length > 1 && (
                <select
                  value={filterArtist}
                  onChange={(e) => setFilterArtist(e.target.value)}
                  aria-label="Filter tours by artist"
                  className="px-3 py-2.5 bg-surface border border-subtle rounded-xl text-sm font-medium text-secondary focus:outline-none focus:ring-2 focus:ring-brand/50 cursor-pointer max-w-[200px]"
                >
                  <option value="">All Artists</option>
                  {availableArtists.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}

              <Button
                size="sm"
                variant="ghost"
                icon={Star}
                onClick={() => setFavoritesOnly(v => !v)}
                aria-pressed={favoritesOnly}
                className={favoritesOnly
                  ? 'bg-amber/15 text-amber border border-amber/40'
                  : 'text-secondary border border-subtle'}
              >
                Favorites
              </Button>

              {filtersActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={clearFilters}
                  className="text-danger hover:bg-danger/10"
                >
                  Clear
                </Button>
              )}
            </div>

            {tours.length > 1 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-subtle flex-wrap">
                <span className="text-sm font-medium text-secondary">Sort:</span>
                {Object.entries(SORTS).map(([key, { label }]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant="ghost"
                    onClick={() => setSortBy(key)}
                    className={sortBy === key
                      ? 'bg-brand-subtle text-brand border border-brand/30'
                      : 'text-secondary border border-subtle'}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
          </Card>

          {visible.length === 0 ? (
            <EmptyState
              icon={Map}
              title="No tours match those filters"
              body={favoritesOnly
                ? "You haven't starred any tours yet — tap the star on a tour to add it here."
                : 'Try clearing a filter to see more of your tours.'}
              action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <div className="space-y-3">
              {visible.map(tour => (
                <Link
                  key={tour.key}
                  href={tourHref(tour.key)}
                  className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <Card padding="md" className="hover:bg-hover transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-primary truncate">{tour.tourName}</div>
                        <div className="text-sm text-secondary mt-0.5 truncate">
                          {tour.artistName} &middot; {formatDate(tour.dateRange.start)}
                          {tour.dateRange.end !== tour.dateRange.start ? ` – ${formatDate(tour.dateRange.end)}` : ''}
                          {' · '}{tour.stopCount} stop{tour.stopCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {tour.avgRating != null && (
                          <span className="flex items-center gap-1 text-sm font-semibold text-amber">
                            <Star className="w-4 h-4 fill-current" />
                            {tour.avgRating.toFixed(1)}
                          </span>
                        )}
                        <TourFavoriteButton
                          tour={tour}
                          isFavorite={favorites.isFavorite(tour.key)}
                          pending={favorites.pendingKeys.has(tour.key)}
                          onToggle={favorites.toggleFavorite}
                          size="sm"
                        />
                        <ChevronRight className="w-4 h-4 text-muted" />
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TourPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, guestMode, openAuthModal } = useApp();
  const tourIndex = useTourIndex();
  const favorites = useFavoriteTours();

  const tourKey = searchParams.get('tour') || '';
  const tour = useMemo(() => tourIndex[tourKey] || null, [tourIndex, tourKey]);
  const allTours = useMemo(() => Object.values(tourIndex), [tourIndex]);

  if (guestMode || !user) {
    return (
      <>
        <PageHeader eyebrow="Tours" title="Tour history" />
        <EmptyState
          icon={Heart}
          tone="brand"
          title="Sign in to see your tours"
          body="Tours are built from your own logged shows, so create a free account to see every stop you caught."
          action={<Button onClick={() => openAuthModal('signup')}>Create account</Button>}
        />
      </>
    );
  }

  if (tourKey) {
    if (!tour) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Map className="w-10 h-10 text-muted mb-4" />
          <p className="text-lg text-primary mb-4">Tour not found.</p>
          <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push('/tours/')}>
            Back to tours
          </Button>
        </div>
      );
    }
    return <TourDetailView tour={tour} favorites={favorites} />;
  }

  return <ToursLandingView tours={allTours} favorites={favorites} />;
}
