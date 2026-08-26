'use client';

import RoadmapView from '@/components/RoadmapView';
import { PageHeader } from '@/components/ui';
import { useApp } from '@/context/AppContext';

export default function RoadmapPage() {
  const { user } = useApp();

  return (
    <>
      <PageHeader
        eyebrow="Roadmap"
        title="What's Coming to MySetlists"
        subtitle="Vote on features you want most — the more votes, the higher it goes."
      />
      <RoadmapView user={user} />
    </>
  );
}
