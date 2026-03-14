'use client';

import FriendsView from '@/components/FriendsView';
import { useApp } from '@/context/AppContext';

export default function FriendsPage() {
  const {
    user, guestMode, friends,
    pendingFriendRequests, sentFriendRequests, pendingShowTags,
    sendFriendRequestByEmail, sendFriendRequest,
    acceptFriendRequest, declineFriendRequest, removeFriend,
    acceptShowTag, declineShowTag,
    friendsInitialTab, getShowsTogether,
    showSuggestions, respondToSuggestion,
    pendingInvites, inviteStats, resendInvite, cancelInvite,
    bulkAcceptAll, bulkAcceptFromFriend,
    addSongToShow, updateSongRating, updateSongComment, deleteSong,
    updateShowRating, updateShowComment, batchRateUnrated,
    setTagFriendsShow, setVenueRatingShow,
    myConfirmedSuggestions, normalizeShowKey,
    sharedComments, commentsLoading, memoriesShow,
    openMemories, addSharedComment, editSharedComment, deleteSharedComment,
  } = useApp();

  if (guestMode || !user) return null;

  return (
    <FriendsView
      user={user}
      friends={friends}
      pendingFriendRequests={pendingFriendRequests}
      sentFriendRequests={sentFriendRequests}
      pendingShowTags={pendingShowTags}
      onSendFriendRequestByEmail={sendFriendRequestByEmail}
      onSendFriendRequest={sendFriendRequest}
      onAcceptFriendRequest={acceptFriendRequest}
      onDeclineFriendRequest={declineFriendRequest}
      onRemoveFriend={removeFriend}
      onAcceptShowTag={acceptShowTag}
      onDeclineShowTag={declineShowTag}
      initialTab={friendsInitialTab}
      getShowsTogether={getShowsTogether}
      showSuggestions={showSuggestions}
      respondToSuggestion={respondToSuggestion}
      pendingInvites={pendingInvites}
      inviteStats={inviteStats}
      onResendInvite={resendInvite}
      onCancelInvite={cancelInvite}
      onBulkAcceptAll={bulkAcceptAll}
      onBulkAcceptFromFriend={bulkAcceptFromFriend}
      onAddSong={addSongToShow}
      onRateSong={updateSongRating}
      onCommentSong={updateSongComment}
      onDeleteSong={deleteSong}
      onRateShow={updateShowRating}
      onCommentShow={updateShowComment}
      onBatchRate={batchRateUnrated}
      onTagFriends={(show) => setTagFriendsShow(show)}
      onRateVenue={(show) => setVenueRatingShow(show)}
      confirmedSuggestions={myConfirmedSuggestions}
      normalizeShowKey={normalizeShowKey}
      sharedComments={sharedComments}
      commentsLoading={commentsLoading}
      memoriesShow={memoriesShow}
      onOpenMemories={openMemories}
      onAddComment={addSharedComment}
      onEditComment={editSharedComment}
      onDeleteComment={deleteSharedComment}
    />
  );
}
