// components/shows/ShowCard.jsx
//
// Show summary card — artist, tour, date, venue, song count, average song
// rating, and any tagged friends. Shared between the Stats "Years" breakdown
// and the Shows page timeline so a show renders identically wherever it's
// listed.

import React from 'react';
import Link from 'next/link';
import { Calendar, MapPin, MessageSquare, Trash2, Tent } from 'lucide-react';
import { formatDate, artistColor, avgSongRating } from '@/lib/utils';
import { festivalHref } from '@/lib/festivalGrouping';
import { Card, Badge } from '@/components/ui';

function taggedFriendsLabel(taggedFriends) {
  if (taggedFriends.length === 0) return null;
  const firstName = (f) => (f.friendName || '').split(' ')[0] || 'a friend';
  if (taggedFriends.length === 1) return `with ${firstName(taggedFriends[0])}`;
  if (taggedFriends.length === 2) return `with ${firstName(taggedFriends[0])} and ${firstName(taggedFriends[1])}`;
  return `with ${taggedFriends.length} friends`;
}

// runInfo: { runKey, nightNumber, nightCount } | null — when this show is
// part of a multi-night run, renders a small "Night N of M" badge linking
// to the run page. tourHref: string | null — when the show carries a tour
// name and it resolves to a real tour, renders that name as a link instead
// of plain text. festival: { id, name } | null — when the show is attached
// to a user-created festival, renders a light pill linking to it. All
// optional so existing callers (e.g. StatsView) are unaffected.
export default function ShowCard({ show, friends = [], onClick, onDelete, runInfo, tourHref, festival }) {
  const songAvg = avgSongRating(show.setlist || []);
  const taggedFriendIds = new Set(show.taggedFriendUids || []);
  const taggedFriends = friends.filter(f => taggedFriendIds.has(f.friendUid));
  const taggedLabel = taggedFriendsLabel(taggedFriends);

  return (
    <Card
      padding="none"
      interactive
      className={`group relative flex items-start justify-between p-4 ${onDelete ? 'pr-11' : ''}`}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold" style={{ color: artistColor(show.artist) }}>
            {show.artist}
          </span>
          {show.tour && (
            tourHref ? (
              <Link
                href={tourHref}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-brand font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
              >
                {show.tour}
              </Link>
            ) : (
              <span className="text-xs text-brand font-medium">
                {show.tour}
              </span>
            )
          )}
          {runInfo && (
            <Link
              href={`/runs/?run=${encodeURIComponent(runInfo.runKey)}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-semibold text-amber bg-amber-subtle px-1.5 py-0.5 rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              Night {runInfo.nightNumber} of {runInfo.nightCount}
            </Link>
          )}
          {festival && (
            <Link
              href={festivalHref(festival.id)}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber bg-amber-subtle px-1.5 py-0.5 rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <Tent className="w-3 h-3" />
              {festival.name}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm mt-1 text-secondary">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(show.date)}
        </div>
        <div className="flex items-center gap-2 text-sm mt-1 text-secondary">
          <MapPin className="w-3.5 h-3.5" />
          {show.venue}{show.city ? `, ${show.city}` : ''}
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted flex-wrap">
          <span>{show.setlist?.length || 0} songs</span>
          {songAvg && <span>Avg song rating: {songAvg}/10</span>}
          {taggedLabel && <span>{taggedLabel}</span>}
        </div>
        {show.comment && (
          <div className="flex items-start gap-1.5 mt-2 text-sm text-secondary italic">
            <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {show.comment}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 ml-4">
        {show.rating ? (
          <Badge tone="navy" size="sm">{show.rating}/10</Badge>
        ) : (
          <span className="text-muted text-sm">Not rated</span>
        )}
      </div>

      {onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          onKeyDown={e => e.stopPropagation()}
          className="absolute top-2.5 right-2.5 p-2.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
          title="Delete show"
          aria-label="Delete show"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </Card>
  );
}
