'use client';

// Tours landing (no `?tour=` param) or a single tour's detail
// (?tour=<tourKey>) — same static query-param routing approach as
// /songs/, /runs/, and /festivals/. See lib/runIndex.js for the shared
// tour-building logic (also used by components/shows/ToursTabView.jsx,
// which this page's landing list now supersedes — see that file's header).

import { useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Map, Heart, ArrowLeft, Star, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useTourIndex } from '@/hooks/useRunIndex';
import TourDetailView from '@/components/runs/TourDetailView';
import { Button, PageHeader, EmptyState, Card } from '@/components/ui';
import { formatDate } from '@/lib/utils';

function ToursLandingView({ tours }) {
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
        <div className="space-y-3">
          {tours.map(tour => (
            <Link key={tour.key} href={`/tours/?tour=${encodeURIComponent(tour.key)}`} className="block">
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
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {tour.avgRating != null && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-amber">
                        <Star className="w-4 h-4 fill-current" />
                        {tour.avgRating.toFixed(1)}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TourPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, guestMode, openAuthModal } = useApp();
  const tourIndex = useTourIndex();

  const tourKey = searchParams.get('tour') || '';
  const tour = useMemo(() => tourIndex[tourKey] || null, [tourIndex, tourKey]);
  const sortedTours = useMemo(
    () => Object.values(tourIndex).sort((a, b) => (a.dateRange.start < b.dateRange.start ? 1 : -1)),
    [tourIndex]
  );

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
    return <TourDetailView tour={tour} />;
  }

  return <ToursLandingView tours={sortedTours} />;
}
