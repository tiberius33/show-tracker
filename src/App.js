import React, { useState, useEffect, useMemo } from 'react';
import { Music, Plus, X, Star, Calendar, MapPin, List, BarChart3, Share2, Check, Search, Download, ArrowUpDown, ChevronLeft, ChevronRight, Users, Building2, ChevronDown, MessageSquare } from 'lucide-react';

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
  return `hsl(${hue}, 70%, 45%)`;
}

function avgSongRating(setlist) {
  const rated = setlist.filter(s => s.rating);
  if (rated.length === 0) return null;
  return (rated.reduce((a, s) => a + s.rating, 0) / rated.length).toFixed(1);
}

function RatingSelect({ value, onChange, max = 10, label }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs font-medium text-gray-500">{label}</span>}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        onClick={(e) => e.stopPropagation()}
        className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
      >
        <option value="">--</option>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      {value && (
        <span className="text-sm font-semibold text-emerald-600">{value}/10</span>
      )}
    </div>
  );
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
  const [selectedArtist, setSelectedArtist] = useState(null);

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

  const updateSongComment = (showId, songId, comment) => {
    const updatedShows = shows.map(show => {
      if (show.id === showId) {
        return {
          ...show,
          setlist: show.setlist.map(song =>
            song.id === songId ? { ...song, comment } : song
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

    const shareText = `My Concert Collection\n\n${shareData.totalShows} shows | ${shareData.totalSongs} songs${avgShowRating ? ` | Avg show rating: ${avgShowRating}/10` : ''}\n\nTop Songs:\n${shareData.topSongs.slice(0, 5).map((s, i) => `${i + 1}. ${s.name} (${s.count}x)`).join('\n')}`;

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

  const artistGroups = useMemo(() => {
    const groups = {};
    sortedFilteredShows.forEach(show => {
      if (!groups[show.artist]) {
        groups[show.artist] = [];
      }
      groups[show.artist].push(show);
    });
    return Object.entries(groups).sort((a, b) => {
      if (sortBy === 'artist') return a[0].localeCompare(b[0]);
      return b[1].length - a[1].length;
    });
  }, [sortedFilteredShows, sortBy]);

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 font-medium">Loading your shows...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                <Music className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Show Tracker</h1>
            </div>
            <button
              onClick={shareCollection}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
            >
              {shareSuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              {shareSuccess ? 'Copied!' : 'Share'}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setActiveView('shows'); setSelectedArtist(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
                activeView === 'shows' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              <List className="w-4 h-4" />
              Shows ({shows.length})
            </button>
            <button
              onClick={() => setActiveView('stats')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
                activeView === 'stats' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
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
            {/* Summary stats */}
            {shows.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Shows', value: shows.length },
                  { label: 'Songs', value: summaryStats.totalSongs },
                  { label: 'Artists', value: summaryStats.uniqueArtists },
                  { label: 'Avg Rating', value: summaryStats.avgRating || '--' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white border border-gray-200 border-t-4 border-t-emerald-500 rounded-xl p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Search & actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search shows..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                  />
                </div>
                <button
                  onClick={() => setShowSearch(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors whitespace-nowrap shadow-sm"
                >
                  <Search className="w-4 h-4" />
                  Search Setlists
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Manual Add
                </button>
              </div>

              {shows.length > 1 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <ArrowUpDown className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">Sort:</span>
                  {['date', 'artist', 'rating'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setSortBy(opt)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        sortBy === opt ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {sortedFilteredShows.length === 0 && !showForm && !showSearch && (
              <div className="text-center py-16 text-gray-400">
                <Music className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-1">No shows yet</p>
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

            {/* Artist groups */}
            <div className="space-y-4">
              {artistGroups.map(([artist, artistShows]) => (
                <div key={artist} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setSelectedArtist(selectedArtist === artist ? null : artist)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: artistColor(artist) }} />
                      <h3 className="text-lg font-semibold" style={{ color: artistColor(artist) }}>{artist}</h3>
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                        {artistShows.length} show{artistShows.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${selectedArtist === artist ? 'rotate-180' : ''}`} />
                  </button>
                  {selectedArtist === artist && (
                    <div className="border-t border-gray-100 p-3 space-y-3 bg-gray-50/50">
                      {artistShows.map(show => (
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
                  )}
                </div>
              ))}
            </div>

            {selectedShow && (
              <SetlistEditor
                show={selectedShow}
                onAddSong={(song) => addSongToShow(selectedShow.id, song)}
                onRateSong={(songId, rating) => updateSongRating(selectedShow.id, songId, rating)}
                onCommentSong={(songId, comment) => updateSongComment(selectedShow.id, songId, comment)}
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-20">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Search Setlist.fm</h2>
            <button onClick={onCancel} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
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
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
              />
              <button
                onClick={() => searchSetlists(1)}
                disabled={isSearching}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 shadow-sm"
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
                className="w-32 px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900"
              />
              <input
                type="text"
                placeholder="Venue (optional)"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchSetlists(1)}
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900"
              />
              <input
                type="text"
                placeholder="City (optional)"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchSetlists(1)}
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 text-red-500 text-sm font-medium">{error}</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {results.length === 0 && !isSearching && !error && (
            <p className="text-center text-gray-400 py-8 font-medium">
              Search for an artist to see their recent setlists
            </p>
          )}

          <div className="space-y-3">
            {results.map((setlist) => (
              <div key={setlist.id} className={`bg-white rounded-xl p-4 border shadow-sm transition-colors ${isImported(setlist.id) ? 'border-emerald-400' : 'border-gray-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg" style={{ color: artistColor(setlist.artist.name) }}>
                      {setlist.artist.name}
                    </h3>
                    <div className="text-sm text-gray-500 mt-1.5 space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {setlist.eventDate}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {setlist.venue.name}, {setlist.venue.city.name}, {setlist.venue.city.country.name}
                      </div>
                      {setlist.tour && (
                        <div className="text-emerald-600 font-medium">
                          Tour: {setlist.tour.name}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-gray-400" />
                        {setlist.sets?.set?.reduce((acc, s) => acc + (s.song?.length || 0), 0) || 0} songs
                      </div>
                    </div>
                  </div>
                  {isImported(setlist.id) ? (
                    <span className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium">
                      <Check className="w-4 h-4" />
                      Imported
                    </span>
                  ) : (
                    <button
                      onClick={() => importSetlist(setlist)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      Import
                    </button>
                  )}
                </div>

                {setlist.sets?.set && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">
                      Preview setlist
                    </summary>
                    <div className="mt-2 pl-4 space-y-1 text-gray-500">
                      {setlist.sets.set.map((set, setIdx) => (
                        <div key={setIdx}>
                          {setIdx > 0 || setlist.sets.set.length > 1 ? (
                            <div className="text-emerald-700 font-semibold mt-2 mb-1">
                              {set.encore ? `Encore${set.encore > 1 ? ` ${set.encore}` : ''}` : `Set ${setIdx + 1}`}
                            </div>
                          ) : null}
                          {set.song?.map((song, songIdx) => (
                            <div key={songIdx}>
                              {songIdx + 1}. {song.name}
                              {song.cover && <span className="text-emerald-600 ml-2">({song.cover.name} cover)</span>}
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
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="text-sm font-medium text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => searchSetlists(page + 1)}
                disabled={page >= totalPages || isSearching}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
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
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Add Show Manually</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Artist/Band"
          value={formData.artist}
          onChange={(e) => setFormData({...formData, artist: e.target.value})}
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
          required
        />
        <input
          type="text"
          placeholder="Venue"
          value={formData.venue}
          onChange={(e) => setFormData({...formData, venue: e.target.value})}
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
          required
        />
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
          required
        />
        <div className="flex gap-2 pt-1">
          <button type="submit" className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-sm">
            Add Show
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function ShowCard({ show, onSelect, onDelete, onRate, isSelected }) {
  const songAvg = avgSongRating(show.setlist);

  return (
    <div
      className={`group bg-white border rounded-xl p-4 cursor-pointer transition-all ${
        isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {!show.isManual && (
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                setlist.fm
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              {formatDate(show.date)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-gray-400" />
              {show.venue}
              {show.city && `, ${show.city}`}
            </span>
            <span className="flex items-center gap-1">
              <Music className="w-4 h-4 text-gray-400" />
              {show.setlist.length} songs
            </span>
          </div>
          {show.tour && (
            <div className="text-sm text-emerald-600 font-medium mt-1">
              Tour: {show.tour}
            </div>
          )}
          <div className="flex items-center gap-4 mt-2.5" onClick={(e) => e.stopPropagation()}>
            <RatingSelect value={show.rating} onChange={onRate} label="Show:" />
            {songAvg && (
              <span className="text-xs font-medium text-gray-400">Songs avg: {songAvg}/10</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-gray-300 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function SetlistEditor({ show, onAddSong, onRateSong, onCommentSong, onDeleteSong, onRateShow, onBatchRate, onClose }) {
  const [songName, setSongName] = useState('');
  const [batchRating, setBatchRating] = useState(5);
  const [editingComment, setEditingComment] = useState(null);
  const [commentText, setCommentText] = useState('');

  const handleAddSong = (e) => {
    e.preventDefault();
    if (songName.trim()) {
      onAddSong({ name: songName.trim() });
      setSongName('');
    }
  };

  const startEditComment = (song) => {
    setEditingComment(song.id);
    setCommentText(song.comment || '');
  };

  const saveComment = (songId) => {
    onCommentSong(songId, commentText.trim());
    setEditingComment(null);
    setCommentText('');
  };

  const unratedCount = show.setlist.filter(s => !s.rating).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-20">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold" style={{ color: artistColor(show.artist) }}>{show.artist}</h2>
                {!show.isManual && (
                  <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
                    setlist.fm
                  </span>
                )}
              </div>
              <p className="text-gray-500 mt-1">
                {formatDate(show.date)} &middot; {show.venue}
                {show.city && `, ${show.city}`}
              </p>
              {show.tour && (
                <p className="text-emerald-600 text-sm font-medium mt-1">Tour: {show.tour}</p>
              )}
              <div className="mt-3">
                <RatingSelect value={show.rating} onChange={onRateShow} label="Show rating:" />
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleAddSong} className="flex gap-2">
            <input
              type="text"
              placeholder="Add song to setlist..."
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
            />
            <button type="submit" className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm">
              <Plus className="w-5 h-5" />
            </button>
          </form>

          {unratedCount > 0 && (
            <div className="flex items-center gap-2 mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-xs font-medium text-gray-500">Rate {unratedCount} unrated:</span>
              <RatingSelect value={batchRating} onChange={(v) => setBatchRating(v || 5)} />
              <button
                onClick={() => onBatchRate(batchRating)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {show.setlist.length === 0 ? (
            <p className="text-center text-gray-400 py-8 font-medium">No songs in setlist</p>
          ) : (
            <div className="space-y-3">
              {show.setlist.map((song, index) => (
                <React.Fragment key={song.id}>
                  {song.setBreak && (
                    <div className="text-emerald-700 font-semibold text-sm pt-2 pb-1 border-t border-gray-200 mt-2">
                      {song.setBreak}
                    </div>
                  )}
                  <div className="group bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-gray-400 font-mono text-sm mt-1">{index + 1}.</span>
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">{song.name}</span>
                          {song.cover && (
                            <span className="text-sm text-emerald-600 ml-2">({song.cover})</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteSong(song.id)}
                        className="text-gray-300 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 ml-8">
                      <RatingSelect value={song.rating} onChange={(v) => onRateSong(song.id, v)} label="Rating:" />
                      <button
                        onClick={() => startEditComment(song)}
                        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                          song.comment
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        {song.comment ? 'Edit note' : 'Add note'}
                      </button>
                    </div>
                    {song.comment && editingComment !== song.id && (
                      <div className="ml-8 mt-2 text-sm text-gray-500 italic bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        {song.comment}
                      </div>
                    )}
                    {editingComment === song.id && (
                      <div className="ml-8 mt-2 flex gap-2">
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveComment(song.id)}
                          placeholder="Add a note about this song..."
                          className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                          autoFocus
                        />
                        <button
                          onClick={() => saveComment(song.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingComment(null)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
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

function SongStatsRow({ song, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            <span className="font-medium text-gray-900">{song.name}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-sm font-semibold">
            {song.count}x
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          {song.avgRating ? (
            <span className="text-sm font-semibold text-emerald-600">
              {song.avgRating}/10
            </span>
          ) : (
            <span className="text-gray-300">--</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={3} className="px-4 py-0">
            <div className="py-3 pl-6 border-l-2 border-emerald-300 ml-2 mb-2">
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Performances</div>
              <div className="space-y-2">
                {song.shows.map((performance, i) => (
                  <div key={i} className="flex items-start justify-between bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-700">{formatDate(performance.date)}</span>
                        <span className="text-gray-300">&middot;</span>
                        <span className="font-medium" style={{ color: artistColor(performance.artist) }}>
                          {performance.artist}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-0.5 text-gray-500">
                        <MapPin className="w-3.5 h-3.5" />
                        {performance.venue}{performance.city ? `, ${performance.city}` : ''}
                      </div>
                      {performance.comment && (
                        <div className="flex items-start gap-1.5 mt-1 text-sm text-gray-500 italic">
                          <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          {performance.comment}
                        </div>
                      )}
                    </div>
                    {performance.rating && (
                      <span className="text-sm font-semibold text-emerald-600">
                        {performance.rating}/10
                      </span>
                    )}
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors text-sm ${
              tab === id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'songs' && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900">Song Statistics</h2>
          {songStats.length === 0 ? (
            <p className="text-center text-gray-400 py-8 font-medium">No songs tracked yet</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Song</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Times Played</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {songStats.map((song, i) => (
                    <SongStatsRow key={song.name} song={song} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'artists' && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900">Artist Statistics</h2>
          {artistStats.length === 0 ? (
            <p className="text-center text-gray-400 py-8 font-medium">No shows tracked yet</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Artist</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Shows</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Songs</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {artistStats.map((artist) => (
                    <tr key={artist.name} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: artistColor(artist.name) }} />
                          <span className="font-medium" style={{ color: artistColor(artist.name) }}>{artist.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-sm font-semibold">
                          {artist.count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{artist.totalSongs}</td>
                      <td className="px-4 py-3 text-center">
                        {artist.avgRating ? (
                          <span className="text-sm font-semibold text-emerald-600">
                            {artist.avgRating}/10
                          </span>
                        ) : (
                          <span className="text-gray-300">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'venues' && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900">Venue Statistics</h2>
          {venueStats.length === 0 ? (
            <p className="text-center text-gray-400 py-8 font-medium">No shows tracked yet</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Venue</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Shows</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Artists</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {venueStats.map((venue) => (
                    <tr key={venue.name} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{venue.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-sm font-semibold">
                          {venue.count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {venue.artists}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'top' && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900">Top Rated Shows</h2>
          {topRatedShows.length === 0 ? (
            <p className="text-center text-gray-400 py-8 font-medium">No rated shows yet</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Artist</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Venue</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topRatedShows.map((show, i) => (
                    <tr key={show.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-center text-lg font-bold text-gray-300">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: artistColor(show.artist) }}>{show.artist}</div>
                        {show.tour && <div className="text-xs text-emerald-600 font-medium">{show.tour}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {show.venue}{show.city ? `, ${show.city}` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(show.date)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold text-sm">
                          {show.rating}/10
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
    </div>
  );
}
