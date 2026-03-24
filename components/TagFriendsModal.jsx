'use client';

import React, { useState } from 'react';
import { Calendar, MapPin, Check, Search, ChevronLeft, Users, Send, RefreshCw, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';

function TagFriendsModal({ show, shows: bulkShows, friends, onTag, onInviteByEmail, onClose }) {
  const isBulk = Array.isArray(bulkShows) && bulkShows.length > 0;
  const displayShow = isBulk ? bulkShows[0] : show;
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  // invite sub-form state
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteStatus, setInviteStatus] = useState(null); // null | 'success' | 'error'

  const normalizedQuery = query.trim().toLowerCase();
  const filteredFriends = normalizedQuery
    ? friends.filter(f =>
        (f.friendName || '').toLowerCase().includes(normalizedQuery) ||
        (f.friendEmail || '').toLowerCase().includes(normalizedQuery)
      )
    : friends;

  const showInvitePrompt = normalizedQuery.length > 0 && filteredFriends.length === 0;

  const toggleFriend = (uid) => {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleTag = async () => {
    setSending(true);
    await onTag([...selectedFriends]);
    setSending(false);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteSending(true);
    setInviteStatus(null);
    try {
      await onInviteByEmail({ name: query.trim(), email: inviteEmail.trim(), message: inviteMessage.trim(), show: displayShow });
      setInviteStatus('success');
      setInviteEmail('');
      setInviteMessage('');
    } catch {
      setInviteStatus('error');
    } finally {
      setInviteSending(false);
    }
  };

  return (
    <div className="fixed inset-0 md:left-64 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-elevated border border-subtle rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-subtle">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-primary">Tag Friends</h2>
            <button onClick={onClose} className="p-3 text-muted hover:text-primary hover:bg-hover active:bg-hover rounded-xl transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          {isBulk ? (
            <div className="bg-hover rounded-xl p-3">
              <div className="font-medium text-brand">{bulkShows.length} shows selected</div>
              <div className="text-xs text-secondary mt-1 max-h-20 overflow-y-auto space-y-0.5">
                {bulkShows.map(s => (
                  <div key={s.id}>{s.artist} &middot; {formatDate(s.date)} &middot; {s.venue}</div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-hover rounded-xl p-3">
              <div className="font-medium" style={{ color: '#f59e0b' }}>{show.artist}</div>
              <div className="flex items-center gap-2 text-sm text-secondary mt-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(show.date)}</span>
                <span className="text-muted">&middot;</span>
                <MapPin className="w-3.5 h-3.5" />
                <span>{show.venue}</span>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search input */}
          {!inviteMode && (
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search friends by name or email..."
                className="w-full pl-9 pr-4 py-2.5 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary text-sm placeholder-muted"
              />
            </div>
          )}

          {/* Invite sub-form */}
          {inviteMode && (
            <div>
              <button
                onClick={() => { setInviteMode(false); setInviteStatus(null); }}
                className="flex items-center gap-1.5 text-secondary hover:text-primary text-sm mb-4 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back to friend list
              </button>
              <p className="text-secondary text-sm mb-3">
                Send <span className="text-primary font-medium">{query.trim()}</span> an invite to join mysetlists.net, with this show included.
              </p>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="friend@example.com"
                className="w-full px-4 py-2.5 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary text-sm placeholder-muted mb-3"
              />
              <textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Add a personal note... (optional)"
                rows={3}
                className="w-full px-4 py-2.5 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary text-sm placeholder-muted resize-none mb-3"
              />
              {inviteStatus === 'success' && (
                <div className="flex items-center gap-2 text-brand text-sm font-medium mb-3">
                  <Check className="w-4 h-4" /> Invite sent! They'll get an email with the show details.
                </div>
              )}
              {inviteStatus === 'error' && (
                <div className="text-danger text-sm mb-3">Something went wrong. Please try again.</div>
              )}
              <button
                onClick={handleSendInvite}
                disabled={!inviteEmail.trim() || inviteSending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {inviteSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {inviteSending ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          )}

          {/* Selected friend chips */}
          {!inviteMode && selectedFriends.size > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {[...selectedFriends].map(uid => {
                const f = friends.find(fr => fr.friendUid === uid);
                return f ? (
                  <span key={uid} className="flex items-center gap-1.5 px-3 py-1 bg-brand-subtle border border-brand/30 rounded-full text-brand text-xs font-medium">
                    {f.friendName || 'Friend'}
                    <button onClick={() => toggleFriend(uid)} className="text-brand/60 hover:text-brand">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}

          {/* Friend list / invite prompt */}
          {!inviteMode && (
            <>
              {friends.length === 0 && !normalizedQuery ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-muted mx-auto mb-3" />
                  <p className="text-muted text-sm">Add friends first from the Friends page!</p>
                </div>
              ) : showInvitePrompt ? (
                <div className="text-center py-6">
                  <p className="text-secondary text-sm mb-3">
                    <span className="text-primary font-medium">{query.trim()}</span> isn't on mysetlists.net yet.
                  </p>
                  <button
                    onClick={() => { setInviteMode(true); setInviteStatus(null); }}
                    className="flex items-center gap-2 mx-auto px-4 py-2.5 bg-brand-subtle hover:bg-brand/30 text-brand border border-brand/30 rounded-xl font-medium text-sm transition-colors"
                  >
                    <Send className="w-4 h-4" /> Invite {query.trim()}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-secondary mb-3">{isBulk ? `Select friends to tag in ${bulkShows.length} shows:` : 'Select friends who were at this show:'}</p>
                  {filteredFriends.map(friend => (
                    <label
                      key={friend.friendUid}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        selectedFriends.has(friend.friendUid)
                          ? 'bg-brand-subtle border border-brand/30'
                          : 'bg-hover border border-subtle hover:bg-hover'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFriends.has(friend.friendUid)}
                        onChange={() => toggleFriend(friend.friendUid)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                        selectedFriends.has(friend.friendUid)
                          ? 'bg-brand border-brand'
                          : 'border-active'
                      }`}>
                        {selectedFriends.has(friend.friendUid) && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <div>
                        <div className="font-medium text-primary text-sm">{friend.friendName || 'Anonymous'}</div>
                        <div className="text-xs text-muted">{friend.friendEmail}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer -- tag button (only shown in list mode with selections) */}
        {!inviteMode && selectedFriends.size > 0 && (
          <div className="p-6 border-t border-subtle flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleTag}
              disabled={sending}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary shadow-lg shadow-brand/20 disabled:opacity-50"
            >
              {sending ? 'Tagging...' : isBulk
                ? `Tag ${selectedFriends.size} Friend${selectedFriends.size !== 1 ? 's' : ''} in ${bulkShows.length} Shows \u2192`
                : `Tag ${selectedFriends.size} Friend${selectedFriends.size !== 1 ? 's' : ''} at This Show \u2192`
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TagFriendsModal;
