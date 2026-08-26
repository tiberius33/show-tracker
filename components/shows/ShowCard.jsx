// components/shows/ShowCard.jsx
//
// Show summary card — artist, tour, date, venue, song count, and average
// song rating. Shared between the Stats "Years" breakdown and the Shows
// page timeline so a show renders identically wherever it's listed.

import React from 'react';
import { Calendar, MapPin, MessageSquare, Trash2 } from 'lucide-react';
import { formatDate, artistColor, avgSongRating } from '@/lib/utils';
import { Card, Badge } from '@/components/ui';

export default function ShowCard({ show, onClick, onDelete }) {
  const songAvg = avgSongRating(show.setlist || []);

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
            <span className="text-xs text-brand font-medium">
              {show.tour}
            </span>
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
        <div className="flex items-center gap-4 mt-2 text-xs text-muted">
          <span>{show.setlist?.length || 0} songs</span>
          {songAvg && <span>Avg song rating: {songAvg}/10</span>}
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
          className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete show"
          aria-label="Delete show"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </Card>
  );
}
