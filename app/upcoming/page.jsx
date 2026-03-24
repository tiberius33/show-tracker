'use client';

import UpcomingShowsView from '@/components/UpcomingShowsView';
import { useApp } from '@/context/AppContext';

export default function UpcomingPage() {
  const { shows, setUpcomingShowsBadgeCount } = useApp();

  return (
    <UpcomingShowsView
      shows={shows}
      onCountLoaded={(count) => setUpcomingShowsBadgeCount(count > 0 ? count : null)}
    />
  );
}
