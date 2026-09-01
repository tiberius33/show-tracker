'use client';

// Festivals list. A single festival's detail now lives at its own
// /festivals/[festivalId] route (see app/festivals/[festivalId]/page.jsx),
// following the same dynamic-route pattern as /shows/[id] — this page
// redirects the old `?festival=<key>` query-param form (from the
// pre-5.28.0 auto-detected festival feature) to the new route for anyone
// with an old link, though no in-app or emailed link ever used it.

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import FestivalListView from '@/components/festivals/FestivalListView';
import { Button, PageHeader, EmptyState } from '@/components/ui';

export default function FestivalsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, guestMode, openAuthModal } = useApp();

  const legacyFestivalKey = searchParams.get('festival');
  useEffect(() => {
    if (legacyFestivalKey) router.replace(`/festivals/${encodeURIComponent(legacyFestivalKey)}`);
  }, [legacyFestivalKey, router]);

  if (guestMode || !user) {
    return (
      <>
        <PageHeader eyebrow="Festivals" title="Festivals" />
        <EmptyState
          icon={Heart}
          tone="brand"
          title="Sign in to see your festivals"
          body="Festivals are yours to create and attach shows to, so create a free account to get started."
          action={<Button onClick={() => openAuthModal('signup')}>Create account</Button>}
        />
      </>
    );
  }

  if (legacyFestivalKey) return null;

  return <FestivalListView />;
}
