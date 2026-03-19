'use client';

import React, { useState } from 'react';
import { Search, X, ChevronDown, ChevronLeft, ChevronRight, Check, Download } from 'lucide-react';
import Tip from '@/components/ui/Tip';
import { apiUrl } from '@/lib/api';

function SearchView({ onImport, importedIds }) {
  const [artistName, setArtistName] = useState('');
  const [year, setYear] = useState('');
  const [venueName, setVenueName] = useState('');
  const [cityName, setCityName] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [imported, setImported] = useState(new Set());
  const [expandedSetlist, setExpandedSetlist] = useState(null);

  // Artist disambiguation state
  const [artistOptions, setArtistOptions] = useState([]);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [showArtistPicker, setShowArtistPicker] = useState(false);

  // Search for artists first
  const searchArtists = async () => {
    if (!artistName.trim()) return;

    setIsSearching(true);
    setError('');
    setArtistOptions([]);
    setSelectedArtist(null);
    setResults([]);

    try {
      const params = new URLSearchParams({ artistName: artistName.trim() });
      const response = await fetch(apiUrl(`/.netlify/functions/search-artists?${params.toString()}`));

      if (!response.ok) {
        throw new Error('Failed to search artists');
      }

      const data = await response.json();

      if (!data.artist || data.artist.length === 0) {
        setError('No artists found. Try a different search term.');
        return;
      }

      // If only one artist or exact match, go straight to setlist search
      const exactMatch = data.artist.find(a => a.name.toLowerCase() === artistName.trim().toLowerCase());
      if (data.artist.length === 1 || exactMatch) {
        const artist = exactMatch || data.artist[0];
        setSelectedArtist(artist);
        setShowArtistPicker(false);
        searchSetlists(1, artist);
      } else {
        // Multiple artists - show picker
        setArtistOptions(data.artist.slice(0, 10)); // Show top 10 matches
        setShowArtistPicker(true);
      }
    } catch (err) {
      console.error('Artist search error:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectArtist = (artist) => {
    setSelectedArtist(artist);
    setShowArtistPicker(false);
    setArtistOptions([]);
    searchSetlists(1, artist);
  };

  const clearArtistSelection = () => {
    setSelectedArtist(null);
    setResults([]);
    setPage(1);
    setTotalPages(1);
  };

  const searchSetlists = async (pageNum = 1, artistOverride = null) => {
    const artist = artistOverride || selectedArtist;
    const searchArtist = artist?.name || artistName.trim();
    if (!searchArtist) return;

    setIsSearching(true);
    setError('');

    try {
      const params = new URLSearchParams({ p: pageNum.toString() });
      // Use artistMbid for exact match if we have a selected artist with mbid
      if (artist?.mbid) {
        params.set('artistMbid', artist.mbid);
      } else {
        params.set('artistName', searchArtist);
      }
      if (year.trim()) params.set('year', year.trim());
      if (venueName.trim()) params.set('venueName', venueName.trim());
      if (cityName.trim()) params.set('cityName', cityName.trim());
      const response = await fetch(apiUrl(`/.netlify/functions/search-setlists?${params.toString()}`));

      if (response.status === 404) {
        setError('No setlists found. Try adjusting your search.');
        setResults([]);
        setTotalPages(1);
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Failed to fetch setlists (${response.status}). ${errorText}`);
      }

      const data = await response.json();

      if (!data.setlist || data.setlist.length === 0) {
        setError('No setlists found. Try adjusting your search.');
        setResults([]);
        setTotalPages(1);
      } else {
        setResults(data.setlist);
        setPage(pageNum);
        const total = data.total || 0;
        const perPage = data.itemsPerPage || 20;
        setTotalPages(Math.max(1, Math.ceil(total / perPage)));
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'An error occurred while searching. Please try again.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const importSetlist = (setlist) => {
    const songs = [];
    let setIndex = 0;

    if (setlist.sets && setlist.sets.set) {
      setlist.sets.set.forEach(set => {
        if (set.song) {
          set.song.forEach(song => {
            songs.push({
              id: Date.now().toString() + Math.random(),
              name: song.name,
              cover: song.cover ? `${song.cover.name} cover` : null,
              setBreak: setIndex > 0 && set.song.indexOf(song) === 0
                ? (set.encore ? `Encore${setIndex > 1 ? ` ${setIndex}` : ''}` : `Set ${setIndex + 1}`)
                : (setIndex === 0 && set.song.indexOf(song) === 0 ? 'Main Set' : null)
            });
          });
        }
        setIndex++;
      });
    }

    const showData = {
      artist: setlist.artist.name,
      venue: setlist.venue.name,
      city: setlist.venue.city.name,
      country: setlist.venue.city.country.name,
      date: setlist.eventDate,
      setlist: songs,
      setlistfmId: setlist.id,
      tour: setlist.tour ? setlist.tour.name : null
    };

    onImport(showData);
    setImported(prev => new Set([...prev, setlist.id]));
  };

  const isImported = (id) => importedIds.has(id) || imported.has(id);

  const formatSetlistDate = (dateStr) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toLocaleDateString();
    }
    return dateStr;
  };

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-bold text-primary mb-2 font-display">Search Shows</h1>
      <p className="text-secondary mb-8">Find and import setlists from Setlist.fm</p>

      {/* Search Form */}
      <div className="bg-highlight backdrop-blur-xl rounded-2xl border border-subtle p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Artist Name *</label>
            <input
              type="text"
              placeholder="e.g., Radiohead"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchArtists()}
              disabled={selectedArtist !== null}
              className="w-full px-4 py-3 bg-highlight border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-amber/50 text-primary placeholder-muted disabled:opacity-50"
            />
            {selectedArtist && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-accent-amber-glow border border-accent-amber/30 rounded-lg">
                <span className="text-accent-amber text-sm flex-1">
                  <span className="text-secondary">Searching:</span> {selectedArtist.name}
                  {selectedArtist.disambiguation && (
                    <span className="text-muted ml-1">({selectedArtist.disambiguation})</span>
                  )}
                </span>
                <Tip text="Clear selection">
                  <button
                    onClick={clearArtistSelection}
                    className="text-secondary hover:text-primary p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Tip>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Year</label>
            <input
              type="text"
              placeholder="e.g., 2024"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && selectedArtist && searchSetlists(1)}
              className="w-full px-4 py-3 bg-highlight border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-amber/50 text-primary placeholder-muted"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Venue</label>
            <input
              type="text"
              placeholder="e.g., Madison Square Garden"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && selectedArtist && searchSetlists(1)}
              className="w-full px-4 py-3 bg-highlight border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-amber/50 text-primary placeholder-muted"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">City</label>
            <input
              type="text"
              placeholder="e.g., New York"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (selectedArtist ? searchSetlists(1) : searchArtists())}
              className="w-full px-4 py-3 bg-highlight border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-amber/50 text-primary placeholder-muted"
            />
          </div>
        </div>
        <button
          onClick={() => selectedArtist ? searchSetlists(1) : searchArtists()}
          disabled={isSearching || !artistName.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-amber to-accent-teal hover:from-accent-amber hover:to-accent-teal text-primary rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-accent-amber/20"
        >
          <Search className="w-4 h-4" />
          {isSearching ? 'Searching...' : (selectedArtist ? 'Search Setlists' : 'Search Artists')}
        </button>
      </div>

      {/* Artist Picker */}
      {showArtistPicker && artistOptions.length > 0 && (
        <div className="bg-highlight backdrop-blur-xl rounded-2xl border border-subtle p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-primary font-display">Select Artist</h2>
              <p className="text-sm text-secondary">Multiple artists found - please select the correct one</p>
            </div>
            <button
              onClick={() => {
                setShowArtistPicker(false);
                setArtistOptions([]);
              }}
              className="text-secondary hover:text-primary p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-2">
            {artistOptions.map((artist) => (
              <button
                key={artist.mbid || artist.name}
                onClick={() => selectArtist(artist)}
                className="w-full text-left p-4 bg-highlight hover:bg-highlight border border-subtle hover:border-accent-amber/30 rounded-xl transition-all group"
              >
                <div className="font-medium text-primary group-hover:text-accent-amber transition-colors">
                  {artist.name}
                </div>
                {artist.disambiguation && (
                  <div className="text-sm text-secondary mt-1">{artist.disambiguation}</div>
                )}
                {artist.sortName && artist.sortName !== artist.name && (
                  <div className="text-xs text-muted mt-1">Sort: {artist.sortName}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary font-display">Search Results</h2>
            <span className="text-sm text-secondary">Page {page} of {totalPages}</span>
          </div>

          {results.map((setlist) => {
            const songCount = setlist.sets?.set?.reduce((acc, s) => acc + (s.song?.length || 0), 0) || 0;
            const isExpanded = expandedSetlist === setlist.id;

            return (
              <div
                key={setlist.id}
                className="bg-highlight border border-subtle rounded-xl overflow-hidden transition-all"
              >
                <div className="p-4 hover:bg-highlight">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-primary font-display">{setlist.artist.name}</div>
                      <div className="text-sm text-secondary mt-1">
                        {setlist.venue.name} &middot; {setlist.venue.city.name}, {setlist.venue.city.country.name}
                      </div>
                      <div className="text-sm text-muted mt-1">
                        {formatSetlistDate(setlist.eventDate)}
                        {setlist.tour && <span className="text-accent-amber ml-2">{setlist.tour.name}</span>}
                      </div>
                      {songCount > 0 && (
                        <button
                          onClick={() => setExpandedSetlist(isExpanded ? null : setlist.id)}
                          className="flex items-center gap-1 text-xs text-secondary hover:text-primary mt-2 transition-colors"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          {songCount} songs
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => importSetlist(setlist)}
                      disabled={isImported(setlist.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isImported(setlist.id)
                          ? 'bg-accent-amber-glow text-accent-amber cursor-default'
                          : 'bg-highlight hover:bg-highlight text-primary'
                      }`}
                    >
                      {isImported(setlist.id) ? (
                        <>
                          <Check className="w-4 h-4" />
                          Added
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Add Show
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Expandable Setlist */}
                {isExpanded && setlist.sets?.set && (
                  <div className="border-t border-subtle bg-highlight p-4">
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {setlist.sets.set.map((set, setIdx) => (
                        <div key={setIdx}>
                          {set.name && (
                            <div className="text-xs font-semibold text-accent-amber uppercase tracking-wide mt-2 mb-1">
                              {set.name || (set.encore ? 'Encore' : `Set ${setIdx + 1}`)}
                            </div>
                          )}
                          {set.encore && !set.name && (
                            <div className="text-xs font-semibold text-accent-amber uppercase tracking-wide mt-2 mb-1">
                              Encore
                            </div>
                          )}
                          {set.song?.map((song, songIdx) => (
                            <div
                              key={songIdx}
                              className="flex items-center gap-2 py-1 text-sm text-secondary"
                            >
                              <span className="text-muted w-6 text-right text-xs">{songIdx + 1}.</span>
                              <span>{song.name}</span>
                              {song.cover && (
                                <span className="text-xs text-muted">
                                  ({song.cover.name} cover)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => searchSetlists(page - 1)}
                disabled={page === 1 || isSearching}
                className="p-2 rounded-lg bg-highlight hover:bg-highlight disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-primary" />
              </button>
              <span className="text-sm text-secondary px-4">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => searchSetlists(page + 1)}
                disabled={page === totalPages || isSearching}
                className="p-2 rounded-lg bg-highlight hover:bg-highlight disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-primary" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isSearching && results.length === 0 && !error && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted">Enter an artist name to search for setlists</p>
        </div>
      )}
    </div>
  );
}

export default SearchView;
