'use client';

import { useRouter } from 'next/navigation';
import ProfileView from '@/components/profile/ProfileView';
import { useApp } from '@/context/AppContext';

export default function ProfilePage() {
  const { user, guestMode, shows, userRank, myConfirmedSuggestions, friends, setSelectedShow, setCommentContext, favoriteArtists, toggleFavoriteArtist } = useApp();
  const router = useRouter();

  if (guestMode || !user) return null;

  return (
    <ProfileView
      user={user}
      shows={shows}
      userRank={userRank}
      onProfileUpdate={() => {}}
      onViewShow={(show, commentData) => {
        setSelectedShow(show);
        if (commentData) {
          setCommentContext(commentData);
        }
        router.push('/shows');
      }}
      confirmedSuggestions={myConfirmedSuggestions}
      friends={friends}
      favoriteArtists={favoriteArtists}
      onToggleFavoriteArtist={toggleFavoriteArtist}
    />
  );
}
