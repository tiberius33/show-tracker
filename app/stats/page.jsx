'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { parseDate } from '@/lib/utils';
import StatsView from '@/components/StatsView';
import { PageHeader, StatTile, SectionHeader, Tag } from '@/components/ui';
import YearHeatmap from '@/components/stats/YearHeatmap';
import TopList from '@/components/stats/TopList';

export default function StatsPage() {
  const {
    shows, getSongStats, getArtistStats, getVenueStats, getTopRatedShows,
    updateSongRating, updateSongComment, addSongToShow, deleteSong,
    updateShowRating, updateShowComment, batchRateUnrated,
    user, guestMode, setTagFriendsShow, setVenueRatingShow, statsTab,
    getVenueRatings, normalizeVenueKey, computeVenueAggregate,
    toggleFavoriteArtist, isArtistFavorite,
  } = useApp();

  const availableYears = useMemo(() => {
    const years = new Set();
    shows.forEach(s => {
      const d = parseDate(s.date);
      if (d.getFullYear() > 1970) years.add(d.getFullYear());
    });
    return [...years].sort((a, b) => b - a);
  }, [shows]);

  const [period, setPeriod] = useState('all-time');

  const periodShows = useMemo(() => {
    if (period === 'all-time') return shows;
    return shows.filter(s => {
      const d = parseDate(s.date);
      return d.getFullYear() === Number(period);
    });
  }, [shows, period]);

  const monthlyCounts = useMemo(() => {
    const counts = Array(12).fill(0);
    periodShows.forEach(s => {
      const d = parseDate(s.date);
      const m = d.getMonth();
      if (m >= 0 && m < 12) counts[m]++;
    });
    return counts;
  }, [periodShows]);

  const totalSongs = useMemo(() =>
    periodShows.reduce((acc, s) => acc + (s.setlist?.length || 0), 0),
  [periodShows]);

  const uniqueArtists = useMemo(() =>
    new Set(periodShows.map(s => s.artist)).size,
  [periodShows]);

  const uniqueVenues = useMemo(() =>
    new Set(periodShows.map(s => s.venue)).size,
  [periodShows]);

  const topArtists = useMemo(() => {
    const map = {};
    periodShows.forEach(s => { map[s.artist] = (map[s.artist] || 0) + 1; });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count, meta: `${count} show${count !== 1 ? 's' : ''}` }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [periodShows]);

  const topVenues = useMemo(() => {
    const map = {};
    periodShows.forEach(s => {
      const key = s.venue + (s.city ? `, ${s.city}` : '');
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count, meta: `${count} show${count !== 1 ? 's' : ''}` }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [periodShows]);

  const periodLabels = ['all-time', ...availableYears.map(String)];

  return (
    <>
      <PageHeader
        eyebrow={`Stats · ${period === 'all-time' ? 'All time' : period}`}
        title="Your shows, by the numbers."
        subtitle={periodShows.length > 0
          ? `${periodShows.length} shows · ${uniqueArtists} artists · ${uniqueVenues} venues`
          : 'Add some shows to start seeing your stats'}
        actions={
          <div className="flex gap-2 flex-wrap">
            {periodLabels.map((p) => (
              <Tag
                key={p}
                selected={p === period}
                onClick={() => setPeriod(p)}
              >
                {p === 'all-time' ? 'All-time' : p}
              </Tag>
            ))}
          </div>
        }
      />

      {periodShows.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
            <StatTile value={periodShows.length} label="Shows" />
            <StatTile value={totalSongs.toLocaleString()} label="Songs heard" tone="brand" />
            <StatTile value={uniqueArtists} label="Artists" />
            <StatTile value={uniqueVenues} label="Venues" />
          </div>

          <section className="bg-surface border border-subtle rounded-2xl p-7 md:p-8 mb-5">
            <SectionHeader
              title="Show frequency"
              subtitle={period === 'all-time' ? 'All time · shows per month' : `${period} · shows per month`}
            />
            <YearHeatmap
              counts={monthlyCounts}
              year={period === 'all-time' ? null : period}
            />
          </section>

          {(topArtists.length > 0 || topVenues.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
              {topArtists.length > 0 && (
                <section className="bg-surface border border-subtle rounded-2xl p-7 md:p-8">
                  <SectionHeader title="Top artists" />
                  <TopList items={topArtists} />
                </section>
              )}
              {topVenues.length > 0 && (
                <section className="bg-surface border border-subtle rounded-2xl p-7 md:p-8">
                  <SectionHeader title="Top venues" />
                  <TopList items={topVenues} />
                </section>
              )}
            </div>
          )}
        </>
      )}

      <SectionHeader title="Detailed breakdown" className="mb-4" />
      <StatsView
        shows={shows}
        songStats={getSongStats()}
        artistStats={getArtistStats()}
        venueStats={getVenueStats()}
        topRatedShows={getTopRatedShows()}
        onRateSong={updateSongRating}
        onCommentSong={updateSongComment}
        onAddSong={addSongToShow}
        onDeleteSong={deleteSong}
        onRateShow={updateShowRating}
        onCommentShow={updateShowComment}
        onBatchRate={batchRateUnrated}
        initialTab={statsTab}
        onTagFriends={!guestMode ? (show) => setTagFriendsShow(show) : undefined}
        onRateVenue={user && !guestMode ? (show) => setVenueRatingShow(show) : undefined}
        onToggleFavoriteArtist={!guestMode ? toggleFavoriteArtist : undefined}
        isArtistFavorite={isArtistFavorite}
        fetchVenueRatings={getVenueRatings}
        normalizeVenueKey={normalizeVenueKey}
        computeVenueAggregate={computeVenueAggregate}
      />
    </>
  );
}
