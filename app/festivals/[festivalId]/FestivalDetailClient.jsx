'use client';

// Mirrors app/shows/[id]/ShowDetailClient.jsx — same festival detail view
// whether you land here via a direct/shared URL or by clicking a festival
// from the list.

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Tent, Heart, ArrowLeft } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import FestivalDetailView from '@/components/festivals/FestivalDetailView';
import { Button, PageHeader, EmptyState } from '@/components/ui';

export default function FestivalDetailClient({ festivalId }) {
  const router = useRouter();
  const { user, guestMode, openAuthModal, festivals } = useApp();

  const festival = useMemo(() => (festivals || []).find(f => f.id === festivalId) || null, [festivals, festivalId]);

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
