'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Music, Calendar } from 'lucide-react';

export default function PublicArtistPage() {
  const params = useParams();
  const artistSlug = params.artistSlug;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!artistSlug) return;
    setLoading(true);
    fetch(`/.netlify/functions/get-artist-stats?slug=${encodeURIComponent(artistSlug)}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(data => { setStats(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [artistSlug]);

  const artistName = stats?.artistName || artistSlug?.replace(/-/g, ' ');

  // Update document title client-side
  useEffect(() => {
    if (artistName) {
      document.title = `${artistName} Concert Stats — MySetlists`;
    }
  }, [artistName]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'MusicGroup',
              name: artistName,
              url: `https://mysetlists.net/artist/${artistSlug}`,
              description: `${artistName} has been seen ${stats.showCount} times by ${stats.userCount} fans on MySetlists.`,
            }),
          }}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1" style={{ textTransform: 'capitalize' }}>{artistName}</h1>
          <p className="text-white/50">Community concert stats on MySetlists</p>
        </div>

        {loading && (
          <div className="text-center py-16 text-white/40">Loading stats...</div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-white/40 mb-4">No stats found for this artist yet.</p>
            <a href="/" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-medium transition-colors">
              Track a Show
            </a>
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                <div className="text-3xl font-bold text-emerald-400">{stats.showCount}</div>
                <div className="text-sm text-white/50 mt-1">Shows tracked</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                <div className="text-3xl font-bold text-teal-400">{stats.userCount}</div>
                <div className="text-sm text-white/50 mt-1">Fans tracking</div>
              </div>
            </div>

            {stats.topSongs?.length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-5 mb-6">
                <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <Music className="w-4 h-4 text-emerald-400" />
                  Most Played Songs
                </h2>
                <div className="space-y-2">
                  {stats.topSongs.slice(0, 10).map((song, i) => (
                    <div key={song.name} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-white/30 font-mono text-sm w-5">{i + 1}.</span>
                        <span className="text-white/80 text-sm">{song.name}</span>
                      </div>
                      <span className="text-emerald-400 text-xs font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {song.count}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.recentShows?.length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-5 mb-8">
                <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-400" />
                  Recent Shows
                </h2>
                <div className="space-y-2">
                  {stats.recentShows.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                      <div>
                        <div className="text-white/80 text-sm">{s.venue}</div>
                        {s.city && <div className="text-white/40 text-xs">{s.city}</div>}
                      </div>
                      <span className="text-white/40 text-xs">{s.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
          </>
        )}
      </div>
    </div>
  );
}
