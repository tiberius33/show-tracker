// components/shows/ShowDetailView.jsx
//
// Full show detail layout rendered inline inside /shows when a card is
// clicked. Accepts the raw `show` object from Firebase so there's no
// dynamic routing or page reload — the parent just swaps state.
//
// Props:
//   show          – raw show object from Firebase
//   friends       – full friends array (to resolve taggedFriends UIDs)
//   onClose       – () => void  called by the back button
//   onUpdateRating – (showId, rating) => void
//   onTagFriends  – (show) => void  opens TagFriendsModal
//   user          – current Firebase user (or null)

'use client';

import React from 'react';
import { parseDate } from '@/lib/utils';
import ShowHero from './ShowHero';
import SetlistView from './SetlistView';
import { RatingStars, Avatar, Button } from '@/components/ui';
import { ArrowLeft, UserPlus } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatShowDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d || d.getFullYear() < 1900) return dateStr || '';
  const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${DAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()} · ${d.getFullYear()}`;
}

// Maps legacy setBreak marker values to canonical set labels
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
    // New format: each song carries its own set label
    setlist.forEach(song => {
      const key = song.set || 'Set I';
      if (!groups[key]) groups[key] = [];
      groups[key].push(song);
    });
  } else {
    // Legacy format: setBreak marker on first song of each set
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

// ── Main component ─────────────────────────────────────────────────────────────

export default function ShowDetailView({
  show,
  friends = [],
  onClose,
  onUpdateRating,
  onTagFriends,
  user,
}) {
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

      {/* Hero — ShowHero has -mb-20 built in; content below overlaps it */}
      <ShowHero
        artist={show.artist}
        venue={show.venue}
        city={show.city}
        dateFull={dateFull}
        rating={show.rating}
        badges={[]}
        height={280}
      />

      {/* Body — relative z-10 lifts above hero gradient */}
      <div className="relative z-10 pt-2">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10 items-start">

          {/* LEFT — Setlist + Notes */}
          <section>
            <h2 className="text-[22px] font-extrabold text-primary tracking-tight mb-5">
              Setlist
            </h2>

            {sets.length > 0
              ? <SetlistView sets={sets} />
              : <p className="text-muted text-sm py-10 text-center">No setlist recorded yet.</p>
            }

            {show.notes && (
              <div className="mt-10">
                <h2 className="text-[22px] font-extrabold text-primary tracking-tight mb-4">
                  Notes
                </h2>
                <div className="bg-surface border border-subtle rounded-xl p-5 text-[15px] text-secondary leading-relaxed">
                  {show.notes}
                </div>
              </div>
            )}
          </section>

          {/* RIGHT — Sidebar cards */}
          <aside className="space-y-3 lg:sticky lg:top-6">

            {/* Your Rating */}
            <SidebarCard>
              <SidebarLabel>Your Rating</SidebarLabel>
              <RatingStars
                value={show.rating || 0}
                onChange={r => onUpdateRating?.(show.id, r)}
                size={26}
              />
              {show.rating > 0 && (
                <p className="text-secondary text-sm mt-2">
                  {show.rating} / 5
                  {show.comment && (
                    <span className="italic"> — &ldquo;{show.comment}&rdquo;</span>
                  )}
                </p>
              )}
            </SidebarCard>

            {/* Show Stats */}
            {totalSongs > 0 && (
              <SidebarCard>
                <SidebarLabel>Show Stats</SidebarLabel>
                <dl className="space-y-2.5">
                  <StatRow label="Songs" value={totalSongs} />
                  {show.tour && (
                    <StatRow label="Tour" value={show.tour} />
                  )}
                  {debuts > 0 && (
                    <StatRow label="Debuts" value={`${debuts} songs`} tone="brand" />
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
            {user && (
              <Button
                variant="secondary"
                icon={UserPlus}
                className="w-full"
                onClick={() => onTagFriends?.(show)}
              >
                Tag friends
              </Button>
            )}

          </aside>
        </div>
      </div>
    </div>
  );
}
