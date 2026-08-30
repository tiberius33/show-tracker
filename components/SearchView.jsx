'use client';

import React, { useState } from 'react';
import { Search, X, ChevronDown, ChevronLeft, ChevronRight, Check, Download, Plus, Users } from 'lucide-react';
import Tip from '@/components/ui/Tip';
import { Card, Button, Input, EmptyState } from '@/components/ui';
import { apiUrl } from '@/lib/api';
import { extractSongsFromSetlist } from '@/lib/setlistParser';

function SearchView({ onImport, importedIds, onAddManually }) {
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

  // Artist search mode
  const [searchMode, setSearchMode] = useState('setlist'); // 'setlist' | 'artist'
  const [artistGroups, setArtistGroups] = useState([]);
  const [expandedArtistGroup, setExpandedArtistGroup] = useState(null);

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

  // Artist-based search: find all artists matching name and their latest shows
  const searchByArtist = async () => {
    if (!artistName.trim()) return;
    setIsSearching(true);
    setError('');
    setArtistGroups([]);
    setResults([]);
    try {
      const params = new URLSearchParams({ artistName: artistName.trim() });
      const response = await fetch(apiUrl(`/.netlify/functions/search-artist-shows?${params}`));
      if (!response.ok) throw new Error('Failed to search artist shows');
      const data = await response.json();
      if (!data.groups || data.groups.length === 0) {
        setError('No shows found for this artist. Try a different name.');
        return;
      }
      setArtistGroups(data.groups);
      setExpandedArtistGroup(data.groups.length === 1 ? 0 : null);
    } catch (err) {
      console.error('Artist search error:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setIsSearching(false);
    }
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
    const songs = extractSongsFromSetlist(setlist);

    const showData = {
      artist: setlist.artist.name,
      venue: setlist.venue.name,
      city: setlist.venue.city.name,
      country: setlist.venue.city.country.name,
      date: (() => {
        // setlist.fm returns DD-MM-YYYY; normalize to YYYY-MM-DD for storage
        const parts = (setlist.eventDate || '').split('-');
        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : setlist.eventDate;
      })(),
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
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).toLocaleDateString();
    }
    return dateStr;
  };

  return (
    <div>
      {/* Search Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant="ghost"
          icon={Search}
          onClick={() => { setSearchMode('setlist'); setArtistGroups([]); setError(''); }}
          className={searchMode === 'setlist'
            ? 'bg-brand-subtle text-brand border border-brand/30'
            : 'text-secondary border border-subtle'}
        >
          Search by Show
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={Users}
          onClick={() => { setSearchMode('artist'); setResults([]); setSelectedArtist(null); setShowArtistPicker(false); setError(''); }}
          className={searchMode === 'artist'
            ? 'bg-brand-subtle text-brand border border-brand/30'
            : 'text-secondary border border-subtle'}
        >
          Search by Artist
        </Button>
      </div>

      {/* Search Form */}
      <Card padding="md" className="mb-6">
        {searchMode === 'artist' ? (
          <>
            <Input
              label="Artist / Performer Name"
              type="text"
              placeholder="e.g., Grahame Lesh"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchByArtist()}
              hint="Find all shows featuring this artist across different bands and projects"
              containerClassName="mb-4"
            />
            <Button
              variant="primary"
              full
              icon={Users}
              onClick={searchByArtist}
              disabled={isSearching || !artistName.trim()}
              loading={isSearching}
            >
              {isSearching ? 'Searching...' : 'Find Artist Shows'}
            </Button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Input
                  label="Artist Name *"
                  type="text"
                  placeholder="e.g., Radiohead"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchArtists()}
                  disabled={selectedArtist !== null}
                />
                {selectedArtist && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-brand-subtle border border-brand/30 rounded-lg">
                    <span className="text-brand text-sm flex-1">
                      <span className="text-secondary">Searching:</span> {selectedArtist.name}
                      {selectedArtist.disambiguation && (
                        <span className="text-muted ml-1">({selectedArtist.disambiguation})</span>
                      )}
                    </span>
                    <Tip text="Clear selection">
                      <button
                        onClick={clearArtistSelection}
                        className="text-secondary hover:text-primary p-2 -m-1 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </Tip>
                  </div>
                )}
              </div>
              <Input
                label="Year"
                type="text"
                placeholder="e.g., 2024"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && selectedArtist && searchSetlists(1)}
              />
              <Input
                label="Venue"
                type="text"
                placeholder="e.g., Madison Square Garden"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && selectedArtist && searchSetlists(1)}
              />
              <Input
                label="City"
                type="text"
                placeholder="e.g., New York"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (selectedArtist ? searchSetlists(1) : searchArtists())}
              />
            </div>
            <Button
              variant="primary"
              full
              icon={Search}
              onClick={() => selectedArtist ? searchSetlists(1) : searchArtists()}
              disabled={isSearching || !artistName.trim()}
              loading={isSearching}
            >
              {isSearching ? 'Searching...' : (selectedArtist ? 'Search Setlists' : 'Search Artists')}
            </Button>
          </>
        )}
      </Card>

      {/* Artist Picker */}
      {showArtistPicker && artistOptions.length > 0 && (
        <Card padding="md" className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-primary">Select Artist</h2>
              <p className="text-sm text-secondary">Multiple artists found - please select the correct one</p>
            </div>
            <button
              onClick={() => {
                setShowArtistPicker(false);
                setArtistOptions([]);
              }}
              className="text-secondary hover:text-primary p-2.5 -m-1 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-2">
            {artistOptions.map((artist) => (
              <button
                key={artist.mbid || artist.name}
                onClick={() => selectArtist(artist)}
                className="w-full text-left p-4 bg-surface hover:bg-hover border border-subtle hover:border-brand/30 rounded-xl transition-all group"
              >
                <div className="font-medium text-primary group-hover:text-brand transition-colors">
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
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6">
          <p className="text-danger text-sm">{error}</p>
          {onAddManually && (
            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={onAddManually}
              className="mt-3"
            >
              Add Manually
            </Button>
          )}
        </div>
      )}

      {/* Artist Search Results */}
      {artistGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary">Artists Found</h2>
          {artistGroups.map((group, groupIdx) => {
            const isGroupExpanded = expandedArtistGroup === groupIdx;
            return (
              <Card key={group.artist.mbid || groupIdx} padding="none" className="overflow-hidden">
                <button
                  onClick={() => setExpandedArtistGroup(isGroupExpanded ? null : groupIdx)}
                  className="w-full text-left p-5 flex items-center justify-between hover:bg-hover transition-colors"
                >
                  <div>
                    <div className="font-semibold text-primary text-lg">{group.artist.name}</div>
                    {group.artist.disambiguation && (
                      <div className="text-sm text-muted mt-0.5">{group.artist.disambiguation}</div>
                    )}
                    <div className="text-sm text-secondary mt-1">{group.total} show{group.total !== 1 ? 's' : ''} on setlist.fm</div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-secondary transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isGroupExpanded && (
                  <div className="border-t border-subtle divide-y divide-subtle">
                    {group.setlists.map((setlist) => {
                      const songCount = setlist.sets?.set?.reduce((acc, s) => acc + (s.song?.length || 0), 0) || 0;
                      const isExpanded = expandedSetlist === setlist.id;
                      return (
                        <div key={setlist.id} className="p-4 hover:bg-hover transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-secondary">
                                {setlist.venue?.name} &middot; {setlist.venue?.city?.name}, {setlist.venue?.city?.country?.name}
                              </div>
                              <div className="text-sm text-muted mt-1">
                                {formatSetlistDate(setlist.eventDate)}
                                {setlist.tour && <span className="text-brand ml-2">{setlist.tour.name}</span>}
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
                              {isExpanded && setlist.sets?.set && (
                                <div className="mt-3 pl-2 border-l-2 border-subtle">
                                  {setlist.sets.set.map((set, setIdx) => (
                                    <div key={setIdx}>
                                      {(set.name || set.encore) && (
                                        <div className="text-xs font-semibold text-brand uppercase tracking-wide mt-2 mb-1">
                                          {set.name || (set.encore ? 'Encore' : `Set ${setIdx + 1}`)}
                                        </div>
                                      )}
                                      {set.song?.map((song, songIdx) => (
                                        <div key={songIdx} className="flex items-center gap-2 py-0.5 text-sm text-secondary">
                                          <span className="text-muted w-5 text-right text-xs">{songIdx + 1}.</span>
                                          <span>{song.name}</span>
                                          {song.cover && <span className="text-xs text-muted">({song.cover.name} cover)</span>}
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={isImported(setlist.id) ? 'ghost' : 'secondary'}
                              icon={isImported(setlist.id) ? Check : Download}
                              onClick={() => importSetlist(setlist)}
                              disabled={isImported(setlist.id)}
                              className={`flex-shrink-0 ${isImported(setlist.id) ? 'bg-brand-subtle text-brand cursor-default' : ''}`}
                            >
                              {isImported(setlist.id) ? 'Added' : 'Add Show'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {group.total > group.setlists.length && (
                      <div className="p-4 text-center">
                        <button
                          onClick={() => {
                            setSearchMode('setlist');
                            setSelectedArtist(group.artist);
                            setArtistGroups([]);
                            searchSetlists(1, group.artist);
                          }}
                          className="text-sm text-brand hover:underline"
                        >
                          View all {group.total} shows for {group.artist.name} →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary">Search Results</h2>
            <span className="text-sm text-secondary">Page {page} of {totalPages}</span>
          </div>

          {results.map((setlist) => {
            const songCount = setlist.sets?.set?.reduce((acc, s) => acc + (s.song?.length || 0), 0) || 0;
            const isExpanded = expandedSetlist === setlist.id;

            return (
              <Card
                key={setlist.id}
                padding="none"
                className="overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-primary">{setlist.artist.name}</div>
                      <div className="text-sm text-secondary mt-1">
                        {setlist.venue.name} &middot; {setlist.venue.city.name}, {setlist.venue.city.country.name}
                      </div>
                      <div className="text-sm text-muted mt-1">
                        {formatSetlistDate(setlist.eventDate)}
                        {setlist.tour && <span className="text-brand ml-2">{setlist.tour.name}</span>}
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
                    <Button
                      size="sm"
                      variant={isImported(setlist.id) ? 'ghost' : 'secondary'}
                      icon={isImported(setlist.id) ? Check : Download}
                      onClick={() => importSetlist(setlist)}
                      disabled={isImported(setlist.id)}
                      className={isImported(setlist.id) ? 'bg-brand-subtle text-brand cursor-default' : ''}
                    >
                      {isImported(setlist.id) ? 'Added' : 'Add Show'}
                    </Button>
                  </div>
                </div>

                {/* Expandable Setlist */}
                {isExpanded && setlist.sets?.set && (
                  <div className="border-t border-subtle bg-base p-4">
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {setlist.sets.set.map((set, setIdx) => (
                        <div key={setIdx}>
                          {set.name && (
                            <div className="text-xs font-semibold text-brand uppercase tracking-wide mt-2 mb-1">
                              {set.name || (set.encore ? 'Encore' : `Set ${setIdx + 1}`)}
                            </div>
                          )}
                          {set.encore && !set.name && (
                            <div className="text-xs font-semibold text-brand uppercase tracking-wide mt-2 mb-1">
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
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => searchSetlists(page - 1)}
                disabled={page === 1 || isSearching}
                className="!px-2"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="text-sm text-secondary px-4">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => searchSetlists(page + 1)}
                disabled={page === totalPages || isSearching}
                className="!px-2"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isSearching && results.length === 0 && artistGroups.length === 0 && !error && !showArtistPicker && (
        <EmptyState
          icon={Search}
          title={searchMode === 'artist' ? 'Find an artist' : 'Find a show'}
          body={searchMode === 'artist'
            ? 'Enter a performer name to find their shows across all bands and projects'
            : 'Enter an artist name to search for setlists'}
        />
      )}
    </div>
  );
}

export default SearchView;
