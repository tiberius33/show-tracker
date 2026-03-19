'use client';

import React, { useState } from 'react';
import { ChevronDown, Calendar, MapPin, MessageSquare } from 'lucide-react';
import { formatDate, artistColor } from '@/lib/utils';
import RatingSelect from '@/components/ui/RatingSelect';

function SongStatsRow({ song, index, onRateSong }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-subtle cursor-pointer hover:bg-highlight transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <ChevronDown className={`w-4 h-4 text-muted flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            <span className="font-medium text-primary">{song.name}</span>
          </div>
        </td>
        <td className="px-4 py-4 text-center">
          <span className="bg-accent-amber-glow text-accent-amber px-2.5 py-1 rounded-full text-sm font-semibold">
            {song.count}x
          </span>
        </td>
        <td className="px-4 py-4 text-center">
          {song.avgRating ? (
            <span className="text-sm font-semibold text-accent-amber">
              {song.avgRating}/10
            </span>
          ) : (
            <span className="text-muted">--</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={3} className="px-4 py-0 bg-highlight/30">
            <div className="py-4 pl-6 border-l-2 border-accent-amber/50 ml-2 mb-2">
              <div className="text-xs font-semibold text-muted mb-3 uppercase tracking-wide">Performances</div>
              <div className="space-y-3">
                {song.shows.map((performance, i) => (
                  <div key={i} className="flex items-start justify-between bg-highlight rounded-2xl p-4 border border-subtle">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <Calendar className="w-3.5 h-3.5 text-muted" />
                        <span className="text-secondary">{formatDate(performance.date)}</span>
                        <span className="text-muted">&middot;</span>
                        <span className="font-medium" style={{ color: artistColor(performance.artist) }}>
                          {performance.artist}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-1 text-secondary">
                        <MapPin className="w-3.5 h-3.5" />
                        {performance.venue}{performance.city ? `, ${performance.city}` : ''}
                      </div>
                      {performance.comment && (
                        <div className="flex items-start gap-1.5 mt-1.5 text-sm text-secondary italic">
                          <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          {performance.comment}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      <RatingSelect
                        value={performance.rating}
                        onChange={(r) => onRateSong(performance.showId, performance.songId, r)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default SongStatsRow;
