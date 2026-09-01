'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import ShowDetailView from '@/components/shows/ShowDetailView';
import TagFriendsModal from '@/components/TagFriendsModal';
import PlaylistCreatorModal from '@/components/PlaylistCreatorModal';
import { Button } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';

// Renders the same ShowDetailView used inline on /shows, so a show looks
// identical whether you land here via a direct/shared URL or by clicking a
// show from any list in the app.
export default function ShowDetailClient({ id }) {
  const router = useRouter();
  const {
    shows, user, guestMode, friends, festivals,
    updateShowRating, updateShowData, updateShowComment,
    tagFriendsAtShow, tagFriendByEmail, tagFriendsShow, setTagFriendsShow,
    deleteShow, toggleFavoriteArtist, isArtistFavorite, addSongToShow,
    updateSetlistOrder,
  } = useApp();

  const [playlistShow, setPlaylistShow] = useState(null);

  const show = useMemo(() => shows.find(s => s.id === id), [shows, id]);

  if (!show) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg text-primary mb-4">Show not found.</p>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push('/shows/')}>
          Back to shows
        </Button>
      </div>
    );
  }

  return (
    <>
      <ShowDetailView
        show={show}
        friends={friends}
        onClose={() => router.push('/shows/')}
        onUpdateRating={updateShowRating}
        onUpdateVenueRating={(showId, venueRating) => updateShowData(showId, { venueRating })}
        onUpdateComment={!guestMode ? (showId, comment) => updateShowComment(showId, comment) : undefined}
        festival={show.festivalId ? festivals.find(f => f.id === show.festivalId) || null : null}
        onTagFriends={!guestMode ? (s) => setTagFriendsShow(s) : undefined}
        onCreatePlaylist={!guestMode ? (s) => setPlaylistShow(s) : undefined}
        onDeleteShow={deleteShow}
        onAddSong={!guestMode ? addSongToShow : undefined}
        onReorderSetlist={!guestMode ? updateSetlistOrder : undefined}
        toggleFavoriteArtist={!guestMode ? toggleFavoriteArtist : undefined}
        isArtistFavorite={isArtistFavorite}
        allShows={shows}
        user={user}
      />
      {tagFriendsShow && (
        <TagFriendsModal
          show={tagFriendsShow}
          friends={friends}
          onTag={(selectedFriendUids) => tagFriendsAtShow(tagFriendsShow, selectedFriendUids)}
          onInviteByEmail={(params) => tagFriendByEmail({ ...params, show: tagFriendsShow })}
          onClose={() => setTagFriendsShow(null)}
        />
      )}
      {playlistShow && (
        <PlaylistCreatorModal
          show={playlistShow}
          onClose={() => setPlaylistShow(null)}
        />
      )}
    </>
  );
}
