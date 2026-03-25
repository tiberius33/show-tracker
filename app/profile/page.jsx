'use client';

import { useRouter } from 'next/navigation';
import ProfileView from '@/components/profile/ProfileView';
import { useApp } from '@/context/AppContext';

export default function ProfilePage() {
  const { user, guestMode, shows, userRank, myConfirmedSuggestions, friends, setSelectedShow } = useApp();
  const router = useRouter();

  if (guestMode || !user) return null;

  return (
    <ProfileView
      user={user}
      shows={shows}
      userRank={userRank}
      onProfileUpdate={() => {}}
      onViewShow={(show) => { setSelectedShow(show); router.push('/shows'); }}
      confirmedSuggestions={myConfirmedSuggestions}
      friends={friends}
    />
  );
}
