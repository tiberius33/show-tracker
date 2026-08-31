'use client';

// Festivals list (no query param) or a single festival's detail
// (?festival=<festivalKey>) — same static query-param routing approach as
// /tours/, /songs/, and /runs/. See app/tours/page.jsx.

import { useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Heart, Tent, ArrowLeft } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import useFestivalIndex from '@/hooks/useFestivalIndex';
import FestivalListView from '@/components/festivals/FestivalListView';
import FestivalDetailView from '@/components/festivals/FestivalDetailView';
import { Button, PageHeader, EmptyState } from '@/components/ui';

export default function FestivalsPage() {
  const router = useRouter();
  const { user, guestMode, openAuthModal } = useApp();
  const festivalIndex = useFestivalIndex();

  const searchParams = useSearchParams();
  const festivalKey = searchParams.get('festival') || '';
  const festival = useMemo(() => festivalIndex[festivalKey] || null, [festivalIndex, festivalKey]);
  const festivals = useMemo(
    () => Object.values(festivalIndex).sort((a, b) => (a.dateRange.start < b.dateRange.start ? 1 : -1)),
    [festivalIndex]
  );

  if (guestMode || !user) {
    return (
      <>
        <PageHeader eyebrow="Festivals" title="Festivals" />
        <EmptyState
          icon={Heart}
          tone="brand"
          title="Sign in to see your festivals"
          body="Festivals are built from your own logged shows, so create a free account to see every one you caught."
          action={<Button onClick={() => openAuthModal('signup')}>Create account</Button>}
        />
      </>
    );
  }

  if (festivalKey) {
    if (!festival) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Tent className="w-10 h-10 text-muted mb-4" />
          <p className="text-lg text-primary mb-4">Festival not found.</p>
          <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push('/festivals/')}>
            Back to festivals
          </Button>
        </div>
      );
    }
    return <FestivalDetailView festival={festival} />;
  }

  return <FestivalListView festivals={festivals} />;
}
