'use client';

import FriendsView from '@/components/FriendsView';
import { PageHeader, Button } from '@/components/ui';
import { UserPlus } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function FriendsPage() {
  const {
    user, guestMode, friends, shows,
    pendingFriendRequests, sentFriendRequests, pendingShowTags,
    sendFriendRequestByEmail, sendFriendRequest,
    acceptFriendRequest, declineFriendRequest, removeFriend,
    acceptShowTag, declineShowTag,
    friendsInitialTab, getShowsTogether,
    showSuggestions, respondToSuggestion,
    pendingInvites, sentPendingEmailTags, inviteStats, resendInvite, cancelInvite,
    bulkAcceptAll, bulkAcceptFromFriend,
    addSongToShow, updateSongRating, updateSongComment, deleteSong,
    updateShowRating, updateShowComment, batchRateUnrated,
    setTagFriendsShow, setVenueRatingShow,
    myConfirmedSuggestions, normalizeShowKey,
    sharedComments, commentsLoading, memoriesShow,
    openMemories, addSharedComment, editSharedComment, deleteSharedComment,
  } = useApp();

  if (guestMode || !user) return null;

  const totalPending = (pendingFriendRequests?.length || 0) + (pendingShowTags?.length || 0);

  // Rough count of shared shows this year across all friends
  const thisYear = new Date().getFullYear();
  const sharedThisYear = (shows || []).filter(s => {
    if (!s.taggedFriends?.length) return false;
    try { return new Date(s.date).getFullYear() === thisYear; } catch { return false; }
  }).length;

  const subtitleParts = [
    `${friends.length} friend${friends.length !== 1 ? 's' : ''}`,
    sharedThisYear > 0 ? `${sharedThisYear} shared show${sharedThisYear !== 1 ? 's' : ''} this year` : null,
    totalPending > 0 ? `${totalPending} pending request${totalPending !== 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        eyebrow="Social"
        title="Friends"
        subtitle={subtitleParts}
        actions={
          <Button
            variant="primary"
            icon={UserPlus}
            onClick={() => {/* FriendsView handles this via Find Friends tab */}}
          >
            Add friend
          </Button>
        }
      />
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
        sentPendingEmailTags={sentPendingEmailTags}
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
        allShows={shows}
      />
    </>
  );
}
