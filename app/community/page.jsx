'use client';

import CommunityStatsView from '@/components/CommunityStatsView';
import { useApp } from '@/context/AppContext';

export default function CommunityPage() {
  const { communityStats, sendFriendRequest, user, guestMode, friendUids } = useApp();

  if (guestMode) return null;

  return (
    <CommunityStatsView
      communityStats={communityStats}
      onAddFriend={sendFriendRequest}
      currentUserUid={user?.uid}
      currentFriendUids={friendUids}
    />
  );
}
