'use client';

import StatsView from '@/components/StatsView';
import { useApp } from '@/context/AppContext';

export default function StatsPage() {
  const {
    shows, getSongStats, getArtistStats, getVenueStats, getTopRatedShows,
    updateSongRating, updateSongComment, addSongToShow, deleteSong,
    updateShowRating, updateShowComment, batchRateUnrated,
    user, guestMode, setTagFriendsShow, setVenueRatingShow, statsTab,
    getVenueRatings, normalizeVenueKey, computeVenueAggregate,
  } = useApp();

  return (
    <StatsView
      shows={shows}
      songStats={getSongStats()}
      artistStats={getArtistStats()}
      venueStats={getVenueStats()}
      topRatedShows={getTopRatedShows()}
      onRateSong={updateSongRating}
      onCommentSong={updateSongComment}
      onAddSong={addSongToShow}
      onDeleteSong={deleteSong}
      onRateShow={updateShowRating}
      onCommentShow={updateShowComment}
      onBatchRate={batchRateUnrated}
      initialTab={statsTab}
      onTagFriends={!guestMode ? (show) => setTagFriendsShow(show) : undefined}
      onRateVenue={user && !guestMode ? (show) => setVenueRatingShow(show) : undefined}
      fetchVenueRatings={getVenueRatings}
      normalizeVenueKey={normalizeVenueKey}
      computeVenueAggregate={computeVenueAggregate}
    />
  );
}
