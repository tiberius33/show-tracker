'use client';

import React, { useState, useMemo } from 'react';
import { X, Star, Tag, Share2, Check, Plus, MessageSquare, User, Users, ChevronDown, Send, ListMusic } from 'lucide-react';
import { formatDate, artistColor } from '@/lib/utils';
import RatingSelect from '@/components/ui/RatingSelect';
import Tip from '@/components/ui/Tip';
import UpcomingShows from '@/components/UpcomingShows';
import EntityInfoPanel from '@/components/EntityInfoPanel';

function SetlistEditor({ show, onAddSong, onRateSong, onCommentSong, onDeleteSong, onRateShow, onCommentShow, onBatchRate, onClose, onCreatePlaylist, onTagFriends, onRateVenue, confirmedSuggestion, sharedComments, commentsLoading, onOpenMemories, onAddComment, onEditComment, onDeleteComment, currentUserUid, friendAnnotations }) {
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
    <div className="fixed inset-0 md:left-64 bg-black/60 backdrop-blur-xl flex items-end md:items-center justify-center md:p-4 z-[60]">
      <div className="bg-slate-900 border border-white/10 rounded-t-2xl md:rounded-3xl max-w-[100vw] sm:max-w-lg md:max-w-2xl w-full max-h-[92vh] md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Compact top bar with close, share, and tag */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-white/10 bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-lg md:text-2xl font-bold truncate" style={{ color: artistColor(show.artist) }}>{show.artist}</h2>
            {!show.isManual && (
              <span className="text-[10px] md:text-xs font-semibold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 md:px-2 md:py-1 rounded-full flex-shrink-0">
                setlist.fm
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onRateVenue && show.venue && (
              <Tip text="Rate this venue">
                <button
                  onClick={() => onRateVenue(show)}
                  className="p-3 rounded-xl text-white/50 hover:text-amber-400 hover:bg-amber-500/10 active:bg-amber-500/20 transition-colors"
                >
                  <Star className="w-6 h-6" />
                </button>
              </Tip>
            )}
            {onTagFriends && (
              <Tip text="Tag friends at this show">
                <button
                  onClick={() => onTagFriends(show)}
                  className="p-3 rounded-xl text-white/50 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors"
                >
                  <Tag className="w-6 h-6" />
                </button>
              </Tip>
            )}
            <Tip text="Share setlist">
              <button
                onClick={handleShare}
                className={`p-3 rounded-xl transition-colors ${shareSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/50 hover:text-white hover:bg-white/10 active:bg-white/20'}`}
              >
                {shareSuccess ? <Check className="w-6 h-6" /> : <Share2 className="w-6 h-6" />}
              </button>
            </Tip>
            {show.setlist?.length > 0 && onCreatePlaylist && (
              <Tip text="Create playlist">
                <button
                  onClick={() => onCreatePlaylist(show)}
                  className="p-3 rounded-xl text-white/50 hover:text-emerald-400 hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors"
                >
                  <ListMusic className="w-6 h-6" />
                </button>
              </Tip>
            )}
            <button onClick={onClose} className="p-3 rounded-xl text-white/50 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scrollable content area with show info + setlist */}
        <div className="flex-1 overflow-y-auto">
          {/* Show details */}
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-white/10 bg-slate-900/80">
            <p className="text-white/50 text-sm">
              {formatDate(show.date)} &middot; {show.venue}
              {show.city && `, ${show.city}`}
            </p>
            {show.tour && (
              <p className="text-emerald-400 text-sm font-medium mt-1">Tour: {show.tour}</p>
            )}
            <div className="mt-2">
              <RatingSelect value={show.rating} onChange={onRateShow} label="Show rating:" />
            </div>
            {!editingShowComment && (
              <div className="mt-2">
                {show.comment ? (
                  <div
                    className="text-sm text-white/50 italic bg-white/5 p-2.5 rounded-lg border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => { setEditingShowComment(true); setShowCommentText(show.comment || ''); }}
                  >
                    <div className="flex items-start gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/40" />
                      <span>{show.comment}</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingShowComment(true); setShowCommentText(''); }}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/60 transition-colors"
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
                  className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
                  autoFocus
                />
                <button
                  onClick={() => { onCommentShow(showCommentText.trim()); setEditingShowComment(false); }}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingShowComment(false)}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white/60 rounded-lg text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Friend's show-level annotation */}
            {friendAnnotations && (friendAnnotations.friendShow?.comment || friendAnnotations.friendShow?.rating) && (
              <div className="mt-3 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-violet-300">{friendAnnotations.friendName}</span>
                      {friendAnnotations.friendShow?.rating && (
                        <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full font-semibold">
                          Rated {friendAnnotations.friendShow.rating}/10
                        </span>
                      )}
                    </div>
                    {friendAnnotations.friendShow?.comment && (
                      <p className="text-sm text-white/60 italic mt-1">{friendAnnotations.friendShow.comment}</p>
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
                className="flex-1 px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40 text-sm"
              />
              <button type="submit" className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/25">
                <Plus className="w-5 h-5" />
              </button>
            </form>

            {unratedCount > 0 && (
              <div className="flex items-center gap-3 mt-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                <span className="text-xs font-medium text-white/50">Rate {unratedCount} unrated:</span>
                <RatingSelect value={batchRating} onChange={(v) => setBatchRating(v || 5)} />
                <button
                  onClick={() => onBatchRate(batchRating)}
                  className="px-4 py-2 md:px-3 md:py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm md:text-xs font-medium transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          <div className="p-4 md:p-6 bg-slate-900/50">
          {show.setlist.length === 0 ? (
            <p className="text-center text-white/40 py-8 font-medium">No songs in setlist</p>
          ) : (
            <div className="space-y-3">
              {show.setlist.map((song, index) => (
                <React.Fragment key={song.id}>
                  {song.setBreak && (
                    <div className="text-emerald-400 font-semibold text-sm pt-3 pb-1 border-t border-white/10 mt-3">
                      {song.setBreak}
                    </div>
                  )}
                  <div className="group bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-white/30 font-mono text-sm mt-1">{index + 1}.</span>
                        <div className="flex-1">
                          <span className="font-medium text-white">{song.name}</span>
                          {song.cover && (
                            <span className="text-sm text-emerald-400 ml-2">({song.cover})</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteSong(song.id)}
                        className="text-white/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
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
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/60'
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        {song.comment ? 'Edit note' : 'Add note'}
                      </button>
                    </div>
                    {song.comment && editingComment !== song.id && (
                      <div className="ml-8 mt-2 text-sm text-white/50 italic bg-white/5 p-2.5 rounded-lg border border-white/10">
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
                          className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
                          autoFocus
                        />
                        <button
                          onClick={() => saveComment(song.id)}
                          className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingComment(null)}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white/60 rounded-lg text-xs font-medium transition-colors"
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
                        <div className="ml-8 mt-2 bg-violet-500/10 border border-violet-500/15 rounded-lg p-2.5">
                          <div className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <User className="w-2.5 h-2.5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-semibold text-violet-300">{friendAnnotations.friendName}</span>
                                {fSong.rating && (
                                  <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full font-semibold">
                                    {fSong.rating}/10
                                  </span>
                                )}
                              </div>
                              {fSong.comment && (
                                <p className="text-xs text-white/50 italic mt-0.5">{fSong.comment}</p>
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

          {/* Shared Memories (confirmed show together) */}
          {confirmedSuggestion && (() => {
            const otherUid = confirmedSuggestion.participants?.find(p => p !== currentUserUid);
            const otherName = otherUid ? confirmedSuggestion.names?.[otherUid] : 'A friend';
            return (
              <div className="mt-4 border-t border-teal-500/20 pt-4">
                {/* Attendance chip */}
                <button
                  onClick={() => {
                    if (!memoriesOpen && onOpenMemories) onOpenMemories();
                    setMemoriesOpen(prev => !prev);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-sm font-medium hover:bg-teal-500/25 transition-colors mb-3"
                >
                  <Users className="w-4 h-4" />
                  You and {otherName} were both here
                  <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${memoriesOpen ? 'rotate-180' : ''}`} />
                </button>

                {memoriesOpen && (
                  <div className="bg-teal-500/5 rounded-2xl border border-teal-500/15 p-4">
                    <h4 className="text-sm font-semibold text-teal-300 mb-3">Shared Memories</h4>

                    {commentsLoading ? (
                      <p className="text-sm text-white/40 py-4 text-center">Loading...</p>
                    ) : (
                      <>
                        {sharedComments.length === 0 && (
                          <p className="text-sm text-white/40 mb-3 text-center py-2">No memories yet — add the first one!</p>
                        )}
                        <div className="space-y-3 mb-3">
                          {sharedComments.map(c => {
                            const isOwn = c.authorUid === currentUserUid;
                            return (
                              <div key={c.id} className={`rounded-xl p-3 ${isOwn ? 'bg-teal-500/10 ml-4' : 'bg-white/5 mr-4'}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-white/60">{c.authorName}</span>
                                  <span className="text-xs text-white/30">
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
                                      className="flex-1 px-2 py-1 bg-white/10 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
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
                                      className="px-2 py-1 bg-teal-500 hover:bg-teal-400 text-white rounded-lg text-xs"
                                    >Save</button>
                                    <button
                                      onClick={() => setEditingMemoryId(null)}
                                      className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/60 rounded-lg text-xs"
                                    >Cancel</button>
                                  </div>
                                ) : (
                                  <p className="text-sm text-white/80 mt-0.5">{c.text}</p>
                                )}
                                {isOwn && editingMemoryId !== c.id && (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => { setEditingMemoryId(c.id); setEditingMemoryText(c.text); }}
                                      className="text-xs text-white/30 hover:text-white/60 transition-colors"
                                    >Edit</button>
                                    <button
                                      onClick={() => onDeleteComment && onDeleteComment(c.id)}
                                      className="text-xs text-white/30 hover:text-red-400 transition-colors"
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
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                          />
                          <button
                            onClick={() => {
                              if (newMemoryText.trim()) {
                                onAddComment && onAddComment(newMemoryText.trim());
                                setNewMemoryText('');
                              }
                            }}
                            disabled={!newMemoryText.trim()}
                            className="px-3 py-2 bg-teal-500/80 hover:bg-teal-500 disabled:opacity-40 text-white rounded-xl text-sm transition-colors"
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
    </div>
  );
}

export default SetlistEditor;
