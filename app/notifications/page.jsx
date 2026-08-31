'use client';

import { Bell } from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import AnniversaryCalendar from '@/components/notifications/AnniversaryCalendar';
import { PageHeader, EmptyState, Button } from '@/components/ui';
import { useApp } from '@/context/AppContext';

export default function NotificationsPage() {
  const { user, guestMode, openAuthModal } = useApp();

  if (guestMode || !user) {
    return (
      <>
        <PageHeader eyebrow="Community" title="Notifications" />
        <EmptyState
          icon={Bell}
          tone="brand"
          title="Sign in to see your notifications"
          body="Create a free account to get notified when someone replies to your comments or likes your comments and photos."
          action={<Button onClick={() => openAuthModal('signup')}>Create account</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Community" title="Notifications" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <NotificationCenter />
        </div>
        <div>
          <AnniversaryCalendar />
        </div>
      </div>
    </>
  );
}
