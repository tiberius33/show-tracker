'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/utils';
import ShowForm from '@/components/ShowForm';
import TagFriendsModal from '@/components/TagFriendsModal';
import PlaylistCreatorModal from '@/components/PlaylistCreatorModal';
import ArtistShowsRow from '@/components/ArtistShowsRow';
import ShowsListSkeleton from '@/components/ui/ShowsListSkeleton';
import { Button, Card, SearchField, PageHeader, StatFigure } from '@/components/ui';
import ShowCard from '@/components/shows/ShowCard';
import ShowDetailView from '@/components/shows/ShowDetailView';
import ToursTabView from '@/components/shows/ToursTabView';
import useRunIndex, { useTourIndex } from '@/hooks/useRunIndex';
import { tourKeyFor } from '@/lib/runIndex';
import DeleteShowModal from '@/components/shows/DeleteShowModal';
import { removeFromBucketList } from '@/lib/bucketList';
import YearInReviewCard from '@/components/yearInReview/YearInReviewCard';
import {
  Search, Camera, X, Upload,
  Bell, ChevronRight, ChevronLeft, Crown, Calendar, MapPin, Check, Tag, Sparkles, CheckSquare, Square,
} from 'lucide-react';

export default function ShowsPage() {
  const {
    shows, isLoading, user, guestMode,
    selectedShow, setSelectedShow,
    selectedArtist, setSelectedArtist,
    showForm, setShowForm,
    bucketListPrefill, setBucketListPrefill,
    setToast,
    searchTerm, setSearchTerm,
    filterYear, setFilterYear, filterDate, setFilterDate, availableYears,
    sortBy, setSortBy,
    addShow, updateShowRating, updateShowComment, deleteShow, updateShowData, backfillArtistImages,
    addSongToShow, updateSetlistOrder,
    tagFriendsAtShow, bulkTagFriendsAtShows, tagFriendByEmail,
    tagFriendsShow, setTagFriendsShow,
    friends,
    pendingNotificationCount, pendingFriendRequests, pendingShowTags,
    setFriendsInitialTab, navigateTo,
    summaryStats, userRank, statsTab, setStatsTab,
    sortedFilteredShows, artistGroups, importedIds,
    pendingTagsForReview, acceptPendingEmailTag, declinePendingEmailTag,
    toggleFavoriteArtist, isArtistFavorite,
  } = useApp();

  const [playlistShow, setPlaylistShow] = useState(null);
  const [showToDelete, setShowToDelete] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedShowIds, setSelectedShowIds] = useState(new Set());
  const [showsTab, setShowsTab] = useState('timeline'); // 'timeline' | 'artist'
  const [bulkTagShows, setBulkTagShows] = useState(null); // array of shows for bulk tag modal

  // Arriving from BucketListView's "Mark Attended" — open the manual add
  // form pre-filled with the saved show, and clear the prefill so it
  // doesn't re-trigger on a later visit to this page.
  useEffect(() => {
    if (bucketListPrefill) setShowForm(true);
  }, [bucketListPrefill, setShowForm]);

  const handleAddShowFromBucketList = async (formData) => {
    const result = await addShow(formData);
    if (bucketListPrefill?.bucketListKey) {
      try {
        await removeFromBucketList(user.uid, bucketListPrefill.bucketListKey);
      } catch (err) {
        console.error('[bucketList] Failed to remove after marking attended:', err);
        setToast?.('Show added, but removing it from your bucket list failed.');
      }
    }
    setBucketListPrefill(null);
    return result;
  };

  // Lightweight badges on each ShowCard for a run ("Night 2 of 3") or a
  // linkable tour name — kept as a shallow lookup by showId so ShowCard
  // itself stays a plain presentational component.
  const runIndex = useRunIndex();
  const tourIndex = useTourIndex();
  const runInfoByShowId = useMemo(() => {
    const map = new Map();
    Object.values(runIndex).forEach(run => {
      run.nights.forEach((night, i) => {
        map.set(night.showId, { runKey: run.key, nightNumber: i + 1, nightCount: run.nightCount });
      });
    });
    return map;
  }, [runIndex]);
  const tourHrefFor = (show) => {
    if (!show.tour) return null;
    const key = tourKeyFor(show.artist, show.tour);
    return key && tourIndex[key] ? `/tours/?tour=${encodeURIComponent(key)}` : null;
  };
  const sortedTours = useMemo(
    () => Object.values(tourIndex).sort((a, b) => (a.dateRange.start < b.dateRange.start ? 1 : -1)),
    [tourIndex]
  );

  // Arriving from a Top Artists / Top Venues row: seed the filter from the
  // URL once, then drop it from the URL so refreshing doesn't re-trigger it.
  const searchParams = useSearchParams();
  const [filterLabel, setFilterLabel] = useState(null); // { type: 'artist'|'venue', name }

  useEffect(() => {
    const artist = searchParams.get('artist');
    const venue = searchParams.get('venue');
    const year = searchParams.get('year');
    if (artist) {
      setSearchTerm(artist);
      setFilterLabel({ type: 'artist', name: artist });
    } else if (venue) {
      setSearchTerm(venue);
      setFilterLabel({ type: 'venue', name: venue });
    }
    if (year) setFilterYear(year);
    if (artist || venue || year) {
      const url = new URL(window.location.href);
      url.searchParams.delete('artist');
      url.searchParams.delete('venue');
      url.searchParams.delete('year');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Backfill artist images for existing shows — runs once after shows load, non-blocking
  useEffect(() => {
    if (isLoading || !shows.length) return;
    const hasMissing = shows.some(s => !s.artistImage);
    if (hasMissing) {
      // Delay start so the page renders first
      const timer = setTimeout(() => backfillArtistImages(), 3000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (isLoading) {
    return <ShowsListSkeleton />;
  }

  // When a show is selected (from either Timeline or Artist tab), render the
  // unified full detail view inline (no routing, no page reload).
  if (selectedShow) {
    return (
      <>
        <ShowDetailView
          show={selectedShow}
          friends={friends}
          onClose={() => setSelectedShow(null)}
          onUpdateRating={updateShowRating}
          onUpdateVenueRating={(showId, venueRating) => updateShowData(showId, { venueRating })}
          onUpdateComment={!guestMode ? (showId, comment) => updateShowComment(showId, comment) : undefined}
          onTagFriends={!guestMode ? (show) => setTagFriendsShow(show) : undefined}
          onCreatePlaylist={!guestMode ? (show) => setPlaylistShow(show) : undefined}
          onDeleteShow={deleteShow}
          onAddSong={!guestMode ? addSongToShow : undefined}
          onReorderSetlist={!guestMode ? updateSetlistOrder : undefined}
          toggleFavoriteArtist={!guestMode ? toggleFavoriteArtist : undefined}
          isArtistFavorite={isArtistFavorite}
          allShows={shows}
          user={user}
        />
        {tagFriendsShow && (
          <TagFriendsModal
            show={tagFriendsShow}
            friends={friends}
            onTag={(selectedFriendUids) => tagFriendsAtShow(tagFriendsShow, selectedFriendUids)}
            onInviteByEmail={(params) => tagFriendByEmail({ ...params, show: tagFriendsShow })}
            onClose={() => setTagFriendsShow(null)}
          />
        )}
        {playlistShow && (
          <PlaylistCreatorModal
            show={playlistShow}
            onClose={() => setPlaylistShow(null)}
          />
        )}
      </>
    );
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
          {filterLabel && (
            <Link
              href={filterLabel.type === 'artist' ? '/stats/top-artists' : '/stats/top-venues'}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary mb-3"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to {filterLabel.type === 'artist' ? 'Top Artists' : 'Top Venues'}
            </Link>
          )}
          <PageHeader
            eyebrow={filterLabel ? (filterLabel.type === 'artist' ? 'Top Artists' : 'Top Venues') : 'Library'}
            title={filterLabel
              ? (filterLabel.type === 'artist'
                  ? `Your${filterYear ? ` ${filterYear}` : ''} shows seeing ${filterLabel.name}`
                  : `Your${filterYear ? ` ${filterYear}` : ''} shows at ${filterLabel.name}`)
              : 'My Shows'}
            subtitle={filterLabel
              ? `${sortedFilteredShows.length} show${sortedFilteredShows.length !== 1 ? 's' : ''}`
              : (shows.length > 0
                ? `${shows.length} shows · ${summaryStats.uniqueArtists} artists · ${summaryStats.uniqueVenues} venues`
                : 'Your concert journey starts here')}
            actions={
              <>
                <Button variant="secondary" icon={Camera} onClick={() => navigateTo('scan-import')}>Scan / Import</Button>
                <Button icon={Search} onClick={() => navigateTo('search')}>Search for a Show</Button>
              </>
            }
          />

          {!filterLabel && !guestMode && <YearInReviewCard shows={shows} user={user} />}

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

          {shows.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
              <Card padding="sm"><StatFigure value={shows.length} label="Shows" /></Card>
              <Card padding="sm"><StatFigure value={summaryStats.uniqueArtists} label="Artists" /></Card>
              <Card padding="sm"><StatFigure value={summaryStats.uniqueVenues} label="Venues" /></Card>
              <Card padding="sm"><StatFigure value={summaryStats.avgRating ? `${summaryStats.avgRating}★` : '--'} label="Avg Rating" /></Card>
            </div>
          )}

          {/* View tabs — Timeline (card grid) vs By Artist (table) */}
          {shows.length > 0 && (
            <div className="flex items-center gap-1 border-b border-subtle mb-6">
              {[
                { id: 'timeline', label: 'Timeline', count: sortedFilteredShows.length },
                { id: 'artist', label: 'By artist', count: artistGroups.length },
                { id: 'tours', label: 'Tours', count: sortedTours.length },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setShowsTab(t.id)}
                  className={`px-4 pb-3 pt-1 text-[14px] font-semibold transition-colors border-b-2 -mb-px ${
                    showsTab === t.id
                      ? 'border-brand text-primary'
                      : 'border-transparent text-muted hover:text-secondary'
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-[11px] font-bold ${showsTab === t.id ? 'text-brand' : 'text-muted'}`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {shows.length > 0 && !guestMode && friends.length > 0 && (
            <div className="flex justify-end mb-4">
              <Button
                size="sm"
                variant={selectionMode ? 'secondary' : 'ghost'}
                icon={selectionMode ? CheckSquare : Square}
                onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
              >
                {selectionMode ? 'Done selecting' : 'Select shows'}
              </Button>
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
                  onClick={() => { setFilterYear(''); setFilterDate(''); setSearchTerm(''); setFilterLabel(null); }}
                  className="text-danger hover:bg-danger/10"
                >
                  Clear
                </Button>
              )}

              <Link href="/advanced-search/">
                <Button variant="ghost" size="sm" icon={Search}>Advanced search</Button>
              </Link>
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
              onSubmit={bucketListPrefill ? handleAddShowFromBucketList : addShow}
              onCancel={() => { setShowForm(false); setBucketListPrefill(null); }}
              friends={user && !guestMode ? friends : []}
              onTagFriends={tagFriendsAtShow}
              initialData={bucketListPrefill}
            />
          )}

          {/* Timeline: show list */}
          {showsTab === 'timeline' && sortedFilteredShows.length > 0 && (
            <div className="space-y-3 mb-8">
              {sortedFilteredShows.map(show => (
                <ShowCard
                  key={show.id}
                  show={show}
                  friends={friends}
                  onClick={() => setSelectedShow(show)}
                  onDelete={() => setShowToDelete(show)}
                  runInfo={runInfoByShowId.get(show.id) || null}
                  tourHref={tourHrefFor(show)}
                />
              ))}
            </div>
          )}

          {/* Artist groups table */}
          {showsTab === 'artist' && sortedFilteredShows.length > 0 && (
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
                      onDeleteShow={(show) => setShowToDelete(show)}
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

          {/* Tours: collapsible tour cards */}
          {showsTab === 'tours' && (
            <ToursTabView tours={sortedTours} shows={shows} onSelectShow={setSelectedShow} />
          )}

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

          {/* Delete show confirmation modal */}
          <DeleteShowModal
            show={showToDelete}
            isOpen={!!showToDelete}
            onClose={() => setShowToDelete(null)}
            onConfirm={deleteShow}
          />

        </>
      )}
    </>
  );
}
