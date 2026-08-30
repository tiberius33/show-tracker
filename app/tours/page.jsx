'use client';

// A tour's detail page, at /tours/?tour=<tourKey>. Same static query-param
// routing approach as /songs/ and /runs/ — see app/songs/page.jsx.

import { useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Map, Heart, ArrowLeft } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTourIndex } from '@/hooks/useRunIndex';
import TourDetailView from '@/components/runs/TourDetailView';
import { Button, PageHeader, EmptyState } from '@/components/ui';

export default function TourPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, guestMode, openAuthModal } = useApp();
  const tourIndex = useTourIndex();

  const tourKey = searchParams.get('tour') || '';
  const tour = useMemo(() => tourIndex[tourKey] || null, [tourIndex, tourKey]);

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

  if (!tour) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Map className="w-10 h-10 text-muted mb-4" />
        <p className="text-lg text-primary mb-4">Tour not found.</p>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push('/shows/')}>
          Back to shows
        </Button>
      </div>
    );
  }

  return <TourDetailView tour={tour} />;
}
