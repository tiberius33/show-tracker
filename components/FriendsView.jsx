'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Music, Calendar, MapPin, Check, Users, ChevronLeft, User, Send, Mail, UserPlus, UserCheck, UserX, Tag, RefreshCw, X, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Button, Card, Badge } from '@/components/ui';
import Input from '@/components/ui/Input';
import Tip from '@/components/ui/Tip';
import ShowsTogetherView from '@/components/ShowsTogetherView';

function FriendsView({
  user, friends, pendingFriendRequests, sentFriendRequests, pendingShowTags,
  onSendFriendRequestByEmail, onSendFriendRequest, onAcceptFriendRequest,
  onDeclineFriendRequest, onRemoveFriend, onAcceptShowTag, onDeclineShowTag,
  initialTab, getShowsTogether, showSuggestions, respondToSuggestion,
  pendingInvites, sentPendingEmailTags, inviteStats, onResendInvite, onCancelInvite,
  onBulkAcceptAll, onBulkAcceptFromFriend,
  // Show interaction handlers for ShowsTogetherView
  onAddSong, onRateSong, onCommentSong, onDeleteSong, onRateShow, onCommentShow, onBatchRate,
  onTagFriends, onRateVenue, confirmedSuggestions, normalizeShowKey,
  sharedComments, commentsLoading, memoriesShow, onOpenMemories, onAddComment, onEditComment, onDeleteComment,
  allShows
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
        allShows={allShows}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-primary mb-2">Friends</h1>
      <p className="text-secondary mb-6">Connect with friends and tag them at shows</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: 'friends', label: `My Friends (${friends.length})`, badge: 0 },
          { id: 'requests', label: 'Requests', badge: requestCount },
          { id: 'find', label: 'Find Friends', badge: 0 },
          { id: 'invites', label: 'Invites', badge: inviteList.length + (sentPendingEmailTags || []).length },
        ].map(tab => (
          <Button
            key={tab.id}
            size="sm"
            variant="ghost"
            onClick={() => setActiveTab(tab.id)}
            className={`relative ${activeTab === tab.id ? 'bg-brand-subtle text-brand border border-brand/30' : 'text-secondary border border-subtle'}`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-danger text-on-dark text-[10px] font-bold rounded-full px-1">
                {tab.badge}
              </span>
            )}
          </Button>
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
              <Card key={friend.friendUid} padding="none" className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-amber flex items-center justify-center">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Music}
                        onClick={() => setShowingTogetherWith({ uid: friend.friendUid, name: friend.friendName || 'Friend' })}
                        className="bg-amber-subtle text-amber border border-amber/30 hover:bg-amber/20"
                      >
                        Shows Together
                      </Button>
                    </Tip>
                  )}
                  <Tip text="Remove friend">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={UserX}
                      onClick={() => onRemoveFriend(friend.friendUid)}
                      className="text-muted hover:text-danger hover:bg-danger/10"
                    />
                  </Tip>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Bulk Accept Bar */}
          {totalPendingItems > 0 && (
            <Card padding="none" className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-secondary">
                  {totalPendingItems} pending show{totalPendingItems !== 1 ? 's' : ''} to review
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Check}
                  onClick={() => setBulkConfirm({ type: 'all' })}
                  className="bg-brand-subtle text-brand hover:bg-brand/30"
                >
                  Accept All ({totalPendingItems})
                </Button>
              </div>
              {friendGroupKeys.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {friendGroupKeys.map(uid => {
                    const g = friendGroups[uid];
                    const count = g.tags.length + g.suggestions.length;
                    return (
                      <Button
                        key={uid}
                        size="sm"
                        variant="secondary"
                        onClick={() => setBulkConfirm({ type: 'friend', friendUid: uid, friendName: g.name })}
                      >
                        {g.name} ({count})
                      </Button>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Incoming Friend Requests */}
          {pendingFriendRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-3">Friend Requests</h3>
              <div className="space-y-3">
                {pendingFriendRequests.map(req => (
                  <Card key={req.id} padding="none" className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber to-amber flex items-center justify-center">
                        <UserPlus className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-primary">{req.fromName || 'Someone'}</div>
                        <div className="text-sm text-muted">{req.fromEmail}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" icon={UserCheck} onClick={() => onAcceptFriendRequest(req.id)} className="bg-brand-subtle text-brand hover:bg-brand/30">Accept</Button>
                      <Button variant="ghost" size="sm" onClick={() => onDeclineFriendRequest(req.id)}>Decline</Button>
                    </div>
                  </Card>
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
                  <Card key={tag.id} padding="none" className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-4 h-4 text-brand" />
                      <span className="text-secondary text-sm">
                        <span className="font-medium text-primary">{tag.fromName}</span> tagged you at a show
                      </span>
                    </div>
                    <div className="bg-hover rounded-xl p-3 mb-3">
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
                      <Button variant="primary" size="sm" icon={Check} onClick={() => onAcceptShowTag(tag.id)}>Add to My Shows</Button>
                      <Button variant="ghost" size="sm" onClick={() => onDeclineShowTag(tag.id)}>Decline</Button>
                    </div>
                  </Card>
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
                    <Card key={s.id} padding="none" className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-amber" />
                        <span className="text-secondary text-sm">
                          <span className="font-medium text-primary">{otherName}</span> may have been at this show with you
                        </span>
                      </div>
                      <div className="bg-hover rounded-xl p-3 mb-3">
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
                        <Button variant="ghost" size="sm" icon={Check} onClick={() => respondToSuggestion && respondToSuggestion(s, 'confirmed')} className="bg-amber-subtle text-amber hover:bg-amber/20">Yes, I was there!</Button>
                        <Button variant="ghost" size="sm" onClick={() => respondToSuggestion && respondToSuggestion(s, 'declined')}>No</Button>
                      </div>
                    </Card>
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
                    <div key={s.id} className="bg-hover rounded-2xl p-4 border border-brand/10">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-brand" />
                        <span className="text-secondary text-sm">
                          Waiting for <span className="font-medium text-primary">{otherName}</span> to confirm
                        </span>
                      </div>
                      <div className="bg-hover rounded-xl p-3">
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
                  <Card key={req.id} padding="none" className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-hover flex items-center justify-center">
                        <Send className="w-4 h-4 text-muted" />
                      </div>
                      <div>
                        <div className="font-medium text-secondary">{req.toName || req.toEmail || 'Unknown'}</div>
                        <div className="text-sm text-muted">Pending</div>
                      </div>
                    </div>
                    <Badge tone="green" size="sm">Awaiting response</Badge>
                  </Card>
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
          <Card padding="md">
            <h3 className="text-primary font-medium mb-4">Search by email</h3>
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="Enter your friend's email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
                icon={Mail}
                className="flex-1"
              />
              <Button
                variant="primary"
                onClick={handleSendRequest}
                disabled={sending || !searchEmail.trim()}
                loading={sending}
              >
                {sending ? 'Sending...' : 'Send Request'}
              </Button>
            </div>
            <p className="text-muted text-sm mt-3">
              You can also add friends from the <span className="text-brand">Community</span> leaderboard
            </p>
          </Card>
        </div>
      )}

      {/* Invites Tab */}
      {activeTab === 'invites' && (
        <div className="space-y-4">
          {/* Summary stat */}
          {inviteStats && (
            <div className="flex items-center gap-2 text-sm text-secondary bg-hover rounded-xl px-4 py-3 border border-subtle">
              <Mail className="w-4 h-4 text-muted flex-shrink-0" />
              <span>
                You've invited <span className="text-secondary font-medium">{inviteStats.total}</span> {inviteStats.total === 1 ? 'person' : 'people'} —{' '}
                <span className="text-brand font-medium">{inviteStats.accepted}</span> {inviteStats.accepted === 1 ? 'has' : 'have'} joined
              </span>
            </div>
          )}

          {inviteList.length === 0 ? (
            <div className="text-center py-12">
              <Send className="w-12 h-12 text-muted mx-auto mb-4" />
              <p className="text-muted mb-1">No pending invites</p>
              <p className="text-muted text-sm">Invite your friends from the <span className="text-brand">Invite</span> page!</p>
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
                    <Card
                      key={invite.id}
                      padding="none"
                      className={`p-4 transition-all ${expired ? 'opacity-60' : ''}`}
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
                        <Badge tone="neutral" size="sm">{expired ? 'Expired' : 'Pending'}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={isResending ? RefreshCw : Send}
                          onClick={() => handleResend(invite)}
                          disabled={isResending}
                          loading={isResending}
                          className="bg-brand-subtle text-brand hover:bg-brand/25 border border-brand/20"
                        >
                          {isResending ? 'Sending...' : 'Resend Invite'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={X}
                          onClick={() => onCancelInvite && onCancelInvite(invite.id)}
                          className="text-muted hover:text-danger hover:bg-danger/10 hover:border-danger/20"
                        >
                          Cancel
                        </Button>
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}

          {/* Pending Email Tags (shows tagged to non-members) */}
          {(sentPendingEmailTags || []).length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
                <Tag className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Tagged Shows — Waiting to Join
              </h3>
              <div className="space-y-3">
                {Object.entries(
                  (sentPendingEmailTags || []).reduce((acc, tag) => {
                    const email = tag.toEmail || 'unknown';
                    if (!acc[email]) acc[email] = { name: tag.toName || email, tags: [] };
                    acc[email].tags.push(tag);
                    return acc;
                  }, {})
                ).map(([email, { name, tags }]) => (
                  <Card key={email} padding="none" className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="font-medium text-primary truncate">{name}</div>
                        <div className="text-xs text-muted">{email}</div>
                      </div>
                      <Badge tone="amber" size="sm">Awaiting Signup</Badge>
                    </div>
                    <div className="space-y-1.5 mt-3">
                      {tags.map(tag => (
                        <div key={tag.id} className="flex items-center gap-2 text-sm text-secondary">
                          <Music className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                          <span className="truncate">
                            {tag.showData?.artist}
                            {tag.showData?.venue && <span className="text-muted"> — {tag.showData.venue}</span>}
                          </span>
                          {tag.showData?.date && (
                            <span className="text-xs text-muted flex-shrink-0">{formatDate(tag.showData.date)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted mt-2">
                      {tags.length} show{tags.length !== 1 ? 's' : ''} tagged — invitation sent
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Bulk Accept Confirmation Modal */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-sidebar/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !bulkProcessing && setBulkConfirm(null)}>
          <div className="bg-surface border border-subtle rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-primary mb-2">Accept Shows</h3>
            <p className="text-secondary text-sm mb-6">
              {bulkConfirm.type === 'all'
                ? `Accept all ${totalPendingItems} pending show${totalPendingItems !== 1 ? 's' : ''}? They'll be added to your collection.`
                : `Accept all ${(friendGroups[bulkConfirm.friendUid]?.tags.length || 0) + (friendGroups[bulkConfirm.friendUid]?.suggestions.length || 0)} pending show${((friendGroups[bulkConfirm.friendUid]?.tags.length || 0) + (friendGroups[bulkConfirm.friendUid]?.suggestions.length || 0)) !== 1 ? 's' : ''} from ${bulkConfirm.friendName}?`
              }
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setBulkConfirm(null)}
                disabled={bulkProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleBulkConfirm}
                disabled={bulkProcessing}
                loading={bulkProcessing}
              >
                {bulkProcessing ? 'Accepting...' : 'Accept All'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FriendsView;
