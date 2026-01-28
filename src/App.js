import React, { useState, useEffect } from 'react';
import { Music, Plus, X, Star, Calendar, MapPin, List, BarChart3, Share2, Check, Search, Download} from 'lucide-react';

const SETLISTFM_API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your setlist.fm API key

export default function ShowTracker() {
  const [shows, setShows] = useState([]);
  const [activeView, setActiveView] = useState('shows');
  const [showForm, setShowForm] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);

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
    setShowSearch(false);
  };

  const deleteShow = (showId) => {
    if (window.confirm('Delete this show?')) {
      saveShows(shows.filter(s => s.id !== showId));
      if (selectedShow?.id === showId) setSelectedShow(null);
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

  const shareCollection = async () => {
    const shareData = {
      totalShows: shows.length,
      totalSongs: shows.reduce((acc, show) => acc + show.setlist.length, 0),
      topSongs: getSongStats().slice(0, 10),
      recentShows: shows.slice(-5).reverse()
    };
    
    const shareText = `🎵 My Concert Collection\n\n${shareData.totalShows} shows • ${shareData.totalSongs} songs\n\nTop Songs:\n${shareData.topSongs.slice(0, 5).map((s, i) => `${i + 1}. ${s.name} (${s.count}x)`).join('\n')}`;
    
    try {
      await navigator.clipboard.writeText(shareText);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (error) {
      alert(shareText);
    }
  };

  const filteredShows = shows.filter(show => 
    show.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
    show.venue.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading your shows...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
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
            <div className="flex gap-3 mb-6">
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

            {filteredShows.length === 0 && !showForm && !showSearch && (
              <div className="text-center py-12 text-gray-500">
                <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No shows yet</p>
                <p className="text-sm">Search setlist.fm or add a show manually!</p>
              </div>
            )}

            {showForm && <ShowForm onSubmit={addShow} onCancel={() => setShowForm(false)} />}
            {showSearch && <SetlistSearch onImport={addShow} onCancel={() => setShowSearch(false)} />}

            <div className="space-y-3">
              {filteredShows.map(show => (
                <ShowCard
                  key={show.id}
                  show={show}
                  onSelect={() => setSelectedShow(show)}
                  onDelete={() => deleteShow(show.id)}
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
                onClose={() => setSelectedShow(null)}
              />
            )}
          </>
        )}

        {activeView === 'stats' && <StatsView stats={getSongStats()} />}
      </div>
    </div>
  );
}

function SetlistSearch({ onImport, onCancel }) {
  const [artistName, setArtistName] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  const searchSetlists = async () => {
    if (!artistName.trim()) return;
    
    setIsSearching(true);
    setError('');
    
    try {
      const response = await fetch(
        `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artistName)}&p=1`,
        {
          headers: {
            'x-api-key': SETLISTFM_API_KEY,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch setlists. Check your API key.');
      }

      const data = await response.json();
      setResults(data.setlist || []);
      
      if (!data.setlist || data.setlist.length === 0) {
        setError('No setlists found. Try a different artist name.');
      }
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const importSetlist = (setlist) => {
    const songs = [];
    
    if (setlist.sets && setlist.sets.set) {
      setlist.sets.set.forEach(set => {
        if (set.song) {
          set.song.forEach(song => {
            songs.push({
              id: Date.now().toString() + Math.random(),
              name: song.name,
              cover: song.cover ? `${song.cover.name} cover` : null
            });
          });
        }
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
  };

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
          
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter artist name..."
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchSetlists()}
              className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={searchSetlists}
              disabled={isSearching}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
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
              <div key={setlist.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
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
                  <button
                    onClick={() => importSetlist(setlist)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Import
                  </button>
                </div>
                
                {setlist.sets?.set && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                      Preview setlist
                    </summary>
                    <div className="mt-2 pl-4 space-y-1 text-gray-400">
                      {setlist.sets.set.map((set, setIdx) => (
                        <div key={setIdx}>
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

function ShowCard({ show, onSelect, onDelete, isSelected }) {
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
            <h3 className="text-lg font-semibold text-purple-400">{show.artist}</h3>
            {!show.isManual && (
              <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded">
                from setlist.fm
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(show.date).toLocaleDateString()}
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

function SetlistEditor({ show, onAddSong, onRateSong, onDeleteSong, onClose }) {
  const [songName, setSongName] = useState('');

  const handleAddSong = (e) => {
    e.preventDefault();
    if (songName.trim()) {
      onAddSong({ name: songName.trim() });
      setSongName('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-20">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-purple-400">{show.artist}</h2>
                {!show.isManual && (
                  <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-1 rounded">
                    setlist.fm
                  </span>
                )}
              </div>
              <p className="text-gray-400 mt-1">
                {new Date(show.date).toLocaleDateString()} • {show.venue}
                {show.city && `, ${show.city}`}
              </p>
              {show.tour && (
                <p className="text-purple-300 text-sm mt-1">Tour: {show.tour}</p>
              )}
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
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {show.setlist.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No songs in setlist</p>
          ) : (
            <div className="space-y-3">
              {show.setlist.map((song, index) => (
                <div key={song.id} className="bg-gray-900 rounded-lg p-4">
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsView({ stats }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">Song Statistics</h2>
      
      {stats.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No songs tracked yet</p>
      ) : (
        <div className="space-y-3">
          {stats.map(song => (
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
                      <span>{new Date(performance.date).toLocaleDateString()} - {performance.artist} @ {performance.venue}</span>
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
  );
}
