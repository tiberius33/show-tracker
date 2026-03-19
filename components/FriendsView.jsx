'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Music, Calendar, MapPin, Check, Users, ChevronLeft, User, Send, Mail, UserPlus, UserCheck, UserX, Tag, RefreshCw, X, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Tip from '@/components/ui/Tip';
import ShowsTogetherView from '@/components/ShowsTogetherView';

function FriendsView({
  user, friends, pendingFriendRequests, sentFriendRequests, pendingShowTags,
  onSendFriendRequestByEmail, onSendFriendRequest, onAcceptFriendRequest,
  onDeclineFriendRequest, onRemoveFriend, onAcceptShowTag, onDeclineShowTag,
  initialTab, getShowsTogether, showSuggestions, respondToSuggestion,
  pendingInvites, inviteStats, onResendInvite, onCancelInvite,
  onBulkAcceptAll, onBulkAcceptFromFriend,
  // Show interaction handlers for ShowsTogetherView
  onAddSong, onRateSong, onCommentSong, onDeleteSong, onRateShow, onCommentShow, onBatchRate,
  onTagFriends, onRateVenue, confirmedSuggestions, normalizeShowKey,
  sharedComments, commentsLoading, memoriesShow, onOpenMemories, onAddComment, onEditComment, onDeleteComment
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'friends');
  const [searchEmail, setSearchEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [showingTogetherWith, setShowingTogetherWith] = useState(null); // null | { uid, name }
  const [resendingIds, setResendingIds] = useState(new Set()); // invite IDs currently being resent
  const [bulkConfirm, setBulkConfirm] = useState(null); // null | { type: 'all' } | { type: 'friend', friendUid, friendName }
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const inviteList = pendingInvites || [];

  const isExpired = (invite) => {
    const lastSent = invite.lastSentAt?.toMillis?.() ?? invite.createdAt?.toMillis?.() ?? 0;
    return Date.now() - lastSent > 30 * 24 * 60 * 60 * 1000;
  };

  const timeAgo = (ts) => {
    if (!ts) return '';
    const ms = Date.now() - (ts.toMillis?.() ?? ts);
    const d = Math.floor(ms / 86400000);
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return `${d} days ago`;
    if (d < 30) return `${Math.floor(d / 7)} week${Math.floor(d / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(d / 30)} month${Math.floor(d / 30) > 1 ? 's' : ''} ago`;
  };

  const handleResend = async (invite) => {
    setResendingIds(prev => new Set(prev).add(invite.id));
    await onResendInvite(invite);
    setResendingIds(prev => { const s = new Set(prev); s.delete(invite.id); return s; });
  };

  // Navigate to initialTab when it changes (e.g., from notification banner)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const handleSendRequest = async () => {
    if (!searchEmail.trim()) return;
    setSending(true);
    await onSendFriendRequestByEmail(searchEmail);
    setSending(false);
    setSearchEmail('');
  };

  const pendingSuggestions = (showSuggestions || []).filter(
    s => s.responses?.[user?.uid] === 'pending' && s.overallStatus !== 'declined'
  );
  const partialSuggestions = (showSuggestions || []).filter(
    s => s.responses?.[user?.uid] === 'confirmed' && s.overallStatus === 'partially_confirmed'
  );

  // Group pending items by friend for bulk accept
  const friendGroups = useMemo(() => {
    const groups = {};
    pendingShowTags.forEach(tag => {
      const uid = tag.fromUid;
      if (!groups[uid]) groups[uid] = { name: tag.fromName, tags: [], suggestions: [] };
      groups[uid].tags.push(tag);
    });
    pendingSuggestions.forEach(s => {
      const otherUid = s.participants?.find(p => p !== user?.uid);
      if (otherUid) {
        if (!groups[otherUid]) groups[otherUid] = { name: s.names?.[otherUid] || 'A friend', tags: [], suggestions: [] };
        groups[otherUid].suggestions.push(s);
      }
    });
    return groups;
  }, [pendingShowTags, pendingSuggestions, user?.uid]);

  const totalPendingItems = pendingShowTags.length + pendingSuggestions.length;
  const friendGroupKeys = Object.keys(friendGroups);

  const handleBulkConfirm = async () => {
    setBulkProcessing(true);
    try {
      if (bulkConfirm.type === 'all') {
        await onBulkAcceptAll(pendingShowTags, pendingSuggestions);
      } else {
        await onBulkAcceptFromFriend(bulkConfirm.friendUid, pendingShowTags, pendingSuggestions);
      }
    } finally {
      setBulkProcessing(false);
      setBulkConfirm(null);
    }
  };

  const requestCount = pendingFriendRequests.length + pendingShowTags.length + pendingSuggestions.length;

  if (showingTogetherWith) {
    return (
      <ShowsTogetherView
        friend={showingTogetherWith}
        getShowsTogether={getShowsTogether}
        onBack={() => setShowingTogetherWith(null)}
        onAddSong={onAddSong}
        onRateSong={onRateSong}
        onCommentSong={onCommentSong}
        onDeleteSong={onDeleteSong}
        onRateShow={onRateShow}
        onCommentShow={onCommentShow}
        onBatchRate={onBatchRate}
        onTagFriends={onTagFriends}
        onRateVenue={onRateVenue}
        currentUserUid={user?.uid}
        confirmedSuggestions={confirmedSuggestions}
        normalizeShowKey={normalizeShowKey}
        sharedComments={sharedComments}
        commentsLoading={commentsLoading}
        memoriesShow={memoriesShow}
        onOpenMemories={onOpenMemories}
        onAddComment={onAddComment}
        onEditComment={onEditComment}
        onDeleteComment={onDeleteComment}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-primary mb-2 font-display">Friends</h1>
      <p className="text-secondary mb-6">Connect with friends and tag them at shows</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: 'friends', label: `My Friends (${friends.length})`, badge: 0 },
          { id: 'requests', label: 'Requests', badge: requestCount },
          { id: 'find', label: 'Find Friends', badge: 0 },
          { id: 'invites', label: 'Invites', badge: inviteList.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-accent-amber-glow text-accent-amber border border-accent-amber/30'
                : 'bg-highlight text-secondary hover:bg-highlight border border-subtle'
            }`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-danger text-primary text-[10px] font-bold rounded-full px-1">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* My Friends Tab */}
      {activeTab === 'friends' && (
        <div className="space-y-3">
          {friends.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted mx-auto mb-4" />
              <p className="text-muted mb-2">No friends yet</p>
              <p className="text-muted text-sm">Search by email or add from the Community leaderboard!</p>
            </div>
          ) : (
            friends.map(friend => (
              <div key={friend.friendUid} className="bg-highlight rounded-2xl p-4 border border-subtle flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-amber to-accent-teal flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-primary">{friend.friendName || 'Anonymous'}</div>
                    <div className="text-sm text-muted">{friend.friendEmail}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getShowsTogether && (
                    <Tip text="Shows together">
                      <button
                        onClick={() => setShowingTogetherWith({ uid: friend.friendUid, name: friend.friendName || 'Friend' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-teal-glow hover:bg-accent-teal-glow text-accent-teal border border-accent-teal/30 rounded-xl text-xs font-medium transition-colors"
                      >
                        <Music className="w-3.5 h-3.5" />
                        Shows Together
                      </button>
                    </Tip>
                  )}
                  <Tip text="Remove friend">
                    <button
                      onClick={() => onRemoveFriend(friend.friendUid)}
                      className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </Tip>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Bulk Accept Bar */}
          {totalPendingItems > 0 && (
            <div className="bg-highlight rounded-2xl p-4 border border-subtle">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-secondary">
                  {totalPendingItems} pending show{totalPendingItems !== 1 ? 's' : ''} to review
                </span>
                <button
                  onClick={() => setBulkConfirm({ type: 'all' })}
                  className="px-3 py-1.5 bg-accent-amber-glow text-accent-amber rounded-lg text-sm font-medium hover:bg-accent-amber/30 transition-colors"
                >
                  <Check className="w-4 h-4 inline mr-1" />
                  Accept All ({totalPendingItems})
                </button>
              </div>
              {friendGroupKeys.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {friendGroupKeys.map(uid => {
                    const g = friendGroups[uid];
                    const count = g.tags.length + g.suggestions.length;
                    return (
                      <button
                        key={uid}
                        onClick={() => setBulkConfirm({ type: 'friend', friendUid: uid, friendName: g.name })}
                        className="px-3 py-1.5 bg-highlight text-secondary rounded-lg text-xs font-medium hover:bg-highlight transition-colors border border-subtle"
                      >
                        {g.name} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Incoming Friend Requests */}
          {pendingFriendRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-3">Friend Requests</h3>
              <div className="space-y-3">
                {pendingFriendRequests.map(req => (
                  <div key={req.id} className="bg-highlight rounded-2xl p-4 border border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-teal to-accent-teal flex items-center justify-center">
                        <UserPlus className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-primary">{req.fromName || 'Someone'}</div>
                        <div className="text-sm text-muted">{req.fromEmail}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onAcceptFriendRequest(req.id)}
                        className="px-3 py-1.5 bg-accent-amber-glow text-accent-amber rounded-lg text-sm font-medium hover:bg-accent-amber/30 transition-colors"
                      >
                        <UserCheck className="w-4 h-4 inline mr-1" />
                        Accept
                      </button>
                      <button
                        onClick={() => onDeclineFriendRequest(req.id)}
                        className="px-3 py-1.5 bg-highlight text-secondary rounded-lg text-sm font-medium hover:bg-highlight transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Show Tags */}
          {pendingShowTags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-3">Show Tags</h3>
              <div className="space-y-3">
                {pendingShowTags.map(tag => (
                  <div key={tag.id} className="bg-highlight rounded-2xl p-4 border border-subtle">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-4 h-4 text-accent-amber" />
                      <span className="text-secondary text-sm">
                        <span className="font-medium text-primary">{tag.fromName}</span> tagged you at a show
                      </span>
                    </div>
                    <div className="bg-highlight rounded-xl p-3 mb-3">
                      <div className="font-medium" style={{ color: '#f59e0b' }}>{tag.showData?.artist}</div>
                      <div className="flex items-center gap-2 text-sm text-secondary mt-1">
                        <Calendar className="w-3.5 h-3.5 text-muted" />
                        <span>{formatDate(tag.showData?.date)}</span>
                        <span className="text-muted">&middot;</span>
                        <MapPin className="w-3.5 h-3.5 text-muted" />
                        <span>{tag.showData?.venue}{tag.showData?.city ? `, ${tag.showData.city}` : ''}</span>
                      </div>
                      {tag.showData?.setlist?.length > 0 && (
                        <div className="text-xs text-muted mt-2">
                          <Music className="w-3 h-3 inline mr-1" />
                          {tag.showData.setlist.length} songs in setlist
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onAcceptShowTag(tag.id)}
                        className="px-3 py-1.5 bg-accent-amber-glow text-accent-amber rounded-lg text-sm font-medium hover:bg-accent-amber/30 transition-colors"
                      >
                        <Check className="w-4 h-4 inline mr-1" />
                        Add to My Shows
                      </button>
                      <button
                        onClick={() => onDeclineShowTag(tag.id)}
                        className="px-3 py-1.5 bg-highlight text-secondary rounded-lg text-sm font-medium hover:bg-highlight transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show Suggestions */}
          {pendingSuggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-3">Were You There Together?</h3>
              <div className="space-y-3">
                {pendingSuggestions.map(s => {
                  const otherUid = s.participants?.find(p => p !== user?.uid);
                  const otherName = otherUid ? s.names?.[otherUid] : 'A friend';
                  return (
                    <div key={s.id} className="bg-highlight rounded-2xl p-4 border border-subtle">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-accent-teal" />
                        <span className="text-secondary text-sm">
                          <span className="font-medium text-primary">{otherName}</span> may have been at this show with you
                        </span>
                      </div>
                      <div className="bg-highlight rounded-xl p-3 mb-3">
                        <div className="font-medium" style={{ color: '#f59e0b' }}>{s.showData?.artist}</div>
                        <div className="flex items-center gap-2 text-sm text-secondary mt-1">
                          <Calendar className="w-3.5 h-3.5 text-muted" />
                          <span>{formatDate(s.showData?.date)}</span>
                          {s.showData?.venue && (
                            <>
                              <span className="text-muted">&middot;</span>
                              <MapPin className="w-3.5 h-3.5 text-muted" />
                              <span>{s.showData.venue}{s.showData?.city ? `, ${s.showData.city}` : ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => respondToSuggestion && respondToSuggestion(s, 'confirmed')}
                          className="px-3 py-1.5 bg-accent-teal-glow text-accent-teal rounded-lg text-sm font-medium hover:bg-accent-amber/30 transition-colors"
                        >
                          <Check className="w-4 h-4 inline mr-1" />
                          Yes, I was there!
                        </button>
                        <button
                          onClick={() => respondToSuggestion && respondToSuggestion(s, 'declined')}
                          className="px-3 py-1.5 bg-highlight text-secondary rounded-lg text-sm font-medium hover:bg-highlight transition-colors"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Waiting for friend to confirm */}
          {partialSuggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-3">Waiting for Confirmation</h3>
              <div className="space-y-3">
                {partialSuggestions.map(s => {
                  const otherUid = s.participants?.find(p => p !== user?.uid);
                  const otherName = otherUid ? s.names?.[otherUid] : 'Your friend';
                  return (
                    <div key={s.id} className="bg-highlight rounded-2xl p-4 border border-accent-amber/10">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-accent-amber" />
                        <span className="text-secondary text-sm">
                          Waiting for <span className="font-medium text-primary">{otherName}</span> to confirm
                        </span>
                      </div>
                      <div className="bg-highlight rounded-xl p-3">
                        <div className="font-medium" style={{ color: '#f59e0b' }}>{s.showData?.artist}</div>
                        <div className="flex items-center gap-2 text-sm text-secondary mt-1">
                          <Calendar className="w-3.5 h-3.5 text-muted" />
                          <span>{formatDate(s.showData?.date)}</span>
                          {s.showData?.venue && (
                            <>
                              <span className="text-muted">&middot;</span>
                              <MapPin className="w-3.5 h-3.5 text-muted" />
                              <span>{s.showData.venue}{s.showData?.city ? `, ${s.showData.city}` : ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sent Requests */}
          {sentFriendRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-3">Sent Requests</h3>
              <div className="space-y-3">
                {sentFriendRequests.map(req => (
                  <div key={req.id} className="bg-highlight rounded-2xl p-4 border border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-highlight flex items-center justify-center">
                        <Send className="w-4 h-4 text-muted" />
                      </div>
                      <div>
                        <div className="font-medium text-secondary">{req.toName || req.toEmail || 'Unknown'}</div>
                        <div className="text-sm text-muted">Pending</div>
                      </div>
                    </div>
                    <span className="text-xs text-accent-amber/60 bg-accent-amber-glow px-2 py-1 rounded-full">Awaiting response</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingFriendRequests.length === 0 && pendingShowTags.length === 0 && sentFriendRequests.length === 0 && pendingSuggestions.length === 0 && partialSuggestions.length === 0 && (
            <div className="text-center py-12 text-muted">
              <Check className="w-12 h-12 text-muted mx-auto mb-4" />
              <p>No pending requests or tags</p>
            </div>
          )}
        </div>
      )}

      {/* Find Friends Tab */}
      {activeTab === 'find' && (
        <div>
          <div className="bg-highlight backdrop-blur-xl border border-subtle rounded-2xl p-6">
            <h3 className="text-primary font-medium mb-4">Search by email</h3>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="Enter your friend's email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
                  className="w-full pl-11 pr-4 py-2.5 bg-highlight border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-amber/50 text-primary placeholder-muted"
                />
              </div>
              <button
                onClick={handleSendRequest}
                disabled={sending || !searchEmail.trim()}
                className={`px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                  sending || !searchEmail.trim()
                    ? 'bg-highlight text-muted cursor-not-allowed'
                    : 'bg-gradient-to-r from-accent-amber to-accent-teal hover:from-accent-amber hover:to-accent-teal text-primary shadow-lg shadow-accent-amber/20'
                }`}
              >
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
            <p className="text-muted text-sm mt-3">
              You can also add friends from the <span className="text-accent-amber">Community</span> leaderboard
            </p>
          </div>
        </div>
      )}

      {/* Invites Tab */}
      {activeTab === 'invites' && (
        <div className="space-y-4">
          {/* Summary stat */}
          {inviteStats && (
            <div className="flex items-center gap-2 text-sm text-secondary bg-highlight rounded-xl px-4 py-3 border border-subtle">
              <Mail className="w-4 h-4 text-muted flex-shrink-0" />
              <span>
                You've invited <span className="text-secondary font-medium">{inviteStats.total}</span> {inviteStats.total === 1 ? 'person' : 'people'} —{' '}
                <span className="text-accent-amber font-medium">{inviteStats.accepted}</span> {inviteStats.accepted === 1 ? 'has' : 'have'} joined
              </span>
            </div>
          )}

          {inviteList.length === 0 ? (
            <div className="text-center py-12">
              <Send className="w-12 h-12 text-muted mx-auto mb-4" />
              <p className="text-muted mb-1">No pending invites</p>
              <p className="text-muted text-sm">Invite your friends from the <span className="text-accent-amber">Invite</span> page!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inviteList
                .slice()
                .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
                .map(invite => {
                  const expired = isExpired(invite);
                  const isResending = resendingIds.has(invite.id);
                  const sentTs = invite.lastSentAt || invite.createdAt;
                  const originalTs = invite.createdAt;
                  const wasResent = !!invite.lastSentAt;
                  return (
                    <div
                      key={invite.id}
                      className={`bg-highlight rounded-2xl p-4 border transition-all ${
                        expired ? 'border-subtle opacity-60' : 'border-subtle'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="font-medium text-primary truncate">{invite.inviteeEmail}</div>
                          <div className="text-xs text-muted mt-0.5">
                            {wasResent ? (
                              <>Last resent {timeAgo(sentTs)} &middot; Originally sent {timeAgo(originalTs)}</>
                            ) : (
                              <>Sent {timeAgo(originalTs)}</>
                            )}
                          </div>
                        </div>
                        <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          expired
                            ? 'bg-accent-amber-glow text-accent-amber border border-accent-amber/20'
                            : 'bg-accent-amber-glow text-accent-amber border border-accent-amber/20'
                        }`}>
                          {expired ? 'Expired' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResend(invite)}
                          disabled={isResending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-amber-glow hover:bg-accent-amber/25 text-accent-amber border border-accent-amber/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {isResending
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <Send className="w-3.5 h-3.5" />
                          }
                          {isResending ? 'Sending...' : 'Resend Invite'}
                        </button>
                        <button
                          onClick={() => onCancelInvite && onCancelInvite(invite.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-highlight hover:bg-danger/10 text-muted hover:text-danger border border-subtle hover:border-danger/20 rounded-lg text-xs font-medium transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
      {/* Bulk Accept Confirmation Modal */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !bulkProcessing && setBulkConfirm(null)}>
          <div className="bg-surface border border-subtle rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-primary mb-2">Accept Shows</h3>
            <p className="text-secondary text-sm mb-6">
              {bulkConfirm.type === 'all'
                ? `Accept all ${totalPendingItems} pending show${totalPendingItems !== 1 ? 's' : ''}? They'll be added to your collection.`
                : `Accept all ${(friendGroups[bulkConfirm.friendUid]?.tags.length || 0) + (friendGroups[bulkConfirm.friendUid]?.suggestions.length || 0)} pending show${((friendGroups[bulkConfirm.friendUid]?.tags.length || 0) + (friendGroups[bulkConfirm.friendUid]?.suggestions.length || 0)) !== 1 ? 's' : ''} from ${bulkConfirm.friendName}?`
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkConfirm(null)}
                disabled={bulkProcessing}
                className="px-4 py-2 bg-highlight text-secondary rounded-xl text-sm font-medium hover:bg-highlight transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkConfirm}
                disabled={bulkProcessing}
                className="px-4 py-2 bg-accent-amber-glow text-accent-amber rounded-xl text-sm font-medium hover:bg-accent-amber/30 transition-colors disabled:opacity-50"
              >
                {bulkProcessing ? 'Accepting...' : 'Accept All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FriendsView;
