'use client';

// A multi-night run's detail page, at /runs/?run=<runKey>.
//
// Same static-export routing approach as /songs/?artist=&song= — a plain
// static page reading identity from the query string rather than a
// [runKey] dynamic segment, since output: 'export' only resolves a dynamic
// segment's build-time placeholder (see app/songs/page.jsx for the fuller
// explanation, verified against this app's /shows/[id] route).

import { useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Layers, Heart, ArrowLeft } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import useRunIndex from '@/hooks/useRunIndex';
import RunDetailView from '@/components/runs/RunDetailView';
import { Button, PageHeader, EmptyState } from '@/components/ui';

export default function RunPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, guestMode, openAuthModal } = useApp();
  const runIndex = useRunIndex();

  const runKey = searchParams.get('run') || '';
  const run = useMemo(() => runIndex[runKey] || null, [runIndex, runKey]);

  if (guestMode || !user) {
    return (
      <>
        <PageHeader eyebrow="Runs" title="Run history" />
        <EmptyState
          icon={Heart}
          tone="brand"
          title="Sign in to see your runs"
          body="Runs are built from your own logged shows, so create a free account to see your multi-night stands."
          action={<Button onClick={() => openAuthModal('signup')}>Create account</Button>}
        />
      </>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Layers className="w-10 h-10 text-muted mb-4" />
        <p className="text-lg text-primary mb-4">Run not found.</p>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push('/shows/')}>
          Back to shows
        </Button>
      </div>
    );
  }

  return <RunDetailView run={run} />;
}
