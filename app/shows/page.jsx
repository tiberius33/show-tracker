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
import { Button, Card, SearchField } from '@/components/ui';
import {
  Search, Camera, RefreshCw, X, Upload, Music,
  Bell, ChevronRight, Crown, Calendar, MapPin, Check, Tag, Sparkles, CheckSquare, Square,
} from 'lucide-react';

export default function ShowsPage() {
  const {
    shows, isLoading, user, guestMode,
    selectedShow, setSelectedShow,
    selectedArtist, setSelectedArtist,
    showForm, setShowForm,
    searchTerm, setSearchTerm,
    filterYear, setFilterYear, filterDate, setFilterDate, availableYears,
    sortBy, setSortBy,
    addShow, addSongToShow, updateSongRating, updateSongComment,
    deleteSong, updateShowRating, updateShowComment, batchRateUnrated, deleteShow,
    tagFriendsAtShow, bulkTagFriendsAtShows, tagFriendByEmail,
    tagFriendsShow, setTagFriendsShow, setVenueRatingShow,
    friends, friendAnnotationsForShow,
    pendingNotificationCount, pendingFriendRequests, pendingShowTags,
    setFriendsInitialTab, navigateTo,
    summaryStats, userRank, statsTab, setStatsTab,
setlistScanning, setlistScanProgress, scanForMissingSetlists,
    sortedFilteredShows, artistGroups, importedIds,
    myConfirmedSuggestions, normalizeShowKey,
    memoriesShow, sharedComments, commentsLoading,
    openMemories, addSharedComment, editSharedComment, deleteSharedComment,
    pendingTagsForReview, acceptPendingEmailTag, declinePendingEmailTag,
    toggleFavoriteArtist, isArtistFavorite,
    commentContext, setCommentContext,
    isReturningUser,
  } = useApp();

  const [playlistShow, setPlaylistShow] = useState(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedShowIds, setSelectedShowIds] = useState(new Set());
  const [bulkTagShows, setBulkTagShows] = useState(null); // array of shows for bulk tag modal

  const toggleSelectShow = (showId) => {
    setSelectedShowIds(prev => {
      const next = new Set(prev);
      if (next.has(showId)) next.delete(showId);
      else next.add(showId);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedShowIds(new Set());
  };

  const selectAllShows = () => {
    setSelectedShowIds(new Set(sortedFilteredShows.map(s => s.id)));
  };

  const openBulkTagModal = () => {
    const selected = shows.filter(s => selectedShowIds.has(s.id));
    if (selected.length > 0) setBulkTagShows(selected);
  };

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
            <div className="w-10 h-10 bg-brand-subtle rounded-xl flex items-center justify-center">
              <Tag className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">Your friends tagged you in some shows!</h1>
              <p className="text-secondary text-sm">Review them and add any to your history.</p>
            </div>
          </div>
          <div className="space-y-4">
            {pendingTagsForReview.map(tag => (
              <Card key={tag.id} padding="none" className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-lg font-bold" style={{ color: '#f59e0b' }}>{tag.showData?.artist}</div>
                    <div className="flex items-center gap-3 text-sm text-secondary mt-1 flex-wrap">
                      {tag.showData?.date && (
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(tag.showData.date)}</span>
                      )}
                      {tag.showData?.venue && (
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{tag.showData.venue}</span>
                      )}
                      {tag.showData?.city && <span>{tag.showData.city}</span>}
                    </div>
                    <div className="text-sm text-muted mt-1">Tagged by {tag.fromName}</div>
                    {tag.personalMessage && (
                      <p className="text-sm text-secondary italic mt-2">&ldquo;{tag.personalMessage}&rdquo;</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Check}
                    onClick={() => acceptPendingEmailTag(tag)}
                    className="flex-1"
                  >
                    Add to My History
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => declinePendingEmailTag(tag)}
                    className="flex-1"
                  >
                    Not Me — Skip
                  </Button>
                </div>
              </Card>
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
              className="w-full mb-4 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber/20 to-brand-glow border border-amber/30 rounded-xl hover:from-amber/30 hover:to-brand-glow transition-all group"
            >
              <div className="relative">
                <Bell className="w-5 h-5 text-amber" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-danger rounded-full animate-pulse" />
              </div>
              <span className="text-primary text-sm font-medium">
                {pendingFriendRequests.length > 0 && pendingShowTags.length > 0
                  ? `You have ${pendingFriendRequests.length} friend request${pendingFriendRequests.length !== 1 ? 's' : ''} and ${pendingShowTags.length} show tag${pendingShowTags.length !== 1 ? 's' : ''}`
                  : pendingFriendRequests.length > 0
                    ? `You have ${pendingFriendRequests.length} pending friend request${pendingFriendRequests.length !== 1 ? 's' : ''}`
                    : `You were tagged in ${pendingShowTags.length} show${pendingShowTags.length !== 1 ? 's' : ''} by friends`
                }
              </span>
              <ChevronRight className="w-4 h-4 text-amber/60 ml-auto group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Summary stats */}
          {shows.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
              {[
                { label: 'Shows', value: shows.length, color: 'from-brand to-amber', action: () => {} },
                { label: 'Songs', value: summaryStats.totalSongs, color: 'from-amber to-amber', action: () => { setStatsTab('songs'); navigateTo('stats'); } },
                { label: 'Artists', value: summaryStats.uniqueArtists, color: 'from-brand to-brand', action: () => { setStatsTab('artists'); navigateTo('stats'); } },
                { label: 'Venues', value: summaryStats.uniqueVenues, color: 'from-amber to-amber', action: () => { setStatsTab('venues'); navigateTo('stats'); } },
                { label: 'Avg Rating', value: summaryStats.avgRating || '--', color: 'from-danger to-danger', action: () => { setStatsTab('top'); navigateTo('stats'); } },
              ].map(stat => (
                <button key={stat.label} onClick={stat.action} className="bg-hover backdrop-blur-xl border border-subtle rounded-xl p-2.5 text-center hover:bg-[rgba(52,211,153,0.1)] hover:scale-105 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <div className={`text-xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</div>
                  <div className="text-[10px] font-medium text-secondary uppercase tracking-wide mt-0.5">{stat.label}</div>
                </button>
              ))}
              {userRank && (
                <button onClick={() => navigateTo('community')} className="bg-gradient-to-br from-brand/20 to-brand/20 backdrop-blur-xl border border-brand/30 rounded-xl p-2.5 text-center hover:from-brand/30 hover:to-brand/30 transition-all cursor-pointer">
                  <div className="flex items-center justify-center gap-1">
                    <Crown className="w-4 h-4 text-brand" />
                    <div className="text-xl font-bold text-brand">#{userRank.rank}</div>
                  </div>
                  <div className="text-[10px] font-medium text-brand/70 uppercase tracking-wide mt-0.5">of {userRank.total}</div>
                </button>
              )}
            </div>
          )}

          {/* Action buttons row */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              variant="primary"
              full
              icon={Search}
              onClick={() => navigateTo('search')}
              className={`relative${shows.length === 0 ? ' animate-pulse' : ''}`}
            >
              {shows.length === 0 && (
                <span className="absolute inset-0 rounded-full bg-brand animate-ping opacity-20 pointer-events-none" />
              )}
              Search for a Show
            </Button>
            <Button
              variant="primary"
              full
              icon={Camera}
              onClick={() => navigateTo('scan-import')}
            >
              Scan / Import
            </Button>
          </div>

          {/* Find Missing Setlists banner */}
          {!guestMode && !setlistScanning && shows.length > 0 && shows.some(s => !s.setlist || s.setlist.length === 0) && (
            <div className="bg-amber-subtle border border-amber/20 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Music className="w-5 h-5 text-amber flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-primary text-sm font-medium">
                    {shows.filter(s => !s.setlist || s.setlist.length === 0).length} show{shows.filter(s => !s.setlist || s.setlist.length === 0).length !== 1 ? 's' : ''} missing setlists
                  </p>
                  <p className="text-muted text-xs">Auto-fetch setlists from Setlist.fm</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={RefreshCw}
                onClick={scanForMissingSetlists}
                className="bg-amber hover:bg-amber/90 text-on-dark whitespace-nowrap shadow-sm"
              >
                Find Setlists
              </Button>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-primary mb-1">My Shows</h1>
              <p className="text-secondary">All the concerts you&apos;ve attended</p>
            </div>
            {shows.length > 0 && !guestMode && friends.length > 0 && (
              <button
                onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectionMode
                    ? 'bg-brand-subtle text-brand border border-brand/30'
                    : 'bg-hover text-secondary hover:bg-hover border border-subtle'
                }`}
              >
                {selectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {selectionMode ? 'Done' : 'Select Multiple Shows'}
              </button>
            )}
          </div>

          {/* Setlist scanning progress */}
          {setlistScanning && (
            <div className="bg-amber-subtle border border-amber/30 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <RefreshCw className="w-5 h-5 text-amber animate-spin" />
                <span className="text-primary font-medium">Scanning for setlists...</span>
                <span className="text-secondary text-sm ml-auto">{setlistScanProgress.current} / {setlistScanProgress.total}</span>
              </div>
              <div className="w-full bg-hover rounded-full h-2">
                <div
                  className="bg-amber h-2 rounded-full transition-all duration-300"
                  style={{ width: `${setlistScanProgress.total > 0 ? (setlistScanProgress.current / setlistScanProgress.total) * 100 : 0}%` }}
                />
              </div>
              {setlistScanProgress.found > 0 && (
                <p className="text-amber text-sm mt-2">{setlistScanProgress.found} setlist{setlistScanProgress.found !== 1 ? 's' : ''} found so far</p>
              )}
            </div>
          )}

          {/* Search, Filter & Sort */}
          <Card padding="sm" className="mb-6 shadow-theme-sm">
            <div className="flex gap-3 flex-wrap items-center">
              {/* Text search */}
              <SearchField
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Filter by artist or venue..."
                className="flex-1 min-w-[200px]"
              />

              {/* Year dropdown */}
              {availableYears.length > 1 && (
                <select
                  value={filterYear}
                  onChange={(e) => { setFilterYear(e.target.value); setFilterDate(''); }}
                  className="px-3 py-2.5 bg-surface border border-subtle rounded-xl text-sm font-medium text-secondary focus:outline-none focus:ring-2 focus:ring-brand/50 cursor-pointer"
                >
                  <option value="">All Years</option>
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}

              {/* Date picker */}
              <div className="relative">
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => { setFilterDate(e.target.value); setFilterYear(''); }}
                  className="px-3 py-2.5 bg-surface border border-subtle rounded-xl text-sm font-medium text-secondary focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
              </div>

              {/* Clear filters */}
              {(filterYear || filterDate || searchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={() => { setFilterYear(''); setFilterDate(''); setSearchTerm(''); }}
                  className="text-danger hover:bg-danger/10"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Sort buttons */}
            {shows.length > 1 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-subtle">
                <span className="text-sm font-medium text-secondary">Sort:</span>
                {['artist', 'rating'].map(opt => (
                  <Button
                    key={opt}
                    size="sm"
                    variant="ghost"
                    onClick={() => setSortBy(opt)}
                    className={sortBy === opt
                      ? 'bg-brand-subtle text-brand border border-brand/30'
                      : 'text-secondary border border-subtle'}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Button>
                ))}
              </div>
            )}
          </Card>

          {/* Empty state */}
          {sortedFilteredShows.length === 0 && !showForm && (
            <div className="text-center py-12 md:py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-brand/20 to-amber/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-brand/30">
                <Sparkles className="w-12 h-12 text-brand" />
              </div>
              <h2 className="text-2xl font-bold text-primary mb-2">Your Concert Journey Starts Here</h2>
              <p className="text-secondary mb-6 max-w-md mx-auto">
                Build your personal concert history with setlists, ratings, and stats.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3 mb-8">
                <Button
                  variant="primary"
                  size="lg"
                  icon={Search}
                  onClick={() => navigateTo('search')}
                  className="relative"
                >
                  <span className="absolute inset-0 rounded-full bg-brand animate-ping opacity-20 pointer-events-none" />
                  Search for a Show
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  icon={Upload}
                  onClick={() => navigateTo('scan-import')}
                  className="bg-amber-subtle text-amber border border-amber/30 hover:bg-amber/20"
                >
                  Bulk Import
                </Button>
              </div>
              <Card padding="md" className="max-w-lg mx-auto text-left">
                <h3 className="text-primary font-semibold mb-4 text-center">Quick ways to add your shows</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-subtle rounded-lg flex items-center justify-center flex-shrink-0">
                      <Camera className="w-4 h-4 text-amber" />
                    </div>
                    <div>
                      <p className="text-primary font-medium text-sm">Screenshot Import</p>
                      <p className="text-secondary text-xs">Take a screenshot of your Ticketmaster, AXS, or StubHub past events and our AI will extract your shows</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-brand-subtle rounded-lg flex items-center justify-center flex-shrink-0">
                      <Upload className="w-4 h-4 text-brand" />
                    </div>
                    <div>
                      <p className="text-primary font-medium text-sm">CSV / Excel Import</p>
                      <p className="text-secondary text-xs">Upload a .csv, .xlsx, or .xls spreadsheet with your concert history</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-brand-subtle rounded-lg flex items-center justify-center flex-shrink-0">
                      <Search className="w-4 h-4 text-brand" />
                    </div>
                    <div>
                      <p className="text-primary font-medium text-sm">Search setlist.fm</p>
                      <p className="text-secondary text-xs">Search by artist to find shows with full setlists from setlist.fm</p>
                    </div>
                  </div>
                </div>
              </Card>
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
            <Card variant="elevated" padding="none" className="shadow-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-hover border-b border-subtle">
                    <th className="text-left px-4 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Artist</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Shows</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
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
                      selectionMode={selectionMode}
                      selectedShowIds={selectedShowIds}
                      onToggleSelect={toggleSelectShow}
                    />
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* SetlistEditor modal */}
          {selectedShow && (() => {
            const confirmedSuggestion = user && !guestMode
              ? myConfirmedSuggestions.find(s => s.showKey === normalizeShowKey(selectedShow))
              : null;
            return (
              <SetlistEditor
                show={selectedShow}
                allShows={shows}
                onAddSong={(song) => addSongToShow(selectedShow.id, song)}
                onRateSong={(songId, rating) => updateSongRating(selectedShow.id, songId, rating)}
                onCommentSong={(songId, comment) => updateSongComment(selectedShow.id, songId, comment)}
                onDeleteSong={(songId) => deleteSong(selectedShow.id, songId)}
                onRateShow={(rating) => updateShowRating(selectedShow.id, rating)}
                onCommentShow={(comment) => updateShowComment(selectedShow.id, comment)}
                onBatchRate={(rating) => batchRateUnrated(selectedShow.id, rating)}
                onClose={() => { setSelectedShow(null); setCommentContext(null); }}
                onCreatePlaylist={(show) => setPlaylistShow(show)}
                onTagFriends={!guestMode ? (show) => setTagFriendsShow(show) : undefined}
                onRateVenue={user && !guestMode ? (show) => setVenueRatingShow(show) : undefined}
                onToggleFavoriteArtist={!guestMode ? toggleFavoriteArtist : undefined}
                isArtistFavorite={isArtistFavorite}
                confirmedSuggestion={confirmedSuggestion || null}
                sharedComments={memoriesShow?.suggestion?.id === confirmedSuggestion?.id ? sharedComments : []}
                commentsLoading={commentsLoading}
                onOpenMemories={confirmedSuggestion ? () => openMemories(confirmedSuggestion) : null}
                onAddComment={confirmedSuggestion ? (text) => addSharedComment(confirmedSuggestion.id, text, confirmedSuggestion) : null}
                onEditComment={confirmedSuggestion ? (cid, txt) => editSharedComment(confirmedSuggestion.id, cid, txt) : null}
                onDeleteComment={confirmedSuggestion ? (cid) => deleteSharedComment(confirmedSuggestion.id, cid) : null}
                currentUserUid={user?.uid}
                friendAnnotations={friendAnnotationsForShow}
                commentContext={commentContext}
                isReturningUser={isReturningUser}
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

          {/* Bulk tag friends modal */}
          {bulkTagShows && (
            <TagFriendsModal
              shows={bulkTagShows}
              friends={friends}
              onTag={async (selectedFriendUids) => {
                await bulkTagFriendsAtShows(bulkTagShows, selectedFriendUids);
                setBulkTagShows(null);
                exitSelectionMode();
              }}
              onInviteByEmail={(params) => tagFriendByEmail({ ...params, show: bulkTagShows[0] })}
              onClose={() => setBulkTagShows(null)}
            />
          )}

          {/* Bulk action bar */}
          {selectionMode && selectedShowIds.size > 0 && (
            <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-surface border-t border-subtle p-4 z-50 shadow-xl">
              <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-primary">
                  {selectedShowIds.size} show{selectedShowIds.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAllShows}>Select All</Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedShowIds(new Set())}>Clear</Button>
                  <Button variant="primary" size="sm" icon={Tag} onClick={openBulkTagModal}>Tag Friends</Button>
                </div>
              </div>
            </div>
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
