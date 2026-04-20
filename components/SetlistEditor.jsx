'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Star, Tag, Share2, Check, Plus, MessageSquare, User, Users, ChevronDown, Send, ListMusic, Heart, Hash } from 'lucide-react';
import { formatDate, artistColor } from '@/lib/utils';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import RatingSelect from '@/components/ui/RatingSelect';
import Tip from '@/components/ui/Tip';
import UpcomingShows from '@/components/UpcomingShows';
import EntityInfoPanel from '@/components/EntityInfoPanel';
import SongHistoryModal from '@/components/SongHistoryModal';
import StreamingLinks from '@/components/StreamingLinks';

function SetlistEditor({ show, allShows, onAddSong, onRateSong, onCommentSong, onDeleteSong, onRateShow, onCommentShow, onBatchRate, onClose, onCreatePlaylist, onTagFriends, onRateVenue, onToggleFavoriteArtist, isArtistFavorite, confirmedSuggestion, sharedComments, commentsLoading, onOpenMemories, onAddComment, onEditComment, onDeleteComment, currentUserUid, friendAnnotations, commentContext, isReturningUser }) {
  const [songName, setSongName] = useState('');
  const [batchRating, setBatchRating] = useState(5);
  const [editingComment, setEditingComment] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [editingShowComment, setEditingShowComment] = useState(false);
  const [showCommentText, setShowCommentText] = useState(show.comment || '');
  const [shareSuccess, setShareSuccess] = useState(false);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [editingMemoryText, setEditingMemoryText] = useState('');
  const [showPlaylistTip, setShowPlaylistTip] = useState(false);
  const [showPlayCounts, setShowPlayCounts] = useState(() => {
    return storage.get(STORAGE_KEYS.SHOW_PLAY_COUNTS) === 'true';
  });
  const [songHistoryTarget, setSongHistoryTarget] = useState(null);
  const scrollableRef = useRef(null);

  // Pre-compute play counts for all songs in setlist
  const songPlayCounts = useMemo(() => {
    if (!allShows || !show.setlist?.length) return {};
    const artistShows = allShows.filter(s => s.artist === show.artist && s.id !== show.id);
    const counts = {};
    show.setlist.forEach(song => {
      const key = song.name.trim().toLowerCase();
      let count = 1; // current show counts as 1
      artistShows.forEach(s => {
        if ((s.setlist || []).some(ss => ss.name.trim().toLowerCase() === key)) {
          count++;
        }
      });
      counts[song.id] = count;
    });
    return counts;
  }, [allShows, show.artist, show.setlist, show.id]);

  const togglePlayCounts = () => {
    const newValue = !showPlayCounts;
    setShowPlayCounts(newValue);
    storage.set(STORAGE_KEYS.SHOW_PLAY_COUNTS, String(newValue));
  };

  // Show playlist tooltip for new users who haven't seen it yet
  useEffect(() => {
    // Suppress for returning users (account ≥ 7 days) — fixes mobile tooltip bug
    if (isReturningUser) return;
    if (show.setlist?.length > 0 && onCreatePlaylist) {
      const seen = storage.get(STORAGE_KEYS.PLAYLIST_TOOLTIP_SEEN);
      if (!seen) {
        const timer = setTimeout(() => setShowPlaylistTip(true), 600);
        return () => clearTimeout(timer);
      }
    }
  }, [show.setlist, onCreatePlaylist, isReturningUser]);

  // Scroll to comment when opened from Profile > Comments
  useEffect(() => {
    if (!commentContext) return;
    const timer = setTimeout(() => {
      const container = scrollableRef.current;
      if (!container) return;

      let target = null;
      if (commentContext.type === 'song' && commentContext.songName) {
        // Find the song element by data attribute
        target = container.querySelector(`[data-song-name="${CSS.escape(commentContext.songName)}"]`);
      } else if (commentContext.type === 'show') {
        // Scroll to show comment/notes section at the top
        target = container.querySelector('[data-show-comment]');
      }

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('highlight-comment');
        setTimeout(() => target.classList.remove('highlight-comment'), 2500);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [commentContext]);

  const dismissPlaylistTip = () => {
    setShowPlaylistTip(false);
    storage.set(STORAGE_KEYS.PLAYLIST_TOOLTIP_SEEN, '1');
  };

  const handleShare = async () => {
    const setlistText = show.setlist.map((song, i) => `${i + 1}. ${song.name}${song.rating ? ` (${song.rating}/10)` : ''}`).join('\n');
    const shareText = `${show.artist} @ ${show.venue}${show.city ? `, ${show.city}` : ''}\n${formatDate(show.date)}${show.tour ? `\n${show.tour}` : ''}\n\nSetlist:\n${setlistText}\n\nTracked with MySetlists.net`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${show.artist} - ${formatDate(show.date)}`,
          text: shareText,
        });
      } catch (err) {
        // User cancelled or share failed, try clipboard
        copyToClipboard(shareText);
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleAddSong = (e) => {
    e.preventDefault();
    if (songName.trim()) {
      onAddSong({ name: songName.trim() });
      setSongName('');
    }
  };

  const startEditComment = (song) => {
    setEditingComment(song.id);
    setCommentText(song.comment || '');
  };

  const saveComment = (songId) => {
    onCommentSong(songId, commentText.trim());
    setEditingComment(null);
    setCommentText('');
  };

  const unratedCount = show.setlist.filter(s => !s.rating).length;

  // Build friend song annotations map if available
  const friendSongMap = useMemo(() => {
    if (!friendAnnotations?.friendShow?.setlist) return {};
    const map = {};
    friendAnnotations.friendShow.setlist.forEach(s => {
      const key = (s.name || '').trim().toLowerCase();
      if (key) map[key] = { rating: s.rating, comment: s.comment, name: s.name };
    });
    return map;
  }, [friendAnnotations]);

  return (
    <div className="fixed inset-0 md:left-64 bg-sidebar/50 backdrop-blur-xl flex items-end md:items-center justify-center md:p-4 z-[60]">
      <div className="bg-surface border border-subtle rounded-t-2xl md:rounded-3xl max-w-[100vw] sm:max-w-lg md:max-w-2xl w-full max-h-[92vh] md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Compact top bar with close, share, and tag */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-subtle bg-surface flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-lg md:text-2xl font-bold truncate" style={{ color: artistColor(show.artist) }}>{show.artist}</h2>
            {!show.isManual && (
              <span className="text-[10px] md:text-xs font-semibold bg-brand-subtle text-brand px-1.5 py-0.5 md:px-2 md:py-1 rounded-full flex-shrink-0">
                setlist.fm
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onToggleFavoriteArtist && (
              <Tip text={isArtistFavorite?.(show.artist) ? 'Remove from favorites' : 'Favorite this artist'} position="bottom">
                <button
                  onClick={() => onToggleFavoriteArtist(show.artist)}
                  className="p-3 rounded-xl text-secondary hover:text-red-400 hover:bg-hover active:bg-hover transition-colors"
                >
                  <Heart className={`w-6 h-6 ${isArtistFavorite?.(show.artist) ? 'text-red-500 fill-red-500' : ''}`} />
                </button>
              </Tip>
            )}
            {onRateVenue && show.venue && (
              <Tip text="Rate this venue" position="bottom">
                <button
                  onClick={() => onRateVenue(show)}
                  className="p-3 rounded-xl text-secondary hover:text-brand hover:bg-brand-subtle active:bg-brand-subtle transition-colors"
                >
                  <Star className="w-6 h-6" />
                </button>
              </Tip>
            )}
            {onTagFriends && (
              <Tip text="Tag friends at this show" position="bottom">
                <button
                  onClick={() => onTagFriends(show)}
                  className="p-3 rounded-xl text-secondary hover:text-primary hover:bg-hover active:bg-hover transition-colors"
                >
                  <Tag className="w-6 h-6" />
                </button>
              </Tip>
            )}
            <Tip text="Share setlist" position="bottom">
              <button
                onClick={handleShare}
                className={`p-3 rounded-xl transition-colors ${shareSuccess ? 'bg-brand-subtle text-brand' : 'text-secondary hover:text-primary hover:bg-hover active:bg-hover'}`}
              >
                {shareSuccess ? <Check className="w-6 h-6" /> : <Share2 className="w-6 h-6" />}
              </button>
            </Tip>
            {show.setlist?.length > 0 && onCreatePlaylist && (
              <div className="relative">
                <Tip text={showPlaylistTip ? '' : 'Create playlist'} position="bottom">
                  <button
                    onClick={() => {
                      dismissPlaylistTip();
                      onCreatePlaylist(show);
                    }}
                    className={`p-3 rounded-xl text-secondary hover:text-brand hover:bg-brand-subtle active:bg-brand-subtle transition-colors ${showPlaylistTip ? 'ring-2 ring-brand/60 ring-offset-2 ring-offset-base' : ''}`}
                  >
                    <ListMusic className="w-6 h-6" />
                  </button>
                </Tip>
                {showPlaylistTip && (
                  <>
                    {/* Desktop: tooltip below the button */}
                    <div className="hidden md:block absolute top-full mt-2 right-0 w-60 z-20 animate-in">
                      <div className="bg-brand border border-brand/30 rounded-xl p-3 shadow-xl shadow-brand/20 relative">
                        <div className="absolute -top-2 right-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-brand" />
                        <p className="text-primary text-xs leading-relaxed mb-2">
                          Create a Spotify or Apple Music playlist from this setlist with one tap!
                        </p>
                        <button onClick={dismissPlaylistTip} className="text-brand hover:text-primary text-xs font-medium transition-colors">Got it ✓</button>
                      </div>
                    </div>
                    {/* Mobile: tooltip below the button */}
                    <div className="md:hidden absolute top-full mt-2 right-0 w-56 z-20 animate-in-mobile">
                      <div className="bg-brand border border-brand/30 rounded-xl p-3 shadow-xl shadow-brand/20 relative">
                        <div className="absolute -top-2 right-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-brand" />
                        <p className="text-primary text-xs leading-relaxed mb-2">
                          Create a Spotify or Apple Music playlist from this setlist!
                        </p>
                        <button onClick={dismissPlaylistTip} className="text-brand hover:text-primary text-xs font-medium transition-colors">Got it ✓</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {allShows && show.setlist?.length > 0 && (
              <Tip text={showPlayCounts ? 'Hide play counts' : 'Show play counts'} position="bottom">
                <button
                  onClick={togglePlayCounts}
                  className={`p-3 rounded-xl transition-colors ${showPlayCounts ? 'bg-brand-subtle text-brand' : 'text-secondary hover:text-primary hover:bg-hover active:bg-hover'}`}
                >
                  <Hash className="w-6 h-6" />
                </button>
              </Tip>
            )}
            <button onClick={onClose} className="p-3 rounded-xl text-secondary hover:text-primary hover:bg-hover active:bg-hover transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scrollable content area with show info + setlist */}
        <div className="flex-1 overflow-y-auto" ref={scrollableRef}>
          {/* Show details */}
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-subtle bg-surface">
            <p className="text-secondary text-sm">
              {formatDate(show.date)} &middot; {show.venue}
              {show.city && `, ${show.city}`}
            </p>
            {show.tour && (
              <p className="text-brand text-sm font-medium mt-1">Tour: {show.tour}</p>
            )}
            <div className="mt-2">
              <RatingSelect value={show.rating} onChange={onRateShow} label="Show rating:" />
            </div>
            {!editingShowComment && (
              <div className="mt-2" data-show-comment>
                {show.comment ? (
                  <div
                    className="text-sm text-secondary italic bg-hover p-2.5 rounded-lg border border-subtle cursor-pointer hover:bg-hover transition-colors"
                    onClick={() => { setEditingShowComment(true); setShowCommentText(show.comment || ''); }}
                  >
                    <div className="flex items-start gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted" />
                      <span>{show.comment}</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingShowComment(true); setShowCommentText(''); }}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-hover text-muted hover:bg-hover hover:text-primary transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Add show note
                  </button>
                )}
              </div>
            )}
            {editingShowComment && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={showCommentText}
                  onChange={(e) => setShowCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { onCommentShow(showCommentText.trim()); setEditingShowComment(false); }
                  }}
                  placeholder="Add a note about this show..."
                  className="flex-1 px-3 py-2 bg-hover border border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary placeholder-muted"
                  autoFocus
                />
                <button
                  onClick={() => { onCommentShow(showCommentText.trim()); setEditingShowComment(false); }}
                  className="px-3 py-2 bg-brand hover:bg-brand text-on-dark rounded-lg text-xs font-medium transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingShowComment(false)}
                  className="px-3 py-2 bg-hover hover:bg-hover text-secondary rounded-lg text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Friend's show-level annotation */}
            {friendAnnotations && (friendAnnotations.friendShow?.comment || friendAnnotations.friendShow?.rating) && (
              <div className="mt-3 bg-amber-subtle border border-amber/20 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber to-amber flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3 h-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-amber">{friendAnnotations.friendName}</span>
                      {friendAnnotations.friendShow?.rating && (
                        <span className="text-[10px] bg-amber-subtle text-amber px-1.5 py-0.5 rounded-full font-semibold">
                          Rated {friendAnnotations.friendShow.rating}/10
                        </span>
                      )}
                    </div>
                    {friendAnnotations.friendShow?.comment && (
                      <p className="text-sm text-secondary italic mt-1">{friendAnnotations.friendShow.comment}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Wikipedia info panels */}
            <EntityInfoPanel name={show.artist} type="artist" />
            {show.venue && (
              <EntityInfoPanel name={show.venue} type="venue" city={show.city} />
            )}

            {/* Add song form */}
            <form onSubmit={handleAddSong} className="flex gap-3 mt-3">
              <input
                type="text"
                placeholder="Add song to setlist..."
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary placeholder-muted text-sm"
              />
              <button type="submit" className="px-4 py-2.5 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary rounded-xl transition-all shadow-lg shadow-brand/20">
                <Plus className="w-5 h-5" />
              </button>
            </form>

            {unratedCount > 0 && (
              <div className="flex items-center gap-3 mt-3 p-3 bg-hover border border-subtle rounded-xl">
                <span className="text-xs font-medium text-secondary">Rate {unratedCount} unrated:</span>
                <RatingSelect value={batchRating} onChange={(v) => setBatchRating(v || 5)} />
                <button
                  onClick={() => onBatchRate(batchRating)}
                  className="px-4 py-2 md:px-3 md:py-1.5 bg-brand hover:bg-brand text-on-dark rounded-lg text-sm md:text-xs font-medium transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          <div className="p-4 md:p-6 bg-surface/50">
          {show.setlist.length === 0 ? (
            <p className="text-center text-muted py-8 font-medium">No songs in setlist</p>
          ) : (
            <div className="space-y-3">
              {show.setlist.map((song, index) => (
                <React.Fragment key={song.id}>
                  {song.setBreak && (
                    <div className="text-brand font-semibold text-sm pt-3 pb-1 border-t border-subtle mt-3">
                      {song.setBreak}
                    </div>
                  )}
                  <div className="group bg-hover border border-subtle rounded-2xl p-4 hover:bg-hover transition-colors" data-song-name={song.name}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-muted font-mono text-sm mt-1">{index + 1}.</span>
                        <div className="flex-1 flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-medium text-primary ${allShows ? 'cursor-pointer hover:text-brand transition-colors' : ''}`}
                            onClick={() => allShows && setSongHistoryTarget(song.name)}
                          >
                            {song.name}
                          </span>
                          {song.cover && (
                            <span className="text-sm text-brand">({song.cover})</span>
                          )}
                          {showPlayCounts && allShows && (() => {
                            const count = songPlayCounts[song.id] || 1;
                            const isFirstTime = count === 1;
                            return (
                              <span
                                className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                                  isFirstTime
                                    ? 'bg-amber-subtle text-amber border border-amber/30'
                                    : 'bg-hover text-muted border border-subtle'
                                }`}
                                onClick={() => setSongHistoryTarget(song.name)}
                                title={isFirstTime ? 'First time seeing this!' : `Click to see song history`}
                              >
                                {count}x
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteSong(song.id)}
                        className="text-muted hover:text-danger transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 ml-8">
                      <RatingSelect value={song.rating} onChange={(v) => onRateSong(song.id, v)} label="Rating:" />
                      <button
                        onClick={() => startEditComment(song)}
                        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                          song.comment
                            ? 'bg-brand-subtle text-brand hover:bg-brand/30'
                            : 'bg-hover text-muted hover:bg-hover hover:text-primary'
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        {song.comment ? 'Edit note' : 'Add note'}
                      </button>
                    </div>
                    {song.comment && editingComment !== song.id && (
                      <div className="ml-8 mt-2 text-sm text-secondary italic bg-hover p-2.5 rounded-lg border border-subtle">
                        {song.comment}
                      </div>
                    )}
                    {editingComment === song.id && (
                      <div className="ml-8 mt-2 flex gap-2">
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveComment(song.id)}
                          placeholder="Add a note about this song..."
                          className="flex-1 px-3 py-2 bg-hover border border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary placeholder-muted"
                          autoFocus
                        />
                        <button
                          onClick={() => saveComment(song.id)}
                          className="px-3 py-2 bg-brand hover:bg-brand text-on-dark rounded-lg text-xs font-medium transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingComment(null)}
                          className="px-3 py-2 bg-hover hover:bg-hover text-secondary rounded-lg text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {/* Friend's song annotation */}
                    {(() => {
                      const fSong = friendSongMap[(song.name || '').trim().toLowerCase()];
                      if (!fSong || (!fSong.rating && !fSong.comment)) return null;
                      return (
                        <div className="ml-8 mt-2 bg-amber-subtle border border-amber/15 rounded-lg p-2.5">
                          <div className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber to-amber flex items-center justify-center flex-shrink-0 mt-0.5">
                              <User className="w-2.5 h-2.5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-semibold text-amber">{friendAnnotations.friendName}</span>
                                {fSong.rating && (
                                  <span className="text-[10px] bg-amber-subtle text-amber px-1.5 py-0.5 rounded-full font-semibold">
                                    {fSong.rating}/10
                                  </span>
                                )}
                              </div>
                              {fSong.comment && (
                                <p className="text-xs text-secondary italic mt-0.5">{fSong.comment}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
          <UpcomingShows artistName={show.artist} />

          <StreamingLinks show={show} />

          {/* Shared Memories (confirmed show together) */}
          {confirmedSuggestion && (() => {
            const otherUid = confirmedSuggestion.participants?.find(p => p !== currentUserUid);
            const otherName = otherUid ? confirmedSuggestion.names?.[otherUid] : 'A friend';
            return (
              <div className="mt-4 border-t border-amber/20 pt-4">
                {/* Attendance chip */}
                <button
                  onClick={() => {
                    if (!memoriesOpen && onOpenMemories) onOpenMemories();
                    setMemoriesOpen(prev => !prev);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/15 border border-amber/30 text-amber text-sm font-medium hover:bg-brand/25 transition-colors mb-3"
                >
                  <Users className="w-4 h-4" />
                  You and {otherName} were both here
                  <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${memoriesOpen ? 'rotate-180' : ''}`} />
                </button>

                {memoriesOpen && (
                  <div className="bg-brand/5 rounded-2xl border border-amber/15 p-4">
                    <h4 className="text-sm font-semibold text-amber mb-3">Shared Memories</h4>

                    {commentsLoading ? (
                      <p className="text-sm text-muted py-4 text-center">Loading...</p>
                    ) : (
                      <>
                        {sharedComments.length === 0 && (
                          <p className="text-sm text-muted mb-3 text-center py-2">No memories yet — add the first one!</p>
                        )}
                        <div className="space-y-3 mb-3">
                          {sharedComments.map(c => {
                            const isOwn = c.authorUid === currentUserUid;
                            return (
                              <div key={c.id} className={`rounded-xl p-3 ${isOwn ? 'bg-amber-subtle ml-4' : 'bg-hover mr-4'}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-secondary">{c.authorName}</span>
                                  <span className="text-xs text-muted">
                                    {c.editedAt ? 'edited' : c.createdAt?.toDate ? new Date(c.createdAt.toDate()).toLocaleDateString() : ''}
                                  </span>
                                </div>
                                {editingMemoryId === c.id ? (
                                  <div className="flex gap-2 mt-1">
                                    <input
                                      type="text"
                                      value={editingMemoryText}
                                      onChange={e => setEditingMemoryText(e.target.value)}
                                      maxLength={500}
                                      className="flex-1 px-2 py-1 bg-hover border border-subtle rounded-lg text-sm text-primary focus:outline-none focus:ring-2 focus:ring-amber/50"
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' && editingMemoryText.trim()) {
                                          onEditComment && onEditComment(c.id, editingMemoryText.trim());
                                          setEditingMemoryId(null);
                                        }
                                        if (e.key === 'Escape') setEditingMemoryId(null);
                                      }}
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => { onEditComment && onEditComment(c.id, editingMemoryText.trim()); setEditingMemoryId(null); }}
                                      className="px-2 py-1 bg-brand hover:bg-amber text-primary rounded-lg text-xs"
                                    >Save</button>
                                    <button
                                      onClick={() => setEditingMemoryId(null)}
                                      className="px-2 py-1 bg-hover hover:bg-hover text-secondary rounded-lg text-xs"
                                    >Cancel</button>
                                  </div>
                                ) : (
                                  <p className="text-sm text-secondary mt-0.5">{c.text}</p>
                                )}
                                {isOwn && editingMemoryId !== c.id && (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => { setEditingMemoryId(c.id); setEditingMemoryText(c.text); }}
                                      className="text-xs text-muted hover:text-primary transition-colors"
                                    >Edit</button>
                                    <button
                                      onClick={() => onDeleteComment && onDeleteComment(c.id)}
                                      className="text-xs text-muted hover:text-danger transition-colors"
                                    >Delete</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* New comment input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Share a memory..."
                            value={newMemoryText}
                            onChange={e => setNewMemoryText(e.target.value)}
                            maxLength={500}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && newMemoryText.trim()) {
                                onAddComment && onAddComment(newMemoryText.trim());
                                setNewMemoryText('');
                              }
                            }}
                            className="flex-1 px-3 py-2 bg-hover border border-subtle rounded-xl text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-amber/50"
                          />
                          <button
                            onClick={() => {
                              if (newMemoryText.trim()) {
                                onAddComment && onAddComment(newMemoryText.trim());
                                setNewMemoryText('');
                              }
                            }}
                            disabled={!newMemoryText.trim()}
                            className="px-3 py-2 bg-brand/80 hover:bg-brand disabled:opacity-40 text-primary rounded-xl text-sm transition-colors"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          </div>
        </div>
      </div>

      {/* Song History Modal */}
      {songHistoryTarget && allShows && (
        <SongHistoryModal
          songName={songHistoryTarget}
          artistName={show.artist}
          allShows={allShows}
          onClose={() => setSongHistoryTarget(null)}
          onViewShow={(targetShow) => {
            setSongHistoryTarget(null);
            // If the target show is the current show, just close the modal
            // Otherwise, we'd need a way to navigate - for now just close
          }}
        />
      )}
    </div>
  );
}

export default SetlistEditor;
