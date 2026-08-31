'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { parseDate } from '@/lib/utils';
import { groupSongsBySet, getSetLabels, getSetOptions, moveSongToSet, reorderSongWithinSet } from '@/lib/setlistGrouping';
import { artistSlugFromName, songSlugFromTitle } from '@/lib/songIndex';
import { buildRunIndex } from '@/lib/runIndex';
import SetlistView from './SetlistView';
import { Avatar, Button } from '@/components/ui';
import EntityInfoPanel from '@/components/EntityInfoPanel';
import StreamingLinks from '@/components/StreamingLinks';
import ArchivalAudioSection from './ArchivalAudioSection';
import {
  UserPlus, Heart, Share2, ListMusic, Hash,
  Trash2, X, Tag, MessageSquare, ArrowLeft, Plus,
  Pencil, Check, ChevronUp, ChevronDown,
} from 'lucide-react';
import DeleteShowModal from './DeleteShowModal';
import CommentsSection from '@/components/comments/CommentsSection';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatShowDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d || d.getFullYear() < 1900) return dateStr || '';
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function buildSets(setlist = []) {
  return groupSongsBySet(setlist).map(({ label, songs }) => ({
    label,
    tracks: songs.map(song => ({
      title: song.song || song.name || song.title || '',
      cover: song.cover || null,
      debut: !!(song.debut || song.tags?.includes('debut')),
      bustout: !!(song.bustout || song.tags?.includes('bustout')),
      bustoutNote: song.bustoutNote || null,
      duration: song.duration || null,
      tape: song.tape || false,
      manual: !!song.manuallyAdded,
    })),
  }));
}

// ── Micro-components ───────────────────────────────────────────────────────────

function IconBtn({ onClick, children, active, activeClass = 'text-brand bg-brand/10', danger, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${
        active
          ? activeClass
          : danger
            ? 'text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
            : 'text-muted hover:text-primary hover:bg-hover'
      } ${className}`}
    >
      {children}
    </button>
  );
}

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

// Owner-only editor for moving a song between sets/encore and reordering
// within a set — operates directly on the raw `setlist` array (with stable
// song.id) rather than the display-only `sets`/`tracks` shape from buildSets().
function SetlistEditControls({ setlist, onMoveSet, onReorder }) {
  const groups = groupSongsBySet(setlist);
  const setOptions = getSetOptions(setlist);

  return (
    <div>
      {groups.map(group => (
        <section key={group.label} className="mb-2">
          <div className="flex items-center gap-3 mt-6 mb-3 first:mt-0">
            <hr className="flex-1 border-t border-subtle m-0" />
            <span className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-muted">
              {group.label}
            </span>
            <hr className="flex-1 border-t border-subtle m-0" />
          </div>
          <ol className="list-none p-0 m-0 space-y-1.5">
            {group.songs.map((song, i) => (
              <li
                key={song.id}
                className="grid grid-cols-[28px_1fr_auto] gap-3 items-center px-2.5 py-2 rounded-lg bg-hover"
              >
                <span className="font-mono text-xs text-muted font-bold text-right">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] font-medium text-primary leading-snug truncate">
                  {song.song || song.name || song.title || ''}
                  {song.manuallyAdded && (
                    <span className="ml-2 inline-block text-[9px] font-extrabold tracking-[0.1em] uppercase text-secondary bg-surface px-1.5 py-0.5 rounded">
                      added by you
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onReorder(group.label, i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${song.name || song.song || 'song'} up`}
                    className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReorder(group.label, i, 1)}
                    disabled={i === group.songs.length - 1}
                    aria-label={`Move ${song.name || song.song || 'song'} down`}
                    className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <select
                    value={song.set || group.label}
                    onChange={e => onMoveSet(song.id, e.target.value)}
                    aria-label={`Move ${song.name || song.song || 'song'} to a different set`}
                    className="border border-subtle rounded-lg px-2 py-2 text-xs text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand/40 cursor-pointer"
                  >
                    {setOptions.map(label => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function StatRow({ label, value, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[13px] text-secondary shrink-0">{label}</dt>
      <dd className={`text-[13px] font-bold text-right ${
        tone === 'brand' ? 'text-brand' : tone === 'amber' ? 'text-amber' : 'text-primary'
      }`}>
        {value}
      </dd>
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
  onUpdateComment,
  onTagFriends,
  onCreatePlaylist,
  onDeleteShow,
  onAddSong,
  onReorderSetlist,
  toggleFavoriteArtist,
  isArtistFavorite,
  allShows = [],
  user,
}) {
  const [showPlayCounts, setShowPlayCounts] = useState(true);
  const [toast, setToast] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [newSongName, setNewSongName] = useState('');
  const [newSongSet, setNewSongSet] = useState('');
  const [editMode, setEditMode] = useState(false);

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
      .forEach(s => (s.setlist || []).forEach(song => {
        const name = song.song || song.title || song.name || '';
        if (name) counts[name] = (counts[name] || 0) + 1;
      }));
    return counts;
  }, [allShows, show?.artist]);
  // Reuses lib/runIndex.js's pure builder directly off the `allShows` prop
  // (which every caller already passes as the full context `shows` array)
  // rather than the useRunIndex hook, since this component takes shows as a
  // prop, not via useApp().
  const runForThisShow = useMemo(() => {
    if (!show?.id) return null;
    const index = buildRunIndex(allShows);
    const run = Object.values(index).find(r => r.nights.some(n => n.showId === show.id));
    if (!run) return null;
    const nightNumber = run.nights.findIndex(n => n.showId === show.id) + 1;
    return { runKey: run.key, nightNumber, nightCount: run.nightCount };
  }, [allShows, show?.id]);
  const artistSlug = show?.artist ? artistSlugFromName(show.artist) : null;
  const getSongHref = (title) => {
    if (!artistSlug) return null;
    const songSlug = songSlugFromTitle(title);
    return songSlug ? `/songs/?artist=${artistSlug}&song=${songSlug}` : null;
  };
  const totalDuration = useMemo(() => {
    let secs = 0;
    (show?.setlist || []).forEach(s => {
      const parts = (s.duration || '').split(':').map(Number);
      if (parts.length === 2) secs += parts[0] * 60 + parts[1];
    });
    if (!secs) return null;
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [show?.setlist]);

  if (!show) return null;

  const sets              = buildSets(show.setlist);
  const existingSetLabels = getSetLabels(show.setlist);
  const totalSongs        = show.setlist?.length || 0;
  const debuts            = (show.setlist || []).filter(s => s.debut || s.tags?.includes('debut')).length;
  const bustouts          = (show.setlist || []).filter(s => s.bustout || s.tags?.includes('bustout'));
  const taggedFriendIds   = new Set(show.taggedFriendUids || []);
  const taggedFriends     = friends.filter(f => taggedFriendIds.has(f.friendUid));
  const isFavorite        = isArtistFavorite?.(show.artist) || false;

  const handleShare = async () => {
    try { await navigator.clipboard.writeText(`https://mysetlists.net/shows/${show.id}`); } catch {}
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  const saveNote = () => {
    onUpdateComment?.(show.id, noteText.trim());
    setEditingNote(false);
  };

  const handleAddSong = (e) => {
    e.preventDefault();
    if (!newSongName.trim()) return;
    const set = newSongSet || existingSetLabels[existingSetLabels.length - 1] || 'Set I';
    onAddSong?.(show.id, { name: newSongName.trim(), set });
    setNewSongName('');
  };

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Back button ────────────────────────────────────────────────────── */}
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All shows
      </button>

      {/* ── Header card ────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-subtle rounded-2xl p-6 mb-6">

        {/* Artist name + action icons */}
        <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-subtle">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <h1 className="text-2xl font-bold text-amber">{show.artist}</h1>
            {show.url && (
              <a
                href={show.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-subtle text-muted hover:bg-hover transition-colors"
              >
                setlist.fm
              </a>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0 -mr-1">
            {toggleFavoriteArtist && (
              <IconBtn
                onClick={() => toggleFavoriteArtist(show.artist)}
                active={isFavorite}
                activeClass="text-red-500"
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500' : ''}`} />
              </IconBtn>
            )}
            {onTagFriends && user && (
              <IconBtn onClick={() => onTagFriends(show)}>
                <Tag className="w-5 h-5" />
              </IconBtn>
            )}
            <IconBtn onClick={handleShare}>
              <Share2 className="w-5 h-5" />
            </IconBtn>
            {onCreatePlaylist && totalSongs > 0 && (
              <IconBtn onClick={() => onCreatePlaylist(show)}>
                <ListMusic className="w-5 h-5" />
              </IconBtn>
            )}
            <IconBtn
              onClick={() => setShowPlayCounts(v => !v)}
              active={showPlayCounts}
              activeClass="text-brand bg-brand/10"
            >
              <Hash className="w-5 h-5" />
            </IconBtn>
            {onDeleteShow && user && (
              <IconBtn onClick={() => setShowDeleteModal(true)} danger>
                <Trash2 className="w-5 h-5" />
              </IconBtn>
            )}
            <IconBtn onClick={onClose}>
              <X className="w-5 h-5" />
            </IconBtn>
          </div>
        </div>

        {/* Date · Venue, City */}
        <p className="text-sm text-secondary mb-1">
          {formatShowDate(show.date)}
          {show.venue && ` · ${show.venue}${show.city ? `, ${show.city}` : ''}`}
        </p>

        {/* Tour */}
        {(show.tour || show.tourName) && (
          <p className="text-sm font-medium text-brand mb-3">
            Tour: {show.tourName || show.tour}
          </p>
        )}

        {runForThisShow && (
          <Link
            href={`/runs/?run=${encodeURIComponent(runForThisShow.runKey)}`}
            className="inline-block text-sm font-semibold text-amber bg-amber-subtle px-2.5 py-1 rounded-lg mb-3 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            Night {runForThisShow.nightNumber} of {runForThisShow.nightCount} — view the full run
          </Link>
        )}

        {/* Show + venue ratings */}
        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Show rating:</span>
            <select
              value={show.rating || ''}
              onChange={e => onUpdateRating?.(show.id, Number(e.target.value) || 0)}
              className="border border-subtle rounded-lg px-2 py-1 text-sm text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand/40 cursor-pointer"
            >
              <option value="">—</option>
              {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {(show.rating || 0) > 0 && (
              <span className="text-sm font-semibold text-brand">{show.rating}/10</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Venue rating:</span>
            <select
              value={show.venueRating || ''}
              onChange={e => onUpdateVenueRating?.(show.id, Number(e.target.value) || 0)}
              className="border border-subtle rounded-lg px-2 py-1 text-sm text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand/40 cursor-pointer"
            >
              <option value="">—</option>
              {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {(show.venueRating || 0) > 0 && (
              <span className="text-sm font-semibold text-amber">{show.venueRating}/10</span>
            )}
          </div>
        </div>

        {/* Show note */}
        {editingNote ? (
          <div className="mb-4 flex gap-2">
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), saveNote())}
              placeholder="Add a note about this show..."
              rows={2}
              autoFocus
              className="flex-1 px-3 py-2 border border-subtle rounded-lg text-sm text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
            />
            <div className="flex flex-col gap-1">
              <button onClick={saveNote} className="px-3 py-1.5 bg-brand text-[#2a2a4e] rounded-lg text-xs font-medium">
                Save
              </button>
              <button onClick={() => setEditingNote(false)} className="px-3 py-1.5 bg-hover text-secondary rounded-lg text-xs font-medium">
                Cancel
              </button>
            </div>
          </div>
        ) : show.comment ? (
          <button
            onClick={() => { setEditingNote(true); setNoteText(show.comment); }}
            className="flex items-start gap-2 mb-4 text-sm text-secondary hover:text-primary transition-colors text-left w-full"
          >
            <MessageSquare className="w-4 h-4 shrink-0 mt-0.5 text-muted" />
            <span className="italic">{show.comment}</span>
          </button>
        ) : (
          <button
            onClick={() => { setEditingNote(true); setNoteText(''); }}
            className="flex items-center gap-2 mb-4 text-sm text-muted hover:text-primary transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Add show note
          </button>
        )}

        {/* About panels */}
        <div className="space-y-1">
          <EntityInfoPanel
            name={show.artist}
            type="artist"
            extraContent={
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">Shows seen</span>
                  <span className="font-semibold text-primary">{artistShowCount}</span>
                </div>
                <a href={`/stats?artist=${encodeURIComponent(show.artist)}`} className="text-xs text-brand hover:underline block">
                  View full artist stats →
                </a>
              </div>
            }
          />
          {show.venue && (
            <EntityInfoPanel
              name={show.venue}
              type="venue"
              city={show.city}
              extraContent={
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-secondary">Shows seen here</span>
                    <span className="font-semibold text-primary">{venueShowCount}</span>
                  </div>
                  {(show.city || show.state) && (
                    <div className="flex justify-between">
                      <span className="text-secondary">Location</span>
                      <span className="font-semibold text-primary">{[show.city, show.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  <a href={`/shows?venue=${encodeURIComponent(show.venue)}`} className="text-xs text-amber hover:underline block">
                    All shows at this venue →
                  </a>
                </div>
              }
            />
          )}
        </div>
      </div>

      {/* ── Two-column: setlist + sidebar ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10 items-start">

        <section>
          <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
            <h2 className="text-[22px] font-extrabold text-primary tracking-tight">Setlist</h2>
            <div className="flex items-center gap-2">
              {onReorderSetlist && totalSongs > 0 && (
                <button
                  onClick={() => setEditMode(v => !v)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    editMode ? 'bg-brand text-[#2a2a4e]' : 'bg-hover text-primary'
                  }`}
                >
                  {editMode ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                  {editMode ? 'Done editing' : 'Edit setlist'}
                </button>
              )}
              {totalSongs > 0 && !editMode && (
                <button
                  onClick={() => setShowPlayCounts(v => !v)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    showPlayCounts ? 'bg-elevated text-primary' : 'bg-hover text-primary'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  {showPlayCounts ? 'Hide play counts' : 'Show play counts'}
                </button>
              )}
            </div>
          </div>

          {editMode ? (
            <SetlistEditControls
              setlist={show.setlist || []}
              onMoveSet={(songId, newLabel) => onReorderSetlist(show.id, moveSongToSet(show.setlist, songId, newLabel))}
              onReorder={(setLabel, index, direction) => onReorderSetlist(show.id, reorderSongWithinSet(show.setlist, setLabel, index, direction))}
            />
          ) : sets.length > 0 ? (
            <SetlistView
              sets={sets}
              showPlayCounts={showPlayCounts}
              playCounts={playCounts}
              getSongHref={getSongHref}
            />
          ) : (
            <p className="text-muted text-sm py-10 text-center">No setlist recorded yet.</p>
          )}

          {onAddSong && (
            <form onSubmit={handleAddSong} className="flex gap-2 mt-4">
              <input
                type="text"
                value={newSongName}
                onChange={e => setNewSongName(e.target.value)}
                placeholder="Add a song setlist.fm missed..."
                className="flex-1 px-3 py-2 border border-subtle rounded-lg text-sm text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand/40 placeholder-muted"
              />
              <select
                value={newSongSet || existingSetLabels[existingSetLabels.length - 1] || 'Set I'}
                onChange={e => setNewSongSet(e.target.value)}
                className="border border-subtle rounded-lg px-2 py-2 text-sm text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand/40 cursor-pointer"
              >
                {getSetOptions(show.setlist).map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
              <Button variant="secondary" type="submit" icon={Plus} disabled={!newSongName.trim()}>
                Add song
              </Button>
            </form>
          )}

          <StreamingLinks show={show} />
          <ArchivalAudioSection show={show} />
        </section>

        <aside className="space-y-3 lg:sticky lg:top-6">
          {totalSongs > 0 && (
            <SidebarCard>
              <SidebarLabel>Show Stats</SidebarLabel>
              <dl className="space-y-2.5">
                <StatRow label="Songs" value={totalSongs} />
                {totalDuration && <StatRow label="Duration" value={totalDuration} />}
                {show.tour && <StatRow label="Tour" value={show.tour} />}
                {debuts > 0 && <StatRow label="Debuts" value={`${debuts} song${debuts !== 1 ? 's' : ''}`} tone="brand" />}
                {bustouts.length > 0 && (
                  <StatRow
                    label="Bust-outs"
                    value={`${bustouts[0].song || bustouts[0].name || bustouts[0].title}${bustouts.length > 1 ? ` (+${bustouts.length - 1})` : ''}`}
                    tone="amber"
                  />
                )}
              </dl>
            </SidebarCard>
          )}

          {taggedFriends.length > 0 && (
            <SidebarCard>
              <SidebarLabel>Friends Who Were There</SidebarLabel>
              <ul className="space-y-3">
                {taggedFriends.map(f => (
                  <li key={f.friendUid} className="flex items-center gap-3">
                    <Avatar name={f.friendName || ''} size="sm" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-primary leading-snug">{f.friendName || 'Friend'}</div>
                      {f.friendEmail && <div className="text-[11px] text-muted truncate">{f.friendEmail}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </SidebarCard>
          )}

          {onTagFriends && (
            <Button variant="secondary" icon={UserPlus} className="w-full" onClick={() => onTagFriends(show)}>
              Tag friends
            </Button>
          )}
        </aside>
      </div>

      <CommentsSection show={show} />

      {/* Share toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-success text-white font-medium text-sm px-4 py-2 rounded-lg shadow-lg pointer-events-none">
          Link copied to clipboard!
        </div>
      )}

      <DeleteShowModal
        show={show}
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async (showId) => { await onDeleteShow(showId); onClose(); }}
      />
    </div>
  );
}
