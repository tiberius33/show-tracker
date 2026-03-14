'use client';

import { Music, Calendar, MapPin, Star } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function SharedCollectionView({ data }) {
  if (!data) return null;

  const { ownerName, shows, stats } = data;

  // Group shows by artist
  const artistGroups = {};
  shows.forEach(show => {
    const artist = show.artist || 'Unknown';
    if (!artistGroups[artist]) artistGroups[artist] = [];
    artistGroups[artist].push(show);
  });

  const sortedArtists = Object.entries(artistGroups).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            {ownerName}&apos;s Concert Collection
          </h1>
          <p className="text-white/50">Shared from MySetlists</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="text-3xl font-bold text-emerald-400">{stats.totalShows || shows.length}</div>
            <div className="text-sm text-white/50 mt-1">Shows</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="text-3xl font-bold text-teal-400">{stats.totalSongs || 0}</div>
            <div className="text-sm text-white/50 mt-1">Songs</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="text-3xl font-bold text-violet-400">{sortedArtists.length}</div>
            <div className="text-sm text-white/50 mt-1">Artists</div>
          </div>
          {stats.avgRating && (
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="text-3xl font-bold text-amber-400">{stats.avgRating}</div>
              <div className="text-sm text-white/50 mt-1">Avg Rating</div>
            </div>
          )}
        </div>

        {/* Shows by Artist */}
        <div className="space-y-4 mb-8">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Music className="w-4 h-4 text-emerald-400" />
            Shows by Artist
          </h2>
          {sortedArtists.map(([artist, artistShows]) => (
            <div key={artist} className="bg-white/5 rounded-2xl border border-white/10 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold">{artist}</h3>
                <span className="text-emerald-400 text-xs font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {artistShows.length} show{artistShows.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {artistShows.map((show, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <MapPin className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                        <span className="truncate">{show.venue}{show.city ? `, ${show.city}` : ''}</span>
                      </div>
                      {show.setlist && show.setlist.length > 0 && (
                        <div className="text-xs text-white/40 mt-0.5 ml-5.5">
                          {show.setlist.length} song{show.setlist.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      {show.rating && (
                        <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                          <Star className="w-3 h-3" />
                          {show.rating}/10
                        </span>
                      )}
                      <span className="text-white/40 text-xs">
                        {show.date ? formatDate(show.date) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-white/50 mb-4 text-sm">Track your own concert history for free</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 transition-all"
          >
            <Music className="w-4 h-4" />
            Start Tracking on MySetlists
          </a>
        </div>
      </div>
    </div>
  );
}
