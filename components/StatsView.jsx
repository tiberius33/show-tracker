'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Music, Users, Building2, Star, ChevronDown, MapPin, MessageSquare, Heart } from 'lucide-react';
import { formatDate, parseDate, artistColor, avgSongRating } from '@/lib/utils';
import SongStatsRow from '@/components/SongStatsRow';
import SetlistEditor from '@/components/SetlistEditor';
import PlaylistCreatorModal from '@/components/PlaylistCreatorModal';

function StatsView({ shows, songStats, artistStats, venueStats, topRatedShows, onRateSong, onCommentSong, onAddSong, onDeleteSong, onRateShow, onCommentShow, onBatchRate, initialTab, onTagFriends, onRateVenue, onToggleFavoriteArtist, isArtistFavorite, fetchVenueRatings, normalizeVenueKey, computeVenueAggregate }) {
  const [tab, setTab] = useState(initialTab || 'years');
  const [selectedYear, setSelectedYear] = useState(null);
  const [filterArtist, setFilterArtist] = useState('');
  const [filterVenue, setFilterVenue] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [expandedVenue, setExpandedVenue] = useState(null);
  const [expandedYear, setExpandedYear] = useState(null);
  const [expandedShow, setExpandedShow] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);
  const [playlistShow, setPlaylistShow] = useState(null);
  const [venueRatingsMap, setVenueRatingsMap] = useState({}); // venueKey -> aggregate | null

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  // Load venue ratings when venues tab becomes active
  useEffect(() => {
    if (tab !== 'venues' || !fetchVenueRatings || !normalizeVenueKey || !computeVenueAggregate) return;
    let cancelled = false;
    async function loadAll() {
      const keys = [...new Set(shows.map(s => normalizeVenueKey(s.venue, s.city)))];
      const results = await Promise.all(keys.map(async (key) => {
        try {
          const ratings = await fetchVenueRatings(key);
          return [key, computeVenueAggregate(ratings)];
        } catch { return [key, null]; }
      }));
      if (!cancelled) setVenueRatingsMap(Object.fromEntries(results));
    }
    loadAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Keep selectedShow in sync with shows data
  useEffect(() => {
    if (selectedShow) {
      const updatedShow = shows.find(s => s.id === selectedShow.id);
      if (updatedShow) {
        setSelectedShow(updatedShow);
      }
    }
  }, [shows, selectedShow?.id]);

  const uniqueArtists = useMemo(() =>
    [...new Set(shows.map(s => s.artist))].sort(), [shows]);
  const uniqueVenues = useMemo(() =>
    [...new Set(shows.map(s => s.venue))].sort(), [shows]);
  const uniqueYears = useMemo(() => {
    const years = new Set();
    shows.forEach(s => {
      const d = parseDate(s.date);
      if (d.getFullYear() > 1970) years.add(d.getFullYear());
    });
    return [...years].sort((a, b) => b - a);
  }, [shows]);

  const showsByYear = useMemo(() => {
    const grouped = {};
    shows.forEach(show => {
      const d = parseDate(show.date);
      const year = d.getFullYear();
      if (year > 1970) {
        if (!grouped[year]) grouped[year] = [];
        grouped[year].push(show);
      }
    });
    // Sort shows within each year by date descending
    Object.keys(grouped).forEach(year => {
      grouped[year].sort((a, b) => parseDate(b.date) - parseDate(a.date));
    });
    return grouped;
  }, [shows]);

  // Venue details: grouped by venue -> year -> shows
  const venueDetails = useMemo(() => {
    const details = {};
    shows.forEach(show => {
      const venueName = show.venue + (show.city ? `, ${show.city}` : '');
      if (!details[venueName]) {
        details[venueName] = { years: {}, artistSet: new Set(), sampleShow: show };
      }
      const year = parseDate(show.date).getFullYear();
      if (!details[venueName].years[year]) {
        details[venueName].years[year] = [];
      }
      details[venueName].years[year].push(show);
      details[venueName].artistSet.add(show.artist);
    });
    // Convert to sorted array
    return Object.entries(details)
      .map(([name, data]) => ({
        name,
        venueKey: normalizeVenueKey ? normalizeVenueKey(data.sampleShow.venue, data.sampleShow.city) : name.toLowerCase(),
        sampleShow: data.sampleShow,
        showCount: Object.values(data.years).flat().length,
        artistCount: data.artistSet.size,
        years: Object.entries(data.years)
          .map(([year, yearShows]) => ({
            year: Number(year),
            shows: yearShows.sort((a, b) => parseDate(b.date) - parseDate(a.date))
          }))
          .sort((a, b) => b.year - a.year)
      }))
      .sort((a, b) => b.showCount - a.showCount);
  }, [shows, normalizeVenueKey]);

  const hasFilters = filterArtist || filterVenue || filterYear;

  const filteredSongStats = useMemo(() => {
    if (!hasFilters) return songStats;
    const songMap = {};
    shows.forEach(show => {
      if (filterArtist && show.artist !== filterArtist) return;
      if (filterVenue && show.venue !== filterVenue) return;
      if (filterYear) {
        const d = parseDate(show.date);
        if (d.getFullYear() !== Number(filterYear)) return;
      }
      show.setlist.forEach(song => {
        if (!songMap[song.name]) {
          songMap[song.name] = { count: 0, ratings: [], shows: [] };
        }
        songMap[song.name].count++;
        if (song.rating) songMap[song.name].ratings.push(song.rating);
        songMap[song.name].shows.push({
          showId: show.id,
          songId: song.id,
          date: show.date,
          artist: show.artist,
          venue: show.venue,
          city: show.city,
          rating: song.rating,
          comment: song.comment
        });
      });
    });
    return Object.entries(songMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgRating: data.ratings.length ?
          (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1) : null,
        shows: data.shows
      }))
      .sort((a, b) => b.count - a.count);
  }, [shows, songStats, filterArtist, filterVenue, filterYear, hasFilters]);

  const selectClass = "px-3 py-2.5 bg-hover border border-subtle rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 cursor-pointer";

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { id: 'years', label: 'Years', icon: Calendar },
          { id: 'songs', label: 'Songs', icon: Music },
          { id: 'artists', label: 'Artists', icon: Users },
          { id: 'venues', label: 'Venues', icon: Building2 },
          { id: 'top', label: 'Top Shows', icon: Star },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium transition-all text-sm ${
              tab === id
                ? 'bg-gradient-to-r from-brand to-amber text-on-dark shadow-lg shadow-brand/20'
                : 'bg-hover border border-subtle hover:bg-hover text-secondary'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'songs' && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-primary">Song Statistics</h2>

          <div className="bg-hover backdrop-blur-xl rounded-2xl border border-subtle p-4 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-secondary">Filter:</span>
              <select value={filterArtist} onChange={(e) => setFilterArtist(e.target.value)} className={selectClass}>
                <option value="" className="bg-elevated">All Artists</option>
                {uniqueArtists.map(a => <option key={a} value={a} className="bg-elevated">{a}</option>)}
              </select>
              <select value={filterVenue} onChange={(e) => setFilterVenue(e.target.value)} className={selectClass}>
                <option value="" className="bg-elevated">All Venues</option>
                {uniqueVenues.map(v => <option key={v} value={v} className="bg-elevated">{v}</option>)}
              </select>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className={selectClass}>
                <option value="" className="bg-elevated">All Years</option>
                {uniqueYears.map(y => <option key={y} value={y} className="bg-elevated">{y}</option>)}
              </select>
              {hasFilters && (
                <button
                  onClick={() => { setFilterArtist(''); setFilterVenue(''); setFilterYear(''); }}
                  className="text-xs font-medium text-secondary hover:text-primary px-2 py-1 rounded-lg hover:bg-hover transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {filteredSongStats.length === 0 ? (
            <p className="text-center text-muted py-8 font-medium">
              {hasFilters ? 'No songs match the current filters' : 'No songs tracked yet'}
            </p>
          ) : (
            <div className="bg-hover border border-subtle rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-hover border-b border-subtle">
                    <th className="text-left px-4 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Song</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Times Played</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredSongStats.map((song, i) => (
                    <SongStatsRow key={song.name} song={song} index={i} onRateSong={onRateSong} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'artists' && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-primary">Artist Statistics</h2>
          {artistStats.length === 0 ? (
            <p className="text-center text-muted py-8 font-medium">No shows tracked yet</p>
          ) : (
            <div className="space-y-2">
              {artistStats.map((artist) => {
                const isExpanded = expandedShow === `artist-${artist.name}`;
                const artistShows = shows
                  .filter(s => s.artist === artist.name)
                  .sort((a, b) => parseDate(b.date) - parseDate(a.date));
                return (
                  <div key={artist.name}>
                    <button
                      onClick={() => setExpandedShow(isExpanded ? null : `artist-${artist.name}`)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-hover transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: artistColor(artist.name) }} />
                        <span className="font-medium group-hover:text-brand transition-colors" style={{ color: artistColor(artist.name) }}>{artist.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {onToggleFavoriteArtist && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleFavoriteArtist(artist.name); }}
                            className="p-1.5 rounded-lg hover:bg-hover transition-colors"
                            title={isArtistFavorite?.(artist.name) ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Heart className={`w-4 h-4 transition-colors ${isArtistFavorite?.(artist.name) ? 'text-red-500 fill-red-500' : 'text-muted hover:text-red-400'}`} />
                          </button>
                        )}
                        <span className="bg-brand-subtle text-brand px-2.5 py-1 rounded-full text-sm font-semibold">
                          {artist.count} show{artist.count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-muted text-sm hidden sm:inline">{artist.totalSongs} songs</span>
                        {artist.avgRating ? (
                          <div className="flex items-center gap-1 text-secondary text-sm">
                            <Star className="w-3.5 h-3.5 text-brand" />
                            <span>{artist.avgRating}</span>
                          </div>
                        ) : null}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="space-y-2 pl-4 pr-2 pb-2 mt-1">
                        {artistShows.map(show => (
                          <div
                            key={show.id}
                            onDoubleClick={() => setSelectedShow(show)}
                            className="bg-hover border border-subtle rounded-2xl p-4 hover:bg-hover transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-secondary text-sm">
                                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>{formatDate(show.date)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-secondary text-sm mt-1">
                                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate">{show.venue}{show.city ? `, ${show.city}` : ''}</span>
                                </div>
                                {show.tour && (
                                  <div className="text-brand/70 text-sm mt-1">{show.tour}</div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {show.rating && (
                                  <div className="flex items-center gap-1">
                                    <Star className="w-4 h-4 text-brand fill-amber" />
                                    <span className="text-primary font-medium">{show.rating}</span>
                                  </div>
                                )}
                                <span className="text-muted text-sm">{show.setlist?.length || 0} songs</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'venues' && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-primary">Venue Statistics</h2>
          {/* Top Rated Venues section */}
          {(() => {
            const topRated = venueDetails
              .filter(v => venueRatingsMap[v.venueKey]?.count >= 2)
              .sort((a, b) => (venueRatingsMap[b.venueKey]?.overallAvg || 0) - (venueRatingsMap[a.venueKey]?.overallAvg || 0))
              .slice(0, 5);
            if (!topRated.length) return null;
            return (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-3">Top Rated</h3>
                <div className="space-y-2">
                  {topRated.map((v, i) => (
                    <div key={v.name} className="flex items-center gap-3 px-4 py-2.5 bg-brand/5 border border-brand/20 rounded-xl">
                      <span className="text-brand/50 font-bold text-sm w-4">#{i+1}</span>
                      <span className="text-primary text-sm flex-1">{v.name}</span>
                      <span className="flex items-center gap-1 text-brand font-semibold text-sm">
                        <Star className="w-3.5 h-3.5" fill="currentColor" />
                        {venueRatingsMap[v.venueKey]?.overallAvg?.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {venueDetails.length === 0 ? (
            <p className="text-center text-muted py-8 font-medium">No shows tracked yet</p>
          ) : (
            <div className="space-y-3">
              {venueDetails.map((venue) => (
                <div key={venue.name} className="bg-hover border border-subtle rounded-2xl overflow-hidden">
                  {/* Venue Header */}
                  <button
                    onClick={() => setExpandedVenue(expandedVenue === venue.name ? null : venue.name)}
                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-5 h-5 text-muted transition-transform ${expandedVenue === venue.name ? 'rotate-180' : ''}`} />
                      <span className="font-medium text-primary">{venue.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {venueRatingsMap[venue.venueKey] && (
                        <span className="flex items-center gap-1 text-brand text-sm font-semibold">
                          <Star className="w-3.5 h-3.5" fill="currentColor" />
                          {venueRatingsMap[venue.venueKey].overallAvg?.toFixed(1)}
                          <span className="text-brand/50 font-normal">({venueRatingsMap[venue.venueKey].count})</span>
                        </span>
                      )}
                      <span className="bg-brand-subtle text-brand px-2.5 py-1 rounded-full text-sm font-semibold">
                        {venue.showCount} shows
                      </span>
                      <span className="text-secondary text-sm">{venue.artistCount} artists</span>
                    </div>
                  </button>

                  {/* Expanded Years */}
                  {expandedVenue === venue.name && (
                    <div className="border-t border-subtle bg-hover">
                      {onRateVenue && (
                        <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
                          {venueRatingsMap[venue.venueKey] ? (
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-secondary">Community avg:</span>
                              <span className="text-brand font-semibold flex items-center gap-1">
                                <Star className="w-3.5 h-3.5" fill="currentColor" />
                                {venueRatingsMap[venue.venueKey].overallAvg?.toFixed(1)} / 5
                                <span className="text-brand/50 font-normal">from {venueRatingsMap[venue.venueKey].count} rating{venueRatingsMap[venue.venueKey].count !== 1 ? 's' : ''}</span>
                              </span>
                            </div>
                          ) : <span className="text-muted text-sm">No ratings yet</span>}
                          <button
                            onClick={() => onRateVenue(venue.sampleShow)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-subtle hover:bg-brand/30 text-brand border border-brand/30 rounded-xl text-xs font-medium transition-colors"
                          >
                            <Star className="w-3.5 h-3.5" />
                            Rate Venue
                          </button>
                        </div>
                      )}
                      {venue.years.map(({ year, shows: yearShows }) => (
                        <div key={year}>
                          {/* Year Header */}
                          <button
                            onClick={() => setExpandedYear(expandedYear === `${venue.name}-${year}` ? null : `${venue.name}-${year}`)}
                            className="w-full flex items-center justify-between px-6 py-3 hover:bg-hover transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDown className={`w-4 h-4 text-muted transition-transform ${expandedYear === `${venue.name}-${year}` ? 'rotate-180' : ''}`} />
                              <span className="font-medium text-brand">{year}</span>
                            </div>
                            <span className="text-secondary text-sm">{yearShows.length} shows</span>
                          </button>

                          {/* Expanded Shows */}
                          {expandedYear === `${venue.name}-${year}` && (
                            <div className="bg-hover">
                              {yearShows.map((show) => (
                                <div key={show.id}>
                                  {/* Show Header */}
                                  <button
                                    onClick={() => setExpandedShow(expandedShow === show.id ? null : show.id)}
                                    className="w-full flex items-center justify-between px-8 py-2 hover:bg-hover transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <ChevronDown className={`w-3 h-3 text-muted transition-transform ${expandedShow === show.id ? 'rotate-180' : ''}`} />
                                      <span className="text-secondary">{formatDate(show.date)}</span>
                                      <span className="text-muted">-</span>
                                      <span style={{ color: artistColor(show.artist) }}>{show.artist}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {show.rating && (
                                        <span className="text-brand text-sm font-medium">{show.rating}/10</span>
                                      )}
                                      <span className="text-muted text-sm">{show.setlist.length} songs</span>
                                    </div>
                                  </button>

                                  {/* Expanded Setlist */}
                                  {expandedShow === show.id && (
                                    <div className="bg-hover px-10 py-3 border-t border-subtle">
                                      {show.tour && (
                                        <div className="text-brand text-sm font-medium mb-2">{show.tour}</div>
                                      )}
                                      <div className="space-y-1">
                                        {show.setlist.map((song, idx) => (
                                          <div key={song.id || idx} className="flex items-center gap-2 text-sm">
                                            {song.setBreak && (
                                              <div className="text-brand font-semibold text-xs mt-2 mb-1 w-full">{song.setBreak}</div>
                                            )}
                                            <span className="text-muted w-6">{idx + 1}.</span>
                                            <span className="text-secondary">{song.name}</span>
                                            {song.rating && (
                                              <span className="text-brand text-xs">({song.rating}/10)</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'years' && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-primary">Shows by Year</h2>
          {uniqueYears.length === 0 ? (
            <p className="text-center text-muted py-8 font-medium">No shows tracked yet</p>
          ) : (
            <div className="bg-hover border border-subtle rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-hover border-b border-subtle">
                    <th className="text-left px-4 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Year</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Shows</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {uniqueYears.map((year) => {
                    const yearShows = showsByYear[year] || [];
                    const ratedShows = yearShows.filter(s => s.rating);
                    const avgRating = ratedShows.length
                      ? (ratedShows.reduce((a, s) => a + s.rating, 0) / ratedShows.length).toFixed(1)
                      : null;
                    const isExpanded = expandedYear === year;

                    return (
                      <React.Fragment key={year}>
                        <tr
                          className="cursor-pointer hover:bg-hover transition-colors"
                          onClick={() => setExpandedYear(isExpanded ? null : year)}
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <ChevronDown className={`w-4 h-4 text-muted flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              <span className="font-bold text-xl text-brand">{year}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="bg-brand-subtle text-brand px-2.5 py-1 rounded-full text-sm font-semibold">
                              {yearShows.length}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {avgRating ? (
                              <span className="text-sm font-semibold text-brand">{avgRating}/10</span>
                            ) : (
                              <span className="text-muted">--</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={3} className="px-4 py-0 bg-hover/30">
                              <div className="py-4 pl-6 border-l-2 border-brand/50 ml-2 mb-2">
                                <div className="text-xs font-semibold text-muted mb-3 uppercase tracking-wide">Shows in {year}</div>
                                <div className="space-y-3">
                                  {yearShows.map((show) => {
                                    const songAvg = avgSongRating(show.setlist);
                                    return (
                                      <div
                                        key={show.id}
                                        className="flex items-start justify-between bg-hover rounded-2xl p-4 border border-subtle cursor-pointer hover:bg-hover transition-colors"
                                        onClick={(e) => { e.stopPropagation(); setSelectedShow(show); }}
                                      >
                                        <div className="flex-1">
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
                                            <span>{show.setlist.length} songs</span>
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
                                            <span className="inline-flex items-center gap-1 bg-brand-subtle text-brand px-2.5 py-1 rounded-full font-bold text-sm">
                                              {show.rating}/10
                                            </span>
                                          ) : (
                                            <span className="text-muted text-sm">Not rated</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'top' && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-primary">Top Rated Shows</h2>
          {topRatedShows.length === 0 ? (
            <p className="text-center text-muted py-8 font-medium">No rated shows yet</p>
          ) : (
            <div className="bg-hover border border-subtle rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-hover border-b border-subtle">
                    <th className="text-center px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide w-12">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Artist</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Venue</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Date</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {topRatedShows.map((show, i) => (
                    <tr
                      key={show.id}
                      className="hover:bg-hover transition-colors cursor-pointer"
                      onClick={() => setSelectedShow(show)}
                    >
                      <td className="px-4 py-3 text-center text-lg font-bold text-muted">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: artistColor(show.artist) }}>{show.artist}</div>
                        {show.tour && <div className="text-xs text-brand font-medium">{show.tour}</div>}
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {show.venue}{show.city ? `, ${show.city}` : ''}
                      </td>
                      <td className="px-4 py-3 text-secondary">{formatDate(show.date)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 bg-brand-subtle text-brand px-2.5 py-1 rounded-full font-bold text-sm">
                          {show.rating || '--'}/10
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedShow && (
        <SetlistEditor
          show={selectedShow}
          allShows={shows}
          onAddSong={(song) => onAddSong(selectedShow.id, song)}
          onRateSong={(songId, rating) => onRateSong(selectedShow.id, songId, rating)}
          onCommentSong={(songId, comment) => onCommentSong(selectedShow.id, songId, comment)}
          onDeleteSong={(songId) => onDeleteSong(selectedShow.id, songId)}
          onRateShow={(rating) => onRateShow(selectedShow.id, rating)}
          onCommentShow={(comment) => onCommentShow(selectedShow.id, comment)}
          onBatchRate={(rating) => onBatchRate(selectedShow.id, rating)}
          onClose={() => setSelectedShow(null)}
          onCreatePlaylist={(show) => setPlaylistShow(show)}
          onTagFriends={onTagFriends}
          onRateVenue={onRateVenue}
          onToggleFavoriteArtist={onToggleFavoriteArtist}
          isArtistFavorite={isArtistFavorite}
        />
      )}

      {playlistShow && (
        <PlaylistCreatorModal
          show={playlistShow}
          onClose={() => setPlaylistShow(null)}
        />
      )}
    </div>
  );
}

export default StatsView;
