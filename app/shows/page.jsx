'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/utils';
import ShowForm from '@/components/ShowForm';
import SetlistEditor from '@/components/SetlistEditor';
import TagFriendsModal from '@/components/TagFriendsModal';
import PlaylistCreatorModal from '@/components/PlaylistCreatorModal';
import WhatsNewModal, { shouldShowWhatsNew } from '@/components/WhatsNewModal';
import ArtistShowsRow from '@/components/ArtistShowsRow';
import ShowsListSkeleton from '@/components/ui/ShowsListSkeleton';
import {
  Search, Plus, Camera, RefreshCw, Upload, Sparkles,
  Bell, ChevronRight, Crown, Calendar, MapPin, Check, Tag,
} from 'lucide-react';

export default function ShowsPage() {
  const {
    shows, isLoading, user, guestMode,
    selectedShow, setSelectedShow,
    selectedArtist, setSelectedArtist,
    showForm, setShowForm,
    searchTerm, setSearchTerm,
    sortBy, setSortBy,
    addShow, addSongToShow, updateSongRating, updateSongComment,
    deleteSong, updateShowRating, updateShowComment, batchRateUnrated, deleteShow,
    tagFriendsAtShow, tagFriendByEmail,
    tagFriendsShow, setTagFriendsShow, setVenueRatingShow,
    friends, friendAnnotationsForShow,
    pendingNotificationCount, pendingFriendRequests, pendingShowTags,
    setFriendsInitialTab, navigateTo,
    summaryStats, userRank, statsTab, setStatsTab,
    tooltipStep, dismissTooltip,
    setlistScanning, setlistScanProgress, scanForMissingSetlists,
    sortedFilteredShows, artistGroups, importedIds,
    myConfirmedSuggestions, normalizeShowKey,
    memoriesShow, sharedComments, commentsLoading,
    openMemories, addSharedComment, editSharedComment, deleteSharedComment,
    pendingTagsForReview, acceptPendingEmailTag, declinePendingEmailTag,
  } = useApp();

  const [playlistShow, setPlaylistShow] = useState(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  // Show "What's New" modal for returning users who have shows (not first-time users)
  useEffect(() => {
    if (!isLoading && user && shows.length > 0 && shouldShowWhatsNew()) {
      const timer = setTimeout(() => setShowWhatsNew(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [isLoading, user, shows.length]);

  if (isLoading) {
    return <ShowsListSkeleton />;
  }

  return (
    <>
      {/* Pending email tags review — shown once after signup if shows were tagged */}
      {pendingTagsForReview && pendingTagsForReview.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Tag className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Your friends tagged you in some shows!</h1>
              <p className="text-white/50 text-sm">Review them and add any to your history.</p>
            </div>
          </div>
          <div className="space-y-4">
            {pendingTagsForReview.map(tag => (
              <div key={tag.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-lg font-bold" style={{ color: '#f59e0b' }}>{tag.showData?.artist}</div>
                    <div className="flex items-center gap-3 text-sm text-white/60 mt-1 flex-wrap">
                      {tag.showData?.date && (
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(tag.showData.date)}</span>
                      )}
                      {tag.showData?.venue && (
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{tag.showData.venue}</span>
                      )}
                      {tag.showData?.city && <span>{tag.showData.city}</span>}
                    </div>
                    <div className="text-sm text-white/40 mt-1">Tagged by {tag.fromName}</div>
                    {tag.personalMessage && (
                      <p className="text-sm text-white/50 italic mt-2">&ldquo;{tag.personalMessage}&rdquo;</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => acceptPendingEmailTag(tag)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl font-medium transition-colors text-sm"
                  >
                    <Check className="w-4 h-4" /> Add to My History
                  </button>
                  <button
                    onClick={() => declinePendingEmailTag(tag)}
                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/50 rounded-xl font-medium transition-colors text-sm"
                  >
                    Not Me — Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!pendingTagsForReview || pendingTagsForReview.length === 0) && (
        <>
          {/* Friend request / show tag notification banner */}
          {!guestMode && pendingNotificationCount > 0 && (
            <button
              onClick={() => {
                setFriendsInitialTab('requests');
                navigateTo('friends');
              }}
              className="w-full mb-4 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 rounded-xl hover:from-violet-500/30 hover:to-purple-500/30 transition-all group"
            >
              <div className="relative">
                <Bell className="w-5 h-5 text-violet-400" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              </div>
              <span className="text-white/90 text-sm font-medium">
                {pendingFriendRequests.length > 0 && pendingShowTags.length > 0
                  ? `You have ${pendingFriendRequests.length} friend request${pendingFriendRequests.length !== 1 ? 's' : ''} and ${pendingShowTags.length} show tag${pendingShowTags.length !== 1 ? 's' : ''}`
                  : pendingFriendRequests.length > 0
                    ? `You have ${pendingFriendRequests.length} pending friend request${pendingFriendRequests.length !== 1 ? 's' : ''}`
                    : `You were tagged in ${pendingShowTags.length} show${pendingShowTags.length !== 1 ? 's' : ''} by friends`
                }
              </span>
              <ChevronRight className="w-4 h-4 text-violet-400/60 ml-auto group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Summary stats */}
          {shows.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
              {[
                { label: 'Shows', value: shows.length, color: 'from-emerald-400 to-teal-400', action: () => {} },
                { label: 'Songs', value: summaryStats.totalSongs, color: 'from-violet-400 to-purple-400', action: () => { setStatsTab('songs'); navigateTo('stats'); } },
                { label: 'Artists', value: summaryStats.uniqueArtists, color: 'from-amber-400 to-orange-400', action: () => { setStatsTab('artists'); navigateTo('stats'); } },
                { label: 'Venues', value: summaryStats.uniqueVenues, color: 'from-cyan-400 to-blue-400', action: () => { setStatsTab('venues'); navigateTo('stats'); } },
                { label: 'Avg Rating', value: summaryStats.avgRating || '--', color: 'from-pink-400 to-rose-400', action: () => { setStatsTab('top'); navigateTo('stats'); } },
              ].map(stat => (
                <button key={stat.label} onClick={stat.action} className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 text-center hover:bg-white/15 transition-all cursor-pointer">
                  <div className={`text-xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</div>
                  <div className="text-[10px] font-medium text-white/50 uppercase tracking-wide mt-0.5">{stat.label}</div>
                </button>
              ))}
              {userRank && (
                <button onClick={() => navigateTo('community')} className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-xl border border-amber-500/30 rounded-xl p-2.5 text-center hover:from-amber-500/30 hover:to-orange-500/30 transition-all cursor-pointer">
                  <div className="flex items-center justify-center gap-1">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <div className="text-xl font-bold text-amber-400">#{userRank.rank}</div>
                  </div>
                  <div className="text-[10px] font-medium text-amber-200/70 uppercase tracking-wide mt-0.5">of {userRank.total}</div>
                </button>
              )}
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white mb-1">My Shows</h1>
              <p className="text-white/60">All the concerts you&apos;ve attended</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigateTo('search')}
                className={`relative flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all whitespace-nowrap shadow-lg shadow-emerald-500/25 ${shows.length === 0 ? 'animate-pulse' : ''}`}
              >
                {shows.length === 0 && (
                  <span className="absolute inset-0 rounded-xl bg-emerald-400 animate-ping opacity-20" />
                )}
                <Search className="w-4 h-4" />
                Search for a Show
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all whitespace-nowrap border border-white/10"
              >
                <Plus className="w-4 h-4" />
                Add Manually
              </button>
              <div className="relative">
                <button
                  onClick={() => navigateTo('scan-import')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-xl font-medium transition-all whitespace-nowrap border border-violet-500/30 ${tooltipStep === 1 ? 'ring-2 ring-violet-500/60 ring-offset-2 ring-offset-slate-900' : ''}`}
                >
                  <Camera className="w-4 h-4" />
                  Scan / Import
                </button>
                {tooltipStep === 1 && (
                  <>
                    <div className="hidden md:block absolute right-full mr-3 top-1/2 -translate-y-1/2 w-56 z-20 animate-in">
                      <div className="bg-violet-600 border border-violet-400/30 rounded-xl p-3 shadow-xl shadow-violet-500/20 relative">
                        <div className="absolute top-1/2 -translate-y-1/2 -right-2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-violet-600" />
                        <p className="text-white text-xs leading-relaxed mb-2">Scan ticket stubs with AI or import a CSV/Excel file to add shows in bulk</p>
                        <button onClick={dismissTooltip} className="text-violet-200 hover:text-white text-xs font-medium transition-colors">Got it ✓</button>
                      </div>
                    </div>
                    <div className="md:hidden absolute top-full mt-2 left-1/2 -translate-x-1/2 w-56 z-20 animate-in-mobile">
                      <div className="bg-violet-600 border border-violet-400/30 rounded-xl p-3 shadow-xl shadow-violet-500/20 relative">
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-violet-600" />
                        <p className="text-white text-xs leading-relaxed mb-2">Scan ticket stubs with AI or import a CSV/Excel file to add shows in bulk</p>
                        <button onClick={dismissTooltip} className="text-violet-200 hover:text-white text-xs font-medium transition-colors">Got it ✓</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {shows.length > 0 && shows.some(s => !s.setlist || s.setlist.length === 0) && (
                <button
                  onClick={scanForMissingSetlists}
                  disabled={setlistScanning}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-xl font-medium transition-all whitespace-nowrap border border-violet-500/30 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${setlistScanning ? 'animate-spin' : ''}`} />
                  {setlistScanning ? 'Scanning...' : 'Find Missing Setlists'}
                </button>
              )}
            </div>
          </div>

          {/* Setlist scanning progress */}
          {setlistScanning && (
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <RefreshCw className="w-5 h-5 text-violet-400 animate-spin" />
                <span className="text-white font-medium">Scanning for setlists...</span>
                <span className="text-white/50 text-sm ml-auto">{setlistScanProgress.current} / {setlistScanProgress.total}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-violet-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${setlistScanProgress.total > 0 ? (setlistScanProgress.current / setlistScanProgress.total) * 100 : 0}%` }}
                />
              </div>
              {setlistScanProgress.found > 0 && (
                <p className="text-violet-300 text-sm mt-2">{setlistScanProgress.found} setlist{setlistScanProgress.found !== 1 ? 's' : ''} found so far</p>
              )}
            </div>
          )}

          {/* Search & Sort */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter shows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
                />
              </div>
              {shows.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/50">Sort:</span>
                  {['date', 'artist', 'rating'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setSortBy(opt)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        sortBy === opt
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Empty state */}
          {sortedFilteredShows.length === 0 && !showForm && (
            <div className="text-center py-12 md:py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                <Sparkles className="w-12 h-12 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Your Concert Journey Starts Here</h2>
              <p className="text-white/60 mb-6 max-w-md mx-auto">
                Build your personal concert history with setlists, ratings, and stats.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3 mb-8">
                <button
                  onClick={() => navigateTo('search')}
                  className="relative inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
                >
                  <span className="absolute inset-0 rounded-xl bg-emerald-400 animate-ping opacity-20" />
                  <Search className="w-5 h-5" />
                  Search for a Show
                </button>
                <button
                  onClick={() => navigateTo('scan-import')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-xl font-semibold transition-all border border-violet-500/30 hover:scale-105"
                >
                  <Upload className="w-5 h-5" />
                  Bulk Import
                </button>
              </div>
              <div className="max-w-lg mx-auto bg-white/5 border border-white/10 rounded-2xl p-6 text-left">
                <h3 className="text-white font-semibold mb-4 text-center">Quick ways to add your shows</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Camera className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-white/90 font-medium text-sm">Screenshot Import</p>
                      <p className="text-white/50 text-xs">Take a screenshot of your Ticketmaster, AXS, or StubHub past events and our AI will extract your shows</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Upload className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white/90 font-medium text-sm">CSV / Excel Import</p>
                      <p className="text-white/50 text-xs">Upload a .csv, .xlsx, or .xls spreadsheet with your concert history</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Search className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white/90 font-medium text-sm">Search setlist.fm</p>
                      <p className="text-white/50 text-xs">Search by artist to find shows with full setlists from setlist.fm</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manual add form */}
          {showForm && (
            <ShowForm
              onSubmit={addShow}
              onCancel={() => setShowForm(false)}
              friends={user && !guestMode ? friends : []}
              onTagFriends={tagFriendsAtShow}
            />
          )}

          {/* Artist groups table */}
          {sortedFilteredShows.length > 0 && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="text-left px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Artist</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Shows</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {artistGroups.map(([artist, artistShows]) => (
                    <ArtistShowsRow
                      key={artist}
                      artist={artist}
                      shows={artistShows}
                      expanded={selectedArtist === artist}
                      onToggle={() => setSelectedArtist(selectedArtist === artist ? null : artist)}
                      onSelectShow={setSelectedShow}
                      onDeleteShow={deleteShow}
                      onRateShow={updateShowRating}
                      selectedShowId={selectedShow?.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SetlistEditor modal */}
          {selectedShow && (() => {
            const confirmedSuggestion = user && !guestMode
              ? myConfirmedSuggestions.find(s => s.showKey === normalizeShowKey(selectedShow))
              : null;
            return (
              <SetlistEditor
                show={selectedShow}
                onAddSong={(song) => addSongToShow(selectedShow.id, song)}
                onRateSong={(songId, rating) => updateSongRating(selectedShow.id, songId, rating)}
                onCommentSong={(songId, comment) => updateSongComment(selectedShow.id, songId, comment)}
                onDeleteSong={(songId) => deleteSong(selectedShow.id, songId)}
                onRateShow={(rating) => updateShowRating(selectedShow.id, rating)}
                onCommentShow={(comment) => updateShowComment(selectedShow.id, comment)}
                onBatchRate={(rating) => batchRateUnrated(selectedShow.id, rating)}
                onClose={() => setSelectedShow(null)}
                onCreatePlaylist={(show) => setPlaylistShow(show)}
                onTagFriends={!guestMode ? (show) => setTagFriendsShow(show) : undefined}
                onRateVenue={user && !guestMode ? (show) => setVenueRatingShow(show) : undefined}
                confirmedSuggestion={confirmedSuggestion || null}
                sharedComments={memoriesShow?.suggestion?.id === confirmedSuggestion?.id ? sharedComments : []}
                commentsLoading={commentsLoading}
                onOpenMemories={confirmedSuggestion ? () => openMemories(confirmedSuggestion) : null}
                onAddComment={confirmedSuggestion ? (text) => addSharedComment(confirmedSuggestion.id, text, confirmedSuggestion) : null}
                onEditComment={confirmedSuggestion ? (cid, txt) => editSharedComment(confirmedSuggestion.id, cid, txt) : null}
                onDeleteComment={confirmedSuggestion ? (cid) => deleteSharedComment(confirmedSuggestion.id, cid) : null}
                currentUserUid={user?.uid}
                friendAnnotations={friendAnnotationsForShow}
              />
            );
          })()}

          {/* Tag friends modal */}
          {tagFriendsShow && (
            <TagFriendsModal
              show={tagFriendsShow}
              friends={friends}
              onTag={(selectedFriendUids) => tagFriendsAtShow(tagFriendsShow, selectedFriendUids)}
              onInviteByEmail={(params) => tagFriendByEmail({ ...params, show: tagFriendsShow })}
              onClose={() => setTagFriendsShow(null)}
            />
          )}

          {/* Playlist creator modal */}
          {playlistShow && (
            <PlaylistCreatorModal
              show={playlistShow}
              onClose={() => setPlaylistShow(null)}
            />
          )}

          {/* What's New modal */}
          {showWhatsNew && (
            <WhatsNewModal
              onClose={() => setShowWhatsNew(false)}
              navigateTo={navigateTo}
            />
          )}
        </>
      )}
    </>
  );
}
