'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Music, Users, Building2, Star, ChevronDown, MapPin, MessageSquare } from 'lucide-react';
import { formatDate, parseDate, artistColor, avgSongRating } from '@/lib/utils';
import SongStatsRow from '@/components/SongStatsRow';
import SetlistEditor from '@/components/SetlistEditor';

function StatsView({ shows, songStats, artistStats, venueStats, topRatedShows, onRateSong, onCommentSong, onAddSong, onDeleteSong, onRateShow, onCommentShow, onBatchRate, initialTab, onRateVenue, fetchVenueRatings, normalizeVenueKey, computeVenueAggregate }) {
  const [tab, setTab] = useState(initialTab || 'years');
  const [selectedYear, setSelectedYear] = useState(null);
  const [filterArtist, setFilterArtist] = useState('');
  const [filterVenue, setFilterVenue] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [expandedVenue, setExpandedVenue] = useState(null);
  const [expandedYear, setExpandedYear] = useState(null);
  const [expandedShow, setExpandedShow] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);
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

  const selectClass = "px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer";

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
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-white/10 border border-white/10 hover:bg-white/20 text-white/70'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'songs' && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-white">Song Statistics</h2>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-white/50">Filter:</span>
              <select value={filterArtist} onChange={(e) => setFilterArtist(e.target.value)} className={selectClass}>
                <option value="" className="bg-slate-800">All Artists</option>
                {uniqueArtists.map(a => <option key={a} value={a} className="bg-slate-800">{a}</option>)}
              </select>
              <select value={filterVenue} onChange={(e) => setFilterVenue(e.target.value)} className={selectClass}>
                <option value="" className="bg-slate-800">All Venues</option>
                {uniqueVenues.map(v => <option key={v} value={v} className="bg-slate-800">{v}</option>)}
              </select>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className={selectClass}>
                <option value="" className="bg-slate-800">All Years</option>
                {uniqueYears.map(y => <option key={y} value={y} className="bg-slate-800">{y}</option>)}
              </select>
              {hasFilters && (
                <button
                  onClick={() => { setFilterArtist(''); setFilterVenue(''); setFilterYear(''); }}
                  className="text-xs font-medium text-white/50 hover:text-white/70 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {filteredSongStats.length === 0 ? (
            <p className="text-center text-white/40 py-8 font-medium">
              {hasFilters ? 'No songs match the current filters' : 'No songs tracked yet'}
            </p>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="text-left px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Song</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Times Played</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Avg Rating</th>
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
          <h2 className="text-xl font-bold mb-4 text-white">Artist Statistics</h2>
          {artistStats.length === 0 ? (
            <p className="text-center text-white/40 py-8 font-medium">No shows tracked yet</p>
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
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/10 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: artistColor(artist.name) }} />
                        <span className="font-medium group-hover:text-emerald-400 transition-colors" style={{ color: artistColor(artist.name) }}>{artist.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-sm font-semibold">
                          {artist.count} show{artist.count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-white/40 text-sm">{artist.totalSongs} songs</span>
                        {artist.avgRating ? (
                          <div className="flex items-center gap-1 text-white/60 text-sm">
                            <Star className="w-3.5 h-3.5 text-amber-400" />
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
                            className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-white/60 text-sm">
                                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>{formatDate(show.date)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-white/60 text-sm mt-1">
                                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate">{show.venue}{show.city ? `, ${show.city}` : ''}</span>
                                </div>
                                {show.tour && (
                                  <div className="text-emerald-400/70 text-sm mt-1">{show.tour}</div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {show.rating && (
                                  <div className="flex items-center gap-1">
                                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                    <span className="text-white font-medium">{show.rating}</span>
                                  </div>
                                )}
                                <span className="text-white/40 text-sm">{show.setlist?.length || 0} songs</span>
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
          <h2 className="text-xl font-bold mb-4 text-white">Venue Statistics</h2>
          {/* Top Rated Venues section */}
          {(() => {
            const topRated = venueDetails
              .filter(v => venueRatingsMap[v.venueKey]?.count >= 2)
              .sort((a, b) => (venueRatingsMap[b.venueKey]?.overallAvg || 0) - (venueRatingsMap[a.venueKey]?.overallAvg || 0))
              .slice(0, 5);
            if (!topRated.length) return null;
            return (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3">Top Rated</h3>
                <div className="space-y-2">
                  {topRated.map((v, i) => (
                    <div key={v.name} className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                      <span className="text-amber-400/50 font-bold text-sm w-4">#{i+1}</span>
                      <span className="text-white text-sm flex-1">{v.name}</span>
                      <span className="flex items-center gap-1 text-amber-400 font-semibold text-sm">
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
            <p className="text-center text-white/40 py-8 font-medium">No shows tracked yet</p>
          ) : (
            <div className="space-y-3">
              {venueDetails.map((venue) => (
                <div key={venue.name} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  {/* Venue Header */}
                  <button
                    onClick={() => setExpandedVenue(expandedVenue === venue.name ? null : venue.name)}
                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-5 h-5 text-white/40 transition-transform ${expandedVenue === venue.name ? 'rotate-180' : ''}`} />
                      <span className="font-medium text-white">{venue.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {venueRatingsMap[venue.venueKey] && (
                        <span className="flex items-center gap-1 text-amber-400 text-sm font-semibold">
                          <Star className="w-3.5 h-3.5" fill="currentColor" />
                          {venueRatingsMap[venue.venueKey].overallAvg?.toFixed(1)}
                          <span className="text-amber-400/50 font-normal">({venueRatingsMap[venue.venueKey].count})</span>
                        </span>
                      )}
                      <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-sm font-semibold">
                        {venue.showCount} shows
                      </span>
                      <span className="text-white/50 text-sm">{venue.artistCount} artists</span>
                    </div>
                  </button>

                  {/* Expanded Years */}
                  {expandedVenue === venue.name && (
                    <div className="border-t border-white/10 bg-white/5">
                      {onRateVenue && (
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                          {venueRatingsMap[venue.venueKey] ? (
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-white/50">Community avg:</span>
                              <span className="text-amber-400 font-semibold flex items-center gap-1">
                                <Star className="w-3.5 h-3.5" fill="currentColor" />
                                {venueRatingsMap[venue.venueKey].overallAvg?.toFixed(1)} / 5
                                <span className="text-amber-400/50 font-normal">from {venueRatingsMap[venue.venueKey].count} rating{venueRatingsMap[venue.venueKey].count !== 1 ? 's' : ''}</span>
                              </span>
                            </div>
                          ) : <span className="text-white/30 text-sm">No ratings yet</span>}
                          <button
                            onClick={() => onRateVenue(venue.sampleShow)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-medium transition-colors"
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
                            className="w-full flex items-center justify-between px-6 py-3 hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${expandedYear === `${venue.name}-${year}` ? 'rotate-180' : ''}`} />
                              <span className="font-medium text-amber-400">{year}</span>
                            </div>
                            <span className="text-white/50 text-sm">{yearShows.length} shows</span>
                          </button>

                          {/* Expanded Shows */}
                          {expandedYear === `${venue.name}-${year}` && (
                            <div className="bg-white/5">
                              {yearShows.map((show) => (
                                <div key={show.id}>
                                  {/* Show Header */}
                                  <button
                                    onClick={() => setExpandedShow(expandedShow === show.id ? null : show.id)}
                                    className="w-full flex items-center justify-between px-8 py-2 hover:bg-white/5 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <ChevronDown className={`w-3 h-3 text-white/40 transition-transform ${expandedShow === show.id ? 'rotate-180' : ''}`} />
                                      <span className="text-white/80">{formatDate(show.date)}</span>
                                      <span className="text-white/40">-</span>
                                      <span style={{ color: artistColor(show.artist) }}>{show.artist}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {show.rating && (
                                        <span className="text-emerald-400 text-sm font-medium">{show.rating}/10</span>
                                      )}
                                      <span className="text-white/40 text-sm">{show.setlist.length} songs</span>
                                    </div>
                                  </button>

                                  {/* Expanded Setlist */}
                                  {expandedShow === show.id && (
                                    <div className="bg-white/5 px-10 py-3 border-t border-white/5">
                                      {show.tour && (
                                        <div className="text-emerald-400 text-sm font-medium mb-2">{show.tour}</div>
                                      )}
                                      <div className="space-y-1">
                                        {show.setlist.map((song, idx) => (
                                          <div key={song.id || idx} className="flex items-center gap-2 text-sm">
                                            {song.setBreak && (
                                              <div className="text-emerald-400 font-semibold text-xs mt-2 mb-1 w-full">{song.setBreak}</div>
                                            )}
                                            <span className="text-white/40 w-6">{idx + 1}.</span>
                                            <span className="text-white/80">{song.name}</span>
                                            {song.rating && (
                                              <span className="text-amber-400 text-xs">({song.rating}/10)</span>
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
          <h2 className="text-xl font-bold mb-4 text-white">Shows by Year</h2>
          {uniqueYears.length === 0 ? (
            <p className="text-center text-white/40 py-8 font-medium">No shows tracked yet</p>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="text-left px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Year</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Shows</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Avg Rating</th>
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
                          className="cursor-pointer hover:bg-white/5 transition-colors"
                          onClick={() => setExpandedYear(isExpanded ? null : year)}
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <ChevronDown className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              <span className="font-bold text-xl text-emerald-400">{year}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-sm font-semibold">
                              {yearShows.length}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {avgRating ? (
                              <span className="text-sm font-semibold text-emerald-400">{avgRating}/10</span>
                            ) : (
                              <span className="text-white/30">--</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={3} className="px-4 py-0 bg-white/[0.02]">
                              <div className="py-4 pl-6 border-l-2 border-emerald-500/50 ml-2 mb-2">
                                <div className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wide">Shows in {year}</div>
                                <div className="space-y-3">
                                  {yearShows.map((show) => {
                                    const songAvg = avgSongRating(show.setlist);
                                    return (
                                      <div
                                        key={show.id}
                                        className="flex items-start justify-between bg-white/5 rounded-2xl p-4 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); setSelectedShow(show); }}
                                      >
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold" style={{ color: artistColor(show.artist) }}>
                                              {show.artist}
                                            </span>
                                            {show.tour && (
                                              <span className="text-xs text-emerald-400 font-medium">
                                                {show.tour}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 text-sm mt-1 text-white/50">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {formatDate(show.date)}
                                          </div>
                                          <div className="flex items-center gap-2 text-sm mt-1 text-white/50">
                                            <MapPin className="w-3.5 h-3.5" />
                                            {show.venue}{show.city ? `, ${show.city}` : ''}
                                          </div>
                                          <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                                            <span>{show.setlist.length} songs</span>
                                            {songAvg && <span>Avg song rating: {songAvg}/10</span>}
                                          </div>
                                          {show.comment && (
                                            <div className="flex items-start gap-1.5 mt-2 text-sm text-white/50 italic">
                                              <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                              {show.comment}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex-shrink-0 ml-4">
                                          {show.rating ? (
                                            <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold text-sm">
                                              {show.rating}/10
                                            </span>
                                          ) : (
                                            <span className="text-white/30 text-sm">Not rated</span>
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
          <h2 className="text-xl font-bold mb-4 text-white">Top Rated Shows</h2>
          {topRatedShows.length === 0 ? (
            <p className="text-center text-white/40 py-8 font-medium">No rated shows yet</p>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="text-center px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide w-12">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">Artist</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">Venue</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">Date</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {topRatedShows.map((show, i) => (
                    <tr
                      key={show.id}
                      className="hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setSelectedShow(show)}
                    >
                      <td className="px-4 py-3 text-center text-lg font-bold text-white/30">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: artistColor(show.artist) }}>{show.artist}</div>
                        {show.tour && <div className="text-xs text-emerald-400 font-medium">{show.tour}</div>}
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        {show.venue}{show.city ? `, ${show.city}` : ''}
                      </td>
                      <td className="px-4 py-3 text-white/60">{formatDate(show.date)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold text-sm">
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
          onAddSong={(song) => onAddSong(selectedShow.id, song)}
          onRateSong={(songId, rating) => onRateSong(selectedShow.id, songId, rating)}
          onCommentSong={(songId, comment) => onCommentSong(selectedShow.id, songId, comment)}
          onDeleteSong={(songId) => onDeleteSong(selectedShow.id, songId)}
          onRateShow={(rating) => onRateShow(selectedShow.id, rating)}
          onCommentShow={(comment) => onCommentShow(selectedShow.id, comment)}
          onBatchRate={(rating) => onBatchRate(selectedShow.id, rating)}
          onClose={() => setSelectedShow(null)}
        />
      )}
    </div>
  );
}

export default StatsView;
