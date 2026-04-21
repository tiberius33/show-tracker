'use client';

import UpcomingShowsView from '@/components/UpcomingShowsView';
import { PageHeader, Badge } from '@/components/ui';
import { useApp } from '@/context/AppContext';

export default function UpcomingPage() {
  const { shows, setUpcomingShowsBadgeCount } = useApp();

  return (
    <>
      <PageHeader
        eyebrow="Upcoming"
        title="Upcoming Shows"
        subtitle="Shows from your tracked artists, pulled from Ticketmaster."
        actions={<Badge tone="beta">Beta</Badge>}
      />
      <UpcomingShowsView
        shows={shows}
        onCountLoaded={(count) => setUpcomingShowsBadgeCount(count > 0 ? count : null)}
      />
    </>
  );
}
