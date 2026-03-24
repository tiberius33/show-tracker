'use client';

import FeedbackView from '@/components/FeedbackView';
import { useApp } from '@/context/AppContext';

export default function FeedbackPage() {
  const { user, navigateTo, unreadNotifications, markNotificationsRead } = useApp();

  return (
    <FeedbackView
      user={user}
      onNavigate={navigateTo}
      unreadNotifications={unreadNotifications}
      onMarkRead={markNotificationsRead}
    />
  );
}
