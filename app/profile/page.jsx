'use client';

import ProfileView from '@/components/profile/ProfileView';
import { useApp } from '@/context/AppContext';

export default function ProfilePage() {
  const { user, guestMode, shows, userRank } = useApp();

  if (guestMode || !user) return null;

  return (
    <ProfileView
      user={user}
      shows={shows}
      userRank={userRank}
      onProfileUpdate={() => {}}
    />
  );
}
