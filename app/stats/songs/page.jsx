'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Music, ArrowUp, ArrowDown } from 'lucide-react';
import { PageHeader, SectionHeader, Card, EmptyState, Select } from '@/components/ui';
import StatsSubNav from '@/components/stats/StatsSubNav';
import useSongIndex from '@/hooks/useSongIndex';
import { songSlugFromTitle } from '@/lib/songIndex';

// Per-artist song list — times seen + current personal gap, sortable by
// both. Deliberately not scoped to the year/all-time period the other
// Stats subpages use: a "gap" is measured against the artist's *entire*
// show history, so filtering it to one year would make the numbers wrong,
// not just narrower.
export default function StatsSongsPage() {
  const songIndex = useSongIndex();
  const [artistSlug, setArtistSlug] = useState('');
  const [sortKey, setSortKey] = useState('timesSeen'); // 'timesSeen' | 'gap'
  const [sortDir, setSortDir] = useState('desc');

  const artists = useMemo(() => {
    const map = new Map();
    Object.values(songIndex).forEach((song) => {
      if (!map.has(song.artistSlug)) {
        map.set(song.artistSlug, { artistSlug: song.artistSlug, artistName: song.artistName, songCount: 0 });
      }
      map.get(song.artistSlug).songCount += 1;
    });
    return [...map.values()].sort((a, b) => a.artistName.localeCompare(b.artistName));
  }, [songIndex]);

  const effectiveArtistSlug = artistSlug || artists[0]?.artistSlug || '';
  const selectedArtist = artists.find((a) => a.artistSlug === effectiveArtistSlug);

  const songs = useMemo(() => {
    return Object.values(songIndex)
      .filter((s) => s.artistSlug === effectiveArtistSlug)
      .sort((a, b) => {
        const av = sortKey === 'timesSeen' ? a.timesSeen : a.currentGap.shows;
        const bv = sortKey === 'timesSeen' ? b.timesSeen : b.currentGap.shows;
        return sortDir === 'desc' ? bv - av : av - bv;
      });
  }, [songIndex, effectiveArtistSlug, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = sortDir === 'desc' ? ArrowDown : ArrowUp;

  return (
    <>
      <PageHeader eyebrow="Stats" title="Songs" />

      <StatsSubNav active="songs" />

      {artists.length === 0 ? (
        <EmptyState icon={Music} title="No songs tracked yet" body="Log some shows with setlists to see your song stats." />
      ) : (
        <>
          <div className="mb-6 max-w-xs">
            <Select
              label="Artist"
              value={effectiveArtistSlug}
              onChange={(e) => setArtistSlug(e.target.value)}
              options={artists.map((a) => ({ value: a.artistSlug, label: `${a.artistName} (${a.songCount})` }))}
            />
          </div>

          <Card padding="lg">
            <SectionHeader title={`Songs — ${selectedArtist?.artistName || ''}`} />

            <div className="flex items-center gap-4 pb-2.5 mb-1 border-b border-subtle text-[11px] font-extrabold uppercase tracking-wide text-muted">
              <span className="flex-1">Song</span>
              <button
                type="button"
                onClick={() => toggleSort('timesSeen')}
                className="flex items-center gap-1 hover:text-primary transition-colors w-24 justify-end focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
              >
                Times Seen {sortKey === 'timesSeen' && <SortIcon className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => toggleSort('gap')}
                className="flex items-center gap-1 hover:text-primary transition-colors w-24 justify-end focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
              >
                Gap {sortKey === 'gap' && <SortIcon className="w-3 h-3" />}
              </button>
            </div>

            <ul className="list-none p-0 m-0">
              {songs.map((song) => (
                <li key={song.key} className="border-b border-subtle last:border-0">
                  <Link
                    href={`/songs/?artist=${song.artistSlug}&song=${songSlugFromTitle(song.title)}`}
                    className="flex items-center gap-4 py-3 -mx-2 px-2 rounded-lg hover:bg-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  >
                    <span className="flex-1 text-[15px] font-medium text-primary truncate">{song.title}</span>
                    <span className="w-24 text-right font-mono font-bold text-primary">{song.timesSeen}</span>
                    <span className="w-24 text-right font-mono font-bold text-primary">{song.currentGap.shows}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
