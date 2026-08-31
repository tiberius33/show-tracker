'use client';

import { Activity } from 'lucide-react';
import ActivityFeedView from '@/components/activity/ActivityFeedView';
import { PageHeader, EmptyState, Button } from '@/components/ui';
import { useApp } from '@/context/AppContext';

export default function ActivityPage() {
  const { user, guestMode, openAuthModal } = useApp();

  // Guests are allowed elsewhere in the app, but a friend feed needs
  // friends, which needs an account — sign-in only, same as Friends itself.
  if (guestMode || !user) {
    return (
      <>
        <PageHeader eyebrow="Community" title="Activity" />
        <EmptyState
          icon={Activity}
          tone="brand"
          title="Sign in to see friend activity"
          body="Create a free account, add some friends, and see what shows they're adding and rating in real time."
          action={<Button onClick={() => openAuthModal('signup')}>Create account</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Community"
        title="Activity"
        subtitle="What your friends have been up to, in real time."
      />
      <ActivityFeedView />
    </>
  );
}
