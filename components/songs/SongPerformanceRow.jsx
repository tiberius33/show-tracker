// components/songs/SongPerformanceRow.jsx
//
// One performance of one song — date, venue/city, set label + position,
// segue markers, the "added by you" flag, and the user's rating of that
// performance. Extracted verbatim from SongDetailView so the song page and
// the Stats → Songs inline expansion render the same row from the same
// code; `compact` only swaps the wrapper's padding/chrome, never the
// content, so the two can't drift apart.
//
// Ratings are per-performance: updateSongRating() in AppContext writes
// `rating` onto the individual setlist entry of a single show, and
// lib/songIndex.js copies that straight through. There is no separate
// per-song-overall rating field.
//
// Opens a show via context state (setSelectedShow + /shows/) rather than
// linking straight to /shows/{id} — that dynamic route only ever resolves
// its build-time placeholder under output: 'export', so a real per-id link
// 404s for any show that wasn't statically generated. This mirrors how the
// rest of the app already opens a specific show.

'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';

const CARD_CLASS =
  'block w-full text-left rounded-2xl bg-surface border border-subtle p-4 transition-colors hover:border-active hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';

// Same hover/focus treatment as the app's other clickable list rows (see
// /stats/runs, /stats/songs), plus a 44px floor so the tap target holds on
// mobile even for a row with no set label or segue line.
const COMPACT_CLASS =
  'block w-full text-left rounded-lg px-3 py-2.5 min-h-[44px] transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';

export default function SongPerformanceRow({ perf, onOpen, compact = false }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(perf.showId)}
      className={compact ? COMPACT_CLASS : CARD_CLASS}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-primary">{formatDate(perf.date)}</div>
          <div className="text-xs text-secondary mt-0.5 truncate">
            {perf.venue}{perf.city ? `, ${perf.city}` : ''}
          </div>
          <div className="text-[11px] text-muted mt-1.5 flex items-center gap-2 flex-wrap">
            {perf.setLabel && (
              <span>{perf.setLabel}{perf.position ? ` · #${perf.position}` : ''}</span>
            )}
            {perf.manuallyAdded && <Badge tone="neutral" size="sm">added by you</Badge>}
          </div>
          {/* Same ">" + "segue" vocabulary the show detail setlist uses. */}
          {(perf.segueIn || perf.segueOut) && (
            <div className="text-[11px] text-muted mt-1">
              {perf.segueIn && <span>&gt; segue in</span>}
              {perf.segueIn && perf.segueOut && <span> · </span>}
              {perf.segueOut && <span>segue out &gt;</span>}
            </div>
          )}
        </div>
        {perf.rating > 0 && (
          <div className="flex items-center gap-1 text-sm font-semibold text-amber flex-shrink-0">
            <Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            {perf.rating}/10
          </div>
        )}
      </div>
    </button>
  );
}
