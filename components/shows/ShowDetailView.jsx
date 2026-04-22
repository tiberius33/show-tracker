// components/shows/ShowDetailView.jsx
//
// Full show detail layout rendered inline inside /shows when a card is
// clicked. Accepts the raw `show` object from Firebase so there's no
// dynamic routing or page reload — the parent just swaps state.
//
// Props:
//   show                 – raw show object from Firebase
//   friends              – full friends array (to resolve taggedFriends UIDs)
//   onClose              – () => void  called by the back button
//   onUpdateRating       – (showId, rating) => void  (1-10 scale)
//   onUpdateVenueRating  – (showId, venueRating) => void  (1-10 scale)
//   onTagFriends         – (show) => void  opens TagFriendsModal
//   onCreatePlaylist     – (show) => void  opens PlaylistCreatorModal
//   toggleFavoriteArtist – (artistName) => void
//   isArtistFavorite     – (artistName) => boolean
//   allShows             – all user shows (for play counts + venue/artist stats)
//   user                 – current Firebase user (or null)

'use client';

import React, { useState, useMemo } from 'react';
import { parseDate } from '@/lib/utils';
import ShowHero from './ShowHero';
import SetlistView from './SetlistView';
import { Avatar, Button } from '@/components/ui';
import SongHistoryModal from '@/components/SongHistoryModal';
import {
  ArrowLeft, UserPlus, Heart, Share2, ListMusic, Hash,
  ChevronDown, Music, MapPin, Trash2,
} from 'lucide-react';
import DeleteShowModal from './DeleteShowModal';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatShowDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d || d.getFullYear() < 1900) return dateStr || '';
  const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${DAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()} · ${d.getFullYear()}`;
}

function setBreakToLabel(setBreak) {
  if (!setBreak) return null;
  if (setBreak === 'Main Set') return 'Set I';
  if (setBreak === 'Encore') return 'Encore';
  if (setBreak === 'Encore 2') return 'Encore II';
  const m = setBreak.match(/^Set (\d+)$/);
  if (m) {
    const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    const n = parseInt(m[1]);
    return `Set ${ROMAN[n - 1] || n}`;
  }
  return setBreak;
}

function buildSets(setlist = []) {
  if (!setlist.length) return [];
  const groups = {};
  const hasSetField = setlist.some(s => s.set);

  if (hasSetField) {
    setlist.forEach(song => {
      const key = song.set || 'Set I';
      if (!groups[key]) groups[key] = [];
      groups[key].push(song);
    });
  } else {
    let currentLabel = 'Set I';
    setlist.forEach(song => {
      if (song.setBreak) currentLabel = setBreakToLabel(song.setBreak) || currentLabel;
      if (!groups[currentLabel]) groups[currentLabel] = [];
      groups[currentLabel].push(song);
    });
  }

  const ORDER = ['Set I', 'Set II', 'Set III', 'Encore', 'Encore II'];
  const keys = [
    ...ORDER.filter(k => groups[k]),
    ...Object.keys(groups).filter(k => !ORDER.includes(k)),
  ];
  return keys.map(label => ({
    label,
    tracks: (groups[label] || []).map(s => ({
      title:       s.song || s.title || s.name || '',
      duration:    s.duration || '',
      debut:       !!(s.tags?.includes('debut')   || s.debut),
      bustout:     !!(s.tags?.includes('bustout') || s.bustout),
      bustoutNote: s.bustoutNote || '',
      cover:       s.cover || null,
      tape:        s.tape || false,
    })),
  }));
}

// ── Micro-components ───────────────────────────────────────────────────────────

function SidebarLabel({ children }) {
  return (
    <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-muted mb-3">
      {children}
    </p>
  );
}

function SidebarCard({ children, className = '' }) {
  return (
    <div className={`bg-surface border border-subtle rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function StatRow({ label, value, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[13px] text-secondary shrink-0">{label}</dt>
      <dd className={`text-[13px] font-bold text-right ${
        tone === 'brand' ? 'text-brand' :
        tone === 'amber' ? 'text-amber' :
        'text-primary'
      }`}>
        {value}
      </dd>
    </div>
  );
}

function CompactRating({ label, value, onChange, accentColor = 'emerald' }) {
  const borderClass = accentColor === 'orange'
    ? 'border-orange-400 focus:ring-orange-400'
    : 'border-emerald-400 focus:ring-emerald-400';
  const textClass = accentColor === 'orange' ? 'text-orange-400' : 'text-emerald-400';

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-extrabold tracking-[0.14em] uppercase text-muted min-w-[100px]">
        {label}
      </label>
      <select
        value={value || ''}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className={`bg-gray-800 text-white border-2 ${
          value > 0 ? borderClass : 'border-gray-700'
        } rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${borderClass} cursor-pointer`}
      >
        <option value="">Not rated</option>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <option key={n} value={n}>{n}/10</option>
        ))}
      </select>
      {value > 0 && (
        <button
          onClick={() => onChange(0)}
          className={`text-xs font-semibold ${textClass}`}
        >
          {value}/10
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ShowDetailView({
  show,
  friends = [],
  onClose,
  onUpdateRating,
  onUpdateVenueRating,
  onTagFriends,
  onCreatePlaylist,
  onDeleteShow,
  toggleFavoriteArtist,
  isArtistFavorite,
  allShows = [],
  user,
}) {
  const [showPlayCounts, setShowPlayCounts] = useState(false);
  const [artistExpanded, setArtistExpanded]   = useState(false);
  const [venueExpanded, setVenueExpanded]     = useState(false);
  const [songHistorySong, setSongHistorySong] = useState(null);
  const [toast, setToast] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // All hooks must run unconditionally — computed after hooks, used only when show != null
  const artistShowCount = useMemo(
    () => allShows.filter(s => s.artist === show?.artist).length,
    [allShows, show?.artist]
  );

  const venueShowCount = useMemo(
    () => allShows.filter(s => s.venue === show?.venue).length,
    [allShows, show?.venue]
  );

  const playCounts = useMemo(() => {
    const counts = {};
    allShows
      .filter(s => s.artist === show?.artist)
      .forEach(s => {
        (s.setlist || []).forEach(song => {
          const name = song.song || song.title || song.name || '';
          if (name) counts[name] = (counts[name] || 0) + 1;
        });
      });
    return counts;
  }, [allShows, show?.artist]);

  const totalDuration = useMemo(() => {
    let totalSecs = 0;
    (show?.setlist || []).forEach(s => {
      const d = s.duration || '';
      const parts = d.split(':').map(Number);
      if (parts.length === 2) totalSecs += parts[0] * 60 + parts[1];
    });
    if (!totalSecs) return null;
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [show?.setlist]);

  if (!show) return null;

  const sets       = buildSets(show.setlist);
  const totalSongs = show.setlist?.length || 0;
  const debuts     = (show.setlist || []).filter(s => s.tags?.includes('debut')   || s.debut).length;
  const bustouts   = (show.setlist || []).filter(s => s.tags?.includes('bustout') || s.bustout);

  const taggedFriendIds = new Set(show.taggedFriends || []);
  const taggedFriends   = friends.filter(f => taggedFriendIds.has(f.friendUid));

  const specialLabel = (() => {
    const notes = (show.notes || '').toLowerCase();
    if (notes.includes('halloween')) return 'HALLOWEEN';
    if (show.night) return `NIGHT ${show.night}`;
    return null;
  })();

  const dateFull = [formatShowDate(show.date), specialLabel].filter(Boolean).join(' · ');

  const isFavorite = isArtistFavorite?.(show.artist) || false;

  const handleShare = async () => {
    const url = `https://mysetlists.net/show/${show.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // silently fail
    }
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  const handleViewShow = () => {
    setSongHistorySong(null);
  };

  return (
    <div className="max-w-5xl mx-auto">

      {/* Back link */}
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All shows
      </button>

      {/* Hero */}
      <ShowHero
        artist={show.artist}
        venue={show.venue}
        city={show.city}
        dateFull={dateFull}
        rating={show.rating}
        badges={[]}
        height={280}
      />

      {/* Action buttons row */}
      <div className="relative z-10 mt-4 mb-6 flex flex-wrap gap-2">
        {/* Favorite artist */}
        {toggleFavoriteArtist && (
          <button
            onClick={() => toggleFavoriteArtist(show.artist)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isFavorite
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-400' : ''}`} />
            {isFavorite ? 'Favorited' : 'Favorite Artist'}
          </button>
        )}

        {/* Tag friend */}
        {onTagFriends && user && (
          <button
            onClick={() => onTagFriends(show)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Tag Friend
          </button>
        )}

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>

        {/* Create playlist */}
        {onCreatePlaylist && (show.setlist?.length || 0) > 0 && (
          <button
            onClick={() => onCreatePlaylist(show)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-400 text-black hover:bg-emerald-300 transition-colors"
          >
            <ListMusic className="w-4 h-4" />
            Create Playlist
          </button>
        )}

        {/* Delete show */}
        {onDeleteShow && user && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-colors ml-auto"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
      </div>

      {/* Body */}
      <div className="relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10 items-start">

          {/* LEFT — Ratings + Setlist + Info sections */}
          <section className="space-y-8">

            {/* Ratings row */}
            <div className="bg-surface border border-subtle rounded-2xl p-4 space-y-3">
              <CompactRating
                label="Show Rating"
                value={show.rating || 0}
                onChange={r => onUpdateRating?.(show.id, r)}
                accentColor="emerald"
              />
              <CompactRating
                label="Venue Rating"
                value={show.venueRating || 0}
                onChange={r => onUpdateVenueRating?.(show.id, r)}
                accentColor="orange"
              />
              {show.comment && (
                <p className="text-secondary text-sm italic pt-1 border-t border-subtle">
                  &ldquo;{show.comment}&rdquo;
                </p>
              )}
            </div>

            {/* Setlist */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[22px] font-extrabold text-primary tracking-tight">
                  Setlist
                </h2>
                {totalSongs > 0 && (
                  <button
                    onClick={() => setShowPlayCounts(v => !v)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      showPlayCounts
                        ? 'bg-emerald-400/10 text-emerald-400'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    {showPlayCounts ? 'Hide play counts' : 'Show play counts'}
                  </button>
                )}
              </div>

              {sets.length > 0
                ? (
                  <SetlistView
                    sets={sets}
                    showPlayCounts={showPlayCounts}
                    playCounts={playCounts}
                    onSongClick={title => setSongHistorySong(title)}
                  />
                )
                : <p className="text-muted text-sm py-10 text-center">No setlist recorded yet.</p>
              }
            </div>

            {/* Notes */}
            {show.notes && (
              <div>
                <h2 className="text-[22px] font-extrabold text-primary tracking-tight mb-4">
                  Notes
                </h2>
                <div className="bg-surface border border-subtle rounded-xl p-5 text-[15px] text-secondary leading-relaxed">
                  {show.notes}
                </div>
              </div>
            )}

            {/* Artist Info — expandable */}
            <div className="bg-gray-900 border border-subtle rounded-lg overflow-hidden">
              <button
                onClick={() => setArtistExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Music className="w-4 h-4 text-brand" />
                  Artist Info
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted transition-transform ${artistExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              {artistExpanded && (
                <div className="px-4 pb-4 space-y-2.5 border-t border-subtle pt-4">
                  <StatRow label="Artist" value={show.artist} />
                  {artistShowCount > 0 && (
                    <StatRow label="Times you've seen them" value={`${artistShowCount} show${artistShowCount !== 1 ? 's' : ''}`} tone="brand" />
                  )}
                  {show.tour && (
                    <StatRow label="Current tour" value={show.tour} />
                  )}
                  <div className="pt-2">
                    <a
                      href={`/stats?artist=${encodeURIComponent(show.artist)}`}
                      className="text-xs text-brand hover:underline"
                    >
                      View full artist stats →
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Venue Info — expandable */}
            <div className="bg-gray-900 border border-subtle rounded-lg overflow-hidden">
              <button
                onClick={() => setVenueExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <MapPin className="w-4 h-4 text-orange-400" />
                  Venue Info
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted transition-transform ${venueExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              {venueExpanded && (
                <div className="px-4 pb-4 space-y-2.5 border-t border-subtle pt-4">
                  <StatRow label="Venue" value={show.venue} />
                  {show.city && (
                    <StatRow label="Location" value={show.city} />
                  )}
                  {venueShowCount > 0 && (
                    <StatRow label="Shows you've seen here" value={`${venueShowCount} show${venueShowCount !== 1 ? 's' : ''}`} tone="amber" />
                  )}
                  {(show.venueRating || 0) > 0 && (
                    <StatRow label="Your venue rating" value={`${show.venueRating}/10`} />
                  )}
                  <div className="pt-2">
                    <a
                      href={`/shows?venue=${encodeURIComponent(show.venue)}`}
                      className="text-xs text-brand hover:underline"
                    >
                      All shows at this venue →
                    </a>
                  </div>
                </div>
              )}
            </div>

          </section>

          {/* RIGHT — Sidebar */}
          <aside className="space-y-3 lg:sticky lg:top-6">

            {/* Show Stats */}
            {totalSongs > 0 && (
              <SidebarCard>
                <SidebarLabel>Show Stats</SidebarLabel>
                <dl className="space-y-2.5">
                  <StatRow label="Songs" value={totalSongs} />
                  {totalDuration && (
                    <StatRow label="Duration" value={totalDuration} />
                  )}
                  {show.tour && (
                    <StatRow label="Tour" value={show.tour} />
                  )}
                  {debuts > 0 && (
                    <StatRow label="Debuts" value={`${debuts} song${debuts !== 1 ? 's' : ''}`} tone="brand" />
                  )}
                  {bustouts.length > 0 && (
                    <StatRow
                      label="Bust-outs"
                      value={`${bustouts[0].name || bustouts[0].song || bustouts[0].title}${bustouts.length > 1 ? ` (+${bustouts.length - 1})` : ''}`}
                      tone="amber"
                    />
                  )}
                </dl>
              </SidebarCard>
            )}

            {/* Friends who were there */}
            {taggedFriends.length > 0 && (
              <SidebarCard>
                <SidebarLabel>Friends Who Were There</SidebarLabel>
                <ul className="space-y-3">
                  {taggedFriends.map(f => (
                    <li key={f.friendUid} className="flex items-center gap-3">
                      <Avatar name={f.friendName || ''} size="sm" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-primary leading-snug">
                          {f.friendName || 'Friend'}
                        </div>
                        {f.friendEmail && (
                          <div className="text-[11px] text-muted truncate">{f.friendEmail}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </SidebarCard>
            )}

            {/* Tag friends */}
            {user && onTagFriends && (
              <Button
                variant="secondary"
                icon={UserPlus}
                className="w-full"
                onClick={() => onTagFriends(show)}
              >
                Tag friends
              </Button>
            )}

          </aside>
        </div>
      </div>

      {/* Share toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-400 text-black font-medium text-sm px-4 py-2 rounded-lg shadow-lg pointer-events-none">
          Link copied to clipboard!
        </div>
      )}

      {/* Song history modal */}
      {songHistorySong && (
        <SongHistoryModal
          songName={songHistorySong}
          artistName={show.artist}
          allShows={allShows}
          onClose={() => setSongHistorySong(null)}
          onViewShow={handleViewShow}
        />
      )}

      {/* Delete confirmation modal */}
      <DeleteShowModal
        show={show}
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async (showId) => {
          await onDeleteShow(showId);
          onClose();
        }}
      />

    </div>
  );
}
