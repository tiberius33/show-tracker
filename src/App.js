import React, { useState, useEffect, useMemo } from 'react';
import { Music, Plus, X, Star, Calendar, MapPin, List, BarChart3, Share2, Check, Search, Download, ArrowUpDown, ChevronLeft, ChevronRight, Users, Building2 } from 'lucide-react';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const ddmmyyyy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`).toLocaleDateString();
  }
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleDateString();
}

function parseDate(dateStr) {
  if (!dateStr) return new Date(0);
  const ddmmyyyy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
  const d = new Date(dateStr);
  return isNaN(d) ? new Date(0) : d;
}

function artistColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

function avgSongRating(setlist) {
  const rated = setlist.filter(s => s.rating);
  if (rated.length === 0) return null;
  return (rated.reduce((a, s) => a + s.rating, 0) / rated.length).toFixed(1);
}

export default function ShowTracker() {
  const [shows, setShows] = useState([]);
  const [activeView, setActiveView] = useState('shows');
  const [showForm, setShowForm] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    loadShows();
  }, []);

  const loadShows = () => {
    try {
      const stored = localStorage.getItem('concert-shows');
      if (stored) {
        setShows(JSON.parse(stored));
      }
    } catch (error) {
      console.log('No existing shows found');
    } finally {
      setIsLoading(false);
    }
  };

  const saveShows = (updatedShows) => {
    try {
      localStorage.setItem('concert-shows', JSON.stringify(updatedShows));
      setShows(updatedShows);
    } catch (error) {
      console.error('Failed to save shows:', error);
    }
  };

  const addShow = (showData) => {
    const newShow = {
      id: Date.now().toString(),
      ...showData,
      setlist: showData.setlist || [],
      createdAt: new Date().toISOString(),
      isManual: !showData.setlistfmId
    };
    saveShows([...shows, newShow]);
    setShowForm(false);
  };

  const deleteShow = (showId) => {
    if (window.confirm('Delete this show?')) {
      saveShows(shows.filter(s => s.id !== showId));
      if (selectedShow?.id === showId) setSelectedShow(null);
    }
  };

  const updateShowRating = (showId, rating) => {
    const updatedShows = shows.map(show =>
      show.id === showId ? { ...show, rating } : show
    );
    saveShows(updatedShows);
    if (selectedShow?.id === showId) {
      setSelectedShow(updatedShows.find(s => s.id === showId));
    }
  };

  const addSongToShow = (showId, songData) => {
    const updatedShows = shows.map(show => {
      if (show.id === showId) {
        return {
          ...show,
          setlist: [...show.setlist, {
            id: Date.now().toString(),
            ...songData,
            rating: null
          }]
        };
      }
      return show;
    });
    saveShows(updatedShows);
    setSelectedShow(updatedShows.find(s => s.id === showId));
  };

  const updateSongRating = (showId, songId, rating) => {
    const updatedShows = shows.map(show => {
      if (show.id === showId) {
        return {
          ...show,
          setlist: show.setlist.map(song =>
            song.id === songId ? { ...song, rating } : song
          )
        };
      }
      return show;
    });
    saveShows(updatedShows);
    setSelectedShow(updatedShows.find(s => s.id === showId));
  };

  const batchRateUnrated = (showId, rating) => {
    const updatedShows = shows.map(show => {
      if (show.id === showId) {
        return {
          ...show,
          setlist: show.setlist.map(song =>
            song.rating ? song : { ...song, rating }
          )
        };
      }
      return show;
    });
    saveShows(updatedShows);
    setSelectedShow(updatedShows.find(s => s.id === showId));
  };

  const deleteSong = (showId, songId) => {
    const updatedShows = shows.map(show => {
      if (show.id === showId) {
        return {
          ...show,
          setlist: show.setlist.filter(s => s.id !== songId)
        };
      }
      return show;
    });
    saveShows(updatedShows);
    setSelectedShow(updatedShows.find(s => s.id === showId));
  };

  const getSongStats = () => {
    const songMap = {};
    shows.forEach(show => {
      show.setlist.forEach(song => {
        if (!songMap[song.name]) {
          songMap[song.name] = { count: 0, ratings: [], shows: [] };
        }
        songMap[song.name].count++;
        if (song.rating) songMap[song.name].ratings.push(song.rating);
        songMap[song.name].shows.push({
          date: show.date,
          artist: show.artist,
          venue: show.venue,
          rating: song.rating
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
  };

  const getArtistStats = () => {
    const artistMap = {};
    shows.forEach(show => {
      if (!artistMap[show.artist]) {
        artistMap[show.artist] = { count: 0, ratings: [], totalSongs: 0 };
      }
      artistMap[show.artist].count++;
      artistMap[show.artist].totalSongs += show.setlist.length;
      if (show.rating) artistMap[show.artist].ratings.push(show.rating);
    });
    return Object.entries(artistMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalSongs: data.totalSongs,
        avgRating: data.ratings.length ?
          (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1) : null
      }))
      .sort((a, b) => b.count - a.count);
  };

  const getVenueStats = () => {
    const venueMap = {};
    shows.forEach(show => {
      const key = show.venue + (show.city ? `, ${show.city}` : '');
      if (!venueMap[key]) {
        venueMap[key] = { count: 0, artists: new Set() };
      }
      venueMap[key].count++;
      venueMap[key].artists.add(show.artist);
    });
    return Object.entries(venueMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        artists: data.artists.size
      }))
      .sort((a, b) => b.count - a.count);
  };

  const getTopRatedShows = () => {
    return shows
      .filter(s => s.rating)
      .sort((a, b) => b.rating - a.rating || parseDate(b.date) - parseDate(a.date))
      .slice(0, 10);
  };

  const shareCollection = async () => {
    const ratedShows = shows.filter(s => s.rating);
    const avgShowRating = ratedShows.length
      ? (ratedShows.reduce((acc, s) => acc + s.rating, 0) / ratedShows.length).toFixed(1)
      : null;
    const shareData = {
      totalShows: shows.length,
      totalSongs: shows.reduce((acc, show) => acc + show.setlist.length, 0),
      topSongs: getSongStats().slice(0, 10),
      recentShows: shows.slice(-5).reverse()
    };

    const shareText = `🎵 My Concert Collection\n\n${shareData.totalShows} shows • ${shareData.totalSongs} songs${avgShowRating ? ` • Avg show rating: ${avgShowRating}/5` : ''}\n\nTop Songs:\n${shareData.topSongs.slice(0, 5).map((s, i) => `${i + 1}. ${s.name} (${s.count}x)`).join('\n')}`;

    try {
      await navigator.clipboard.writeText(shareText);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (error) {
      alert(shareText);
    }
  };

  const importedIds = useMemo(() => new Set(shows.map(s => s.setlistfmId).filter(Boolean)), [shows]);

  const sortedFilteredShows = useMemo(() => {
    const filtered = shows.filter(show =>
      show.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      show.venue.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered.sort((a, b) => {
      if (sortBy === 'date') return parseDate(b.date) - parseDate(a.date);
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return 0;
    });
  }, [shows, searchTerm, sortBy]);

  const summaryStats = useMemo(() => {
    const totalSongs = shows.reduce((acc, s) => acc + s.setlist.length, 0);
    const ratedShows = shows.filter(s => s.rating);
    const avgRating = ratedShows.length
      ? (ratedShows.reduce((a, s) => a + s.rating, 0) / ratedShows.length).toFixed(1)
      : null;
    const uniqueArtists = new Set(shows.map(s => s.artist)).size;
    const uniqueVenues = new Set(shows.map(s => s.venue)).size;
    return { totalSongs, avgRating, uniqueArtists, uniqueVenues };
  }, [shows]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading your shows...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Music className="w-8 h-8 text-purple-400" />
              <h1 className="text-2xl font-bold">Show Tracker</h1>
            </div>
            <button
              onClick={shareCollection}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              {shareSuccess ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {shareSuccess ? 'Copied!' : 'Share'}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('shows')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeView === 'shows' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <List className="w-4 h-4" />
              Shows ({shows.length})
            </button>
            <button
              onClick={() => setActiveView('stats')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeView === 'stats' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Stats
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeView === 'shows' && (
          <>
            {shows.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{shows.length}</div>
                  <div className="text-xs text-gray-400">Shows</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{summaryStats.totalSongs}</div>
                  <div className="text-xs text-gray-400">Songs</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{summaryStats.uniqueArtists}</div>
                  <div className="text-xs text-gray-400">Artists</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{summaryStats.avgRating || '—'}</div>
                  <div className="text-xs text-gray-400">Avg Rating</div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="Search shows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <Search className="w-5 h-5" />
                Search Setlists
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Manual Add
              </button>
            </div>

            {shows.length > 1 && (
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpDown className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-500">Sort:</span>
                {['date', 'artist', 'rating'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      sortBy === opt ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {sortedFilteredShows.length === 0 && !showForm && !showSearch && (
              <div className="text-center py-12 text-gray-500">
                <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No shows yet</p>
                <p className="text-sm">Search setlist.fm or add a show manually!</p>
              </div>
            )}

            {showForm && <ShowForm onSubmit={addShow} onCancel={() => setShowForm(false)} />}
            {showSearch && (
              <SetlistSearch
                onImport={addShow}
                onCancel={() => setShowSearch(false)}
                importedIds={importedIds}
              />
            )}

            <div className="space-y-3">
              {sortedFilteredShows.map(show => (
                <ShowCard
                  key={show.id}
                  show={show}
                  onSelect={() => setSelectedShow(show)}
                  onDelete={() => deleteShow(show.id)}
                  onRate={(rating) => updateShowRating(show.id, rating)}
                  isSelected={selectedShow?.id === show.id}
                />
              ))}
            </div>

            {selectedShow && (
              <SetlistEditor
                show={selectedShow}
                onAddSong={(song) => addSongToShow(selectedShow.id, song)}
                onRateSong={(songId, rating) => updateSongRating(selectedShow.id, songId, rating)}
                onDeleteSong={(songId) => deleteSong(selectedShow.id, songId)}
                onRateShow={(rating) => updateShowRating(selectedShow.id, rating)}
                onBatchRate={(rating) => batchRateUnrated(selectedShow.id, rating)}
                onClose={() => setSelectedShow(null)}
              />
            )}
          </>
        )}

        {activeView === 'stats' && (
          <StatsView
            songStats={getSongStats()}
            artistStats={getArtistStats()}
            venueStats={getVenueStats()}
            topRatedShows={getTopRatedShows()}
          />
        )}
      </div>
    </div>
  );
}

function SetlistSearch({ onImport, onCancel, importedIds }) {
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

  const searchSetlists = async (pageNum = 1) => {
    if (!artistName.trim()) return;

    setIsSearching(true);
    setError('');

    try {
      const params = new URLSearchParams({ artistName: artistName.trim(), p: pageNum.toString() });
      if (year.trim()) params.set('year', year.trim());
      if (venueName.trim()) params.set('venueName', venueName.trim());
      if (cityName.trim()) params.set('cityName', cityName.trim());
      const response = await fetch(`/.netlify/functions/search-setlists?${params.toString()}`);

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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-20">
      <div className="bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">Search Setlist.fm</h2>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-200">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Artist name..."
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchSetlists(1)}
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={() => searchSetlists(1)}
                disabled={isSearching}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Year (optional)"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchSetlists(1)}
                className="w-32 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
              />
              <input
                type="text"
                placeholder="Venue (optional)"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchSetlists(1)}
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
              />
              <input
                type="text"
                placeholder="City (optional)"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchSetlists(1)}
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 text-red-400 text-sm">{error}</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {results.length === 0 && !isSearching && !error && (
            <p className="text-center text-gray-500 py-8">
              Search for an artist to see their recent setlists
            </p>
          )}

          <div className="space-y-3">
            {results.map((setlist) => (
              <div key={setlist.id} className={`bg-gray-900 rounded-lg p-4 border ${isImported(setlist.id) ? 'border-green-600/50' : 'border-gray-700'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-purple-400">
                      {setlist.artist.name}
                    </h3>
                    <div className="text-sm text-gray-400 mt-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {setlist.eventDate}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {setlist.venue.name}, {setlist.venue.city.name}, {setlist.venue.city.country.name}
                      </div>
                      {setlist.tour && (
                        <div className="text-purple-300">
                          Tour: {setlist.tour.name}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4" />
                        {setlist.sets?.set?.reduce((acc, s) => acc + (s.song?.length || 0), 0) || 0} songs
                      </div>
                    </div>
                  </div>
                  {isImported(setlist.id) ? (
                    <span className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-400 rounded-lg text-sm">
                      <Check className="w-4 h-4" />
                      Imported
                    </span>
                  ) : (
                    <button
                      onClick={() => importSetlist(setlist)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Import
                    </button>
                  )}
                </div>

                {setlist.sets?.set && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                      Preview setlist
                    </summary>
                    <div className="mt-2 pl-4 space-y-1 text-gray-400">
                      {setlist.sets.set.map((set, setIdx) => (
                        <div key={setIdx}>
                          {setIdx > 0 || setlist.sets.set.length > 1 ? (
                            <div className="text-purple-400 font-semibold mt-2 mb-1">
                              {set.encore ? `Encore${set.encore > 1 ? ` ${set.encore}` : ''}` : `Set ${setIdx + 1}`}
                            </div>
                          ) : null}
                          {set.song?.map((song, songIdx) => (
                            <div key={songIdx}>
                              {songIdx + 1}. {song.name}
                              {song.cover && <span className="text-purple-400 ml-2">({song.cover.name} cover)</span>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>

          {results.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => searchSetlists(page - 1)}
                disabled={page <= 1 || isSearching}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
              <button
                onClick={() => searchSetlists(page + 1)}
                disabled={page >= totalPages || isSearching}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShowForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    artist: '',
    venue: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.artist && formData.venue && formData.date) {
      onSubmit(formData);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-4">Add Show Manually</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Artist/Band"
          value={formData.artist}
          onChange={(e) => setFormData({...formData, artist: e.target.value})}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
          required
        />
        <input
          type="text"
          placeholder="Venue"
          value={formData.venue}
          onChange={(e) => setFormData({...formData, venue: e.target.value})}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
          required
        />
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
          required
        />
        <div className="flex gap-2">
          <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
            Add Show
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function ShowCard({ show, onSelect, onDelete, onRate, isSelected }) {
  const color = artistColor(show.artist);
  const songAvg = avgSongRating(show.setlist);

  return (
    <div
      className={`bg-gray-800 border rounded-lg p-4 cursor-pointer transition-all ${
        isSelected ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-gray-700 hover:border-gray-600'
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <h3 className="text-lg font-semibold" style={{ color }}>{show.artist}</h3>
            {!show.isManual && (
              <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded">
                setlist.fm
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(show.date)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {show.venue}
              {show.city && `, ${show.city}`}
            </span>
            <span className="flex items-center gap-1">
              <Music className="w-4 h-4" />
              {show.setlist.length} songs
            </span>
          </div>
          {show.tour && (
            <div className="text-sm text-purple-300 mt-1">
              Tour: {show.tour}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  onClick={() => onRate(rating)}
                  className="p-0.5 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-4 h-4 ${
                      show.rating >= rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-600'
                    }`}
                  />
                </button>
              ))}
            </div>
            {show.rating && (
              <span className="text-sm font-bold text-yellow-400">{show.rating}/5</span>
            )}
            {songAvg && (
              <span className="text-xs text-gray-500">Songs avg: {songAvg}</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-gray-500 hover:text-red-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function SetlistEditor({ show, onAddSong, onRateSong, onDeleteSong, onRateShow, onBatchRate, onClose }) {
  const [songName, setSongName] = useState('');
  const [batchRating, setBatchRating] = useState(3);

  const handleAddSong = (e) => {
    e.preventDefault();
    if (songName.trim()) {
      onAddSong({ name: songName.trim() });
      setSongName('');
    }
  };

  const unratedCount = show.setlist.filter(s => !s.rating).length;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-20">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold" style={{ color: artistColor(show.artist) }}>{show.artist}</h2>
                {!show.isManual && (
                  <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-1 rounded">
                    setlist.fm
                  </span>
                )}
              </div>
              <p className="text-gray-400 mt-1">
                {formatDate(show.date)} • {show.venue}
                {show.city && `, ${show.city}`}
              </p>
              {show.tour && (
                <p className="text-purple-300 text-sm mt-1">Tour: {show.tour}</p>
              )}
              <div className="flex items-center gap-1 mt-2">
                <span className="text-sm text-gray-400 mr-1">Show rating:</span>
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    onClick={() => onRateShow(rating)}
                    className="p-0.5 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        show.rating >= rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleAddSong} className="flex gap-2">
            <input
              type="text"
              placeholder="Add song to setlist..."
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
            />
            <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </form>

          {unratedCount > 0 && (
            <div className="flex items-center gap-2 mt-3 p-2 bg-gray-900 rounded-lg">
              <span className="text-xs text-gray-400">Rate {unratedCount} unrated:</span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(r => (
                  <button
                    key={r}
                    onClick={() => setBatchRating(r)}
                    className="p-0.5"
                  >
                    <Star className={`w-4 h-4 ${batchRating >= r ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`} />
                  </button>
                ))}
              </div>
              <button
                onClick={() => onBatchRate(batchRating)}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {show.setlist.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No songs in setlist</p>
          ) : (
            <div className="space-y-3">
              {show.setlist.map((song, index) => (
                <React.Fragment key={song.id}>
                  {song.setBreak && (
                    <div className="text-purple-400 font-semibold text-sm pt-2 pb-1 border-t border-gray-700 mt-2">
                      {song.setBreak}
                    </div>
                  )}
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-gray-500 font-mono text-sm mt-1">{index + 1}.</span>
                        <div className="flex-1">
                          <span className="font-medium">{song.name}</span>
                          {song.cover && (
                            <span className="text-sm text-purple-400 ml-2">({song.cover})</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteSong(song.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 ml-8">
                      {[1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          onClick={() => onRateSong(song.id, rating)}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              song.rating >= rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsView({ songStats, artistStats, venueStats, topRatedShows }) {
  const [tab, setTab] = useState('songs');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        {[
          { id: 'songs', label: 'Songs', icon: Music },
          { id: 'artists', label: 'Artists', icon: Users },
          { id: 'venues', label: 'Venues', icon: Building2 },
          { id: 'top', label: 'Top Shows', icon: Star },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
              tab === id ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'songs' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Song Statistics</h2>
          {songStats.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No songs tracked yet</p>
          ) : (
            <div className="space-y-3">
              {songStats.map(song => (
                <div key={song.name} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{song.name}</h3>
                    <div className="flex items-center gap-3">
                      {song.avgRating && (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Star className="w-4 h-4 fill-current" />
                          {song.avgRating}
                        </span>
                      )}
                      <span className="bg-purple-600 px-3 py-1 rounded-full text-sm font-semibold">
                        {song.count}x
                      </span>
                    </div>
                  </div>
                  <details className="text-sm text-gray-400">
                    <summary className="cursor-pointer hover:text-gray-300">
                      View performances
                    </summary>
                    <div className="mt-2 space-y-1 pl-4">
                      {song.shows.map((performance, i) => (
                        <div key={i} className="flex justify-between items-center py-1">
                          <span>{formatDate(performance.date)} - {performance.artist} @ {performance.venue}</span>
                          {performance.rating && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              {performance.rating}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'artists' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Artist Statistics</h2>
          {artistStats.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No shows tracked yet</p>
          ) : (
            <div className="space-y-3">
              {artistStats.map(artist => (
                <div key={artist.name} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: artistColor(artist.name) }} />
                      <h3 className="font-semibold text-lg" style={{ color: artistColor(artist.name) }}>{artist.name}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      {artist.avgRating && (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Star className="w-4 h-4 fill-current" />
                          {artist.avgRating}
                        </span>
                      )}
                      <span className="bg-purple-600 px-3 py-1 rounded-full text-sm font-semibold">
                        {artist.count} show{artist.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {artist.totalSongs} songs total
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'venues' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Venue Statistics</h2>
          {venueStats.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No shows tracked yet</p>
          ) : (
            <div className="space-y-3">
              {venueStats.map(venue => (
                <div key={venue.name} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{venue.name}</h3>
                      <div className="text-sm text-gray-400 mt-1">
                        {venue.artists} artist{venue.artists !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <span className="bg-purple-600 px-3 py-1 rounded-full text-sm font-semibold">
                      {venue.count} show{venue.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'top' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Top Rated Shows</h2>
          {topRatedShows.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No rated shows yet</p>
          ) : (
            <div className="space-y-3">
              {topRatedShows.map((show, i) => (
                <div key={show.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl font-bold text-gray-600">#{i + 1}</span>
                      <div>
                        <h3 className="font-semibold" style={{ color: artistColor(show.artist) }}>{show.artist}</h3>
                        <div className="text-sm text-gray-400 mt-1">
                          {formatDate(show.date)} • {show.venue}{show.city ? `, ${show.city}` : ''}
                        </div>
                        {show.tour && (
                          <div className="text-sm text-purple-300">{show.tour}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="text-lg font-bold text-yellow-400">{show.rating}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
