import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Music, Plus, X, Star, Calendar, MapPin, List, BarChart3, Check, Search, Download, ChevronLeft, ChevronRight, Users, Building2, ChevronDown, MessageSquare, LogOut, User, Shield, Trophy, TrendingUp, Crown, Mail, Send } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';

// Admin email whitelist
const ADMIN_EMAILS = ['phillip.leonard@gmail.com'];

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

function extractFirstName(displayName) {
  if (!displayName) return 'Anonymous';
  return displayName.split(' ')[0];
}

async function updateUserProfile(user, shows = []) {
  if (!user) return;

  const profileRef = doc(db, 'userProfiles', user.uid);
  const uniqueVenues = new Set(shows.map(s => s.venue)).size;
  const totalSongs = shows.reduce((acc, s) => acc + s.setlist.length, 0);
  const ratedSongs = shows.reduce((acc, s) => acc + s.setlist.filter(song => song.rating).length, 0);

  const profileData = {
    odubleserId: user.uid,
    email: user.email,
    displayName: user.displayName || '',
    firstName: extractFirstName(user.displayName),
    photoURL: user.photoURL || '',
    lastLogin: serverTimestamp(),
    showCount: shows.length,
    songCount: totalSongs,
    ratedSongCount: ratedSongs,
    venueCount: uniqueVenues
  };

  // Check if profile exists to preserve createdAt
  const existingProfile = await getDoc(profileRef);
  if (!existingProfile.exists()) {
    profileData.createdAt = serverTimestamp();
  }

  await setDoc(profileRef, profileData, { merge: true });
}

async function updateCommunityStats() {
  try {
    // Get all user profiles
    const profilesSnapshot = await getDocs(collection(db, 'userProfiles'));
    const profiles = profilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get all shows from all users for song aggregation
    const allSongs = {};
    let totalShows = 0;
    let totalSongs = 0;

    for (const profile of profiles) {
      const showsSnapshot = await getDocs(collection(db, 'users', profile.id, 'shows'));
      const userShows = showsSnapshot.docs.map(doc => doc.data());
      totalShows += userShows.length;

      for (const show of userShows) {
        const setlist = show.setlist || [];
        for (const song of setlist) {
          totalSongs++;
          const songKey = song.name.toLowerCase().trim();
          if (!allSongs[songKey]) {
            allSongs[songKey] = {
              songName: song.name,
              users: new Set(),
              artists: new Set()
            };
          }
          allSongs[songKey].users.add(profile.id);
          allSongs[songKey].artists.add(show.artist);
        }
      }
    }

    // Build leaderboards
    const topShowsAttended = [...profiles]
      .sort((a, b) => (b.showCount || 0) - (a.showCount || 0))
      .slice(0, 10)
      .map(p => ({
        odubleserId: p.id,
        firstName: p.firstName,
        photoURL: p.photoURL,
        count: p.showCount || 0
      }));

    const topSongsRated = [...profiles]
      .sort((a, b) => (b.ratedSongCount || 0) - (a.ratedSongCount || 0))
      .slice(0, 10)
      .map(p => ({
        odubleserId: p.id,
        firstName: p.firstName,
        photoURL: p.photoURL,
        count: p.ratedSongCount || 0
      }));

    const topVenuesVisited = [...profiles]
      .sort((a, b) => (b.venueCount || 0) - (a.venueCount || 0))
      .slice(0, 10)
      .map(p => ({
        odubleserId: p.id,
        firstName: p.firstName,
        photoURL: p.photoURL,
        count: p.venueCount || 0
      }));

    // Top songs by number of users who've seen them
    const topSongsBySightings = Object.values(allSongs)
      .map(s => ({
        songName: s.songName,
        userCount: s.users.size,
        artists: [...s.artists].slice(0, 3)
      }))
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 10);

    // Save community stats
    const statsRef = doc(db, 'communityStats', 'global');
    await setDoc(statsRef, {
      updatedAt: serverTimestamp(),
      totalUsers: profiles.length,
      totalShows,
      totalSongs,
      topShowsAttended,
      topSongsRated,
      topVenuesVisited,
      topSongsBySightings
    });
  } catch (error) {
    console.error('Failed to update community stats:', error);
  }
}

function RatingSelect({ value, onChange, max = 10, label }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs font-medium text-white/50">{label}</span>}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        onClick={(e) => e.stopPropagation()}
        className="px-2.5 py-1.5 bg-white/10 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
      >
        <option value="" className="bg-slate-800">--</option>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <option key={n} value={n} className="bg-slate-800">{n}</option>
        ))}
      </select>
      {value && (
        <span className="text-sm font-semibold text-emerald-400">{value}/10</span>
      )}
    </div>
  );
}

// Sidebar Navigation Component
function Sidebar({ activeView, setActiveView, isAdmin, onLogout, userName }) {
  const navItems = [
    { id: 'search', label: 'Search', icon: Search },
    { id: 'shows', label: 'Shows', icon: List },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'invite', label: 'Invite', icon: Mail },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  ];

  return (
    <div className="w-64 h-screen bg-slate-950/80 backdrop-blur-xl border-r border-white/5 flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Music className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-white">Show Tracker</span>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm text-white/70 truncate">{userName}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
              activeView === id
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:bg-white/5 hover:text-white/80'
            }`}
          >
            <Icon className={`w-5 h-5 ${activeView === id ? 'text-emerald-400' : ''}`} />
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-white/5 space-y-1">
        {isAdmin && (
          <button
            onClick={() => setActiveView('admin')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
              activeView === 'admin'
                ? 'bg-rose-500/20 text-rose-400'
                : 'text-white/60 hover:bg-white/5 hover:text-white/80'
            }`}
          >
            <Shield className={`w-5 h-5 ${activeView === 'admin' ? 'text-rose-400' : ''}`} />
            <span className="font-medium">Admin</span>
          </button>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-white/60 hover:bg-white/5 hover:text-white/80 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}

// Invite View Component
function InviteView() {
  const [email, setEmail] = useState('');

  const handleInvite = () => {
    const subject = encodeURIComponent('Join me on Show Tracker!');
    const body = encodeURIComponent(
      `Hey!\n\nI've been using Show Tracker to keep track of all the concerts I've been to. You can save setlists, rate songs, and see your concert stats.\n\nCheck it out and join the community!\n\nhttps://show-tracker.netlify.app`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Invite Friends</h1>
      <p className="text-white/60 mb-8">Share Show Tracker with your concert-going friends.</p>

      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <label className="block text-sm font-medium text-white/70 mb-2">
          Friend's Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="friend@example.com"
          className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40 mb-4"
        />
        <button
          onClick={handleInvite}
          disabled={!email.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
        >
          <Send className="w-4 h-4" />
          Send Invitation
        </button>
      </div>

      <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-medium text-white/70 mb-2">Or share this link:</h3>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value="https://show-tracker.netlify.app"
            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white/60"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText('https://show-tracker.netlify.app');
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-sm font-medium transition-colors"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

// Feedback View Component
function FeedbackView() {
  const [feedback, setFeedback] = useState('');

  const handleSubmit = () => {
    const subject = encodeURIComponent('Show Tracker Feedback');
    const body = encodeURIComponent(feedback);
    window.location.href = `mailto:pdl33@icloud.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Send Feedback</h1>
      <p className="text-white/60 mb-8">We'd love to hear your thoughts, suggestions, or bug reports.</p>

      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <label className="block text-sm font-medium text-white/70 mb-2">
          Your Feedback
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Tell us what you think..."
          rows={6}
          className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40 mb-4 resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!feedback.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
        >
          <Send className="w-4 h-4" />
          Send Feedback
        </button>
      </div>
    </div>
  );
}

// Community Stats View Component
function CommunityStatsView({ communityStats }) {
  if (!communityStats) {
    return (
      <div className="text-center py-16">
        <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <p className="text-white/40">Loading community stats...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Community Stats</h1>
      <p className="text-white/60 mb-8">See how you compare with other show-goers</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Show-Goers */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold text-white text-lg">Top Show-Goers</h2>
          </div>
          <div className="space-y-3">
            {(communityStats.topShowsAttended || []).slice(0, 10).map((user, i) => (
              <div key={user.odubleserId} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/40'}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/80 flex-1">{user.firstName}</span>
                <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-semibold">
                  {user.count} shows
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Rated Shows */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold text-white text-lg">Top Raters</h2>
          </div>
          <div className="space-y-3">
            {(communityStats.topSongsRated || []).slice(0, 10).map((user, i) => (
              <div key={user.odubleserId} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-pink-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-pink-600' : 'text-white/40'}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/80 flex-1">{user.firstName}</span>
                <span className="bg-pink-500/20 text-pink-400 px-3 py-1 rounded-full text-sm font-semibold">
                  {user.count} ratings
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Most Popular Songs */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold text-white text-lg">Popular Songs</h2>
          </div>
          <div className="space-y-3">
            {(communityStats.topSongsBySightings || []).slice(0, 10).map((song, i) => (
              <div key={song.songName} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-violet-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-violet-600' : 'text-white/40'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 truncate">{song.songName}</div>
                  <div className="text-white/40 text-xs truncate">{song.artists?.join(', ')}</div>
                </div>
                <span className="bg-violet-500/20 text-violet-400 px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                  {song.userCount} fans
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Venue Explorers */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold text-white text-lg">Venue Explorers</h2>
          </div>
          <div className="space-y-3">
            {(communityStats.topVenuesVisited || []).slice(0, 10).map((user, i) => (
              <div key={user.odubleserId} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-cyan-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-cyan-600' : 'text-white/40'}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/80 flex-1">{user.firstName}</span>
                <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-sm font-semibold">
                  {user.count} venues
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center">
          <div className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            {communityStats.totalUsers || 0}
          </div>
          <div className="text-sm text-white/50 mt-1">Total Users</div>
        </div>
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center">
          <div className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            {communityStats.totalShows || 0}
          </div>
          <div className="text-sm text-white/50 mt-1">Total Shows</div>
        </div>
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center">
          <div className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            {communityStats.totalSongs || 0}
          </div>
          <div className="text-sm text-white/50 mt-1">Total Songs</div>
        </div>
      </div>
    </div>
  );
}

// Search View Component (Full Page)
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

  const formatSetlistDate = (dateStr) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toLocaleDateString();
    }
    return dateStr;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Search Shows</h1>
      <p className="text-white/60 mb-8">Find and import setlists from Setlist.fm</p>

      {/* Search Form */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Artist Name *</label>
            <input
              type="text"
              placeholder="e.g., Radiohead"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchSetlists(1)}
              className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Year</label>
            <input
              type="text"
              placeholder="e.g., 2024"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchSetlists(1)}
              className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Venue</label>
            <input
              type="text"
              placeholder="e.g., Madison Square Garden"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchSetlists(1)}
              className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">City</label>
            <input
              type="text"
              placeholder="e.g., New York"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchSetlists(1)}
              className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
            />
          </div>
        </div>
        <button
          onClick={() => searchSetlists(1)}
          disabled={isSearching || !artistName.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25"
        >
          <Search className="w-4 h-4" />
          {isSearching ? 'Searching...' : 'Search Setlist.fm'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Search Results</h2>
            <span className="text-sm text-white/50">Page {page} of {totalPages}</span>
          </div>

          {results.map((setlist) => (
            <div
              key={setlist.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white">{setlist.artist.name}</div>
                  <div className="text-sm text-white/60 mt-1">
                    {setlist.venue.name} &middot; {setlist.venue.city.name}, {setlist.venue.city.country.name}
                  </div>
                  <div className="text-sm text-white/40 mt-1">
                    {formatSetlistDate(setlist.eventDate)}
                    {setlist.tour && <span className="text-emerald-400 ml-2">{setlist.tour.name}</span>}
                  </div>
                  {setlist.sets?.set && (
                    <div className="text-xs text-white/30 mt-2">
                      {setlist.sets.set.reduce((acc, s) => acc + (s.song?.length || 0), 0)} songs
                    </div>
                  )}
                </div>
                <button
                  onClick={() => importSetlist(setlist)}
                  disabled={isImported(setlist.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isImported(setlist.id)
                      ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                      : 'bg-white/10 hover:bg-white/20 text-white'
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
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => searchSetlists(page - 1)}
                disabled={page === 1 || isSearching}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <span className="text-sm text-white/60 px-4">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => searchSetlists(page + 1)}
                disabled={page === totalPages || isSearching}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isSearching && results.length === 0 && !error && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">Enter an artist name to search for setlists</p>
        </div>
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
  const [sortBy, setSortBy] = useState('date');
  const [selectedArtist, setSelectedArtist] = useState(null);

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [localShowsToMigrate, setLocalShowsToMigrate] = useState([]);

  // Community stats
  const [communityStats, setCommunityStats] = useState(null);
  const [userRank, setUserRank] = useState(null);

  // Admin
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // Listen for community stats (for login page)
  useEffect(() => {
    const statsRef = doc(db, 'communityStats', 'global');
    const unsubscribe = onSnapshot(statsRef, (snapshot) => {
      if (snapshot.exists()) {
        setCommunityStats(snapshot.data());
      }
    }, (error) => {
      console.log('Community stats not available yet:', error.message);
    });

    return () => unsubscribe();
  }, []);

  const checkForLocalData = useCallback(() => {
    try {
      const stored = localStorage.getItem('concert-shows');
      if (stored) {
        const localShows = JSON.parse(stored);
        if (localShows && localShows.length > 0) {
          setLocalShowsToMigrate(localShows);
          setShowMigrationPrompt(true);
        }
      }
    } catch (error) {
      console.log('No local data to migrate');
    }
  }, []);

  const calculateUserRank = useCallback(async (userId) => {
    try {
      const profilesSnapshot = await getDocs(collection(db, 'userProfiles'));
      const profiles = profilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = profiles.sort((a, b) => (b.showCount || 0) - (a.showCount || 0));
      const rank = sorted.findIndex(p => p.id === userId) + 1;
      setUserRank({ rank, total: profiles.length });
    } catch (error) {
      console.error('Failed to calculate rank:', error);
    }
  }, []);

  const loadShows = useCallback(async (userId) => {
    setIsLoading(true);
    try {
      const showsRef = collection(db, 'users', userId, 'shows');
      const snapshot = await getDocs(showsRef);
      const loadedShows = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setShows(loadedShows);

      // Update user profile with current stats
      if (auth.currentUser) {
        await updateUserProfile(auth.currentUser, loadedShows);
        // Update community stats in background
        updateCommunityStats();
        // Calculate user rank
        calculateUserRank(userId);
      }
    } catch (error) {
      console.error('Failed to load shows:', error);
    } finally {
      setIsLoading(false);
    }
  }, [calculateUserRank]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        checkForLocalData();
        loadShows(currentUser.uid);
      } else {
        setShows([]);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [checkForLocalData, loadShows]);

  const handleMigrateData = async () => {
    if (!user || localShowsToMigrate.length === 0) return;

    try {
      for (const show of localShowsToMigrate) {
        const showRef = doc(db, 'users', user.uid, 'shows', show.id);
        await setDoc(showRef, {
          ...show,
          createdAt: show.createdAt || serverTimestamp(),
          migratedFromLocal: true
        });
      }
      localStorage.removeItem('concert-shows');
      setShowMigrationPrompt(false);
      setLocalShowsToMigrate([]);
      loadShows(user.uid);
    } catch (error) {
      console.error('Failed to migrate data:', error);
      alert('Failed to migrate data. Please try again.');
    }
  };

  const handleSkipMigration = () => {
    setShowMigrationPrompt(false);
    setLocalShowsToMigrate([]);
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
        alert('Login failed. Please try again.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShows([]);
      setSelectedShow(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const saveShow = async (updatedShow) => {
    if (!user) return;
    try {
      const showRef = doc(db, 'users', user.uid, 'shows', updatedShow.id);
      const { id, ...showData } = updatedShow;
      await setDoc(showRef, showData, { merge: true });
    } catch (error) {
      console.error('Failed to save show:', error);
    }
  };

  const addShow = async (showData) => {
    if (!user) return;

    const newShow = {
      ...showData,
      setlist: showData.setlist || [],
      createdAt: serverTimestamp(),
      isManual: !showData.setlistfmId
    };

    const showId = Date.now().toString();

    try {
      const showRef = doc(db, 'users', user.uid, 'shows', showId);
      await setDoc(showRef, newShow);
      const updatedShows = [...shows, { id: showId, ...newShow, createdAt: new Date().toISOString() }];
      setShows(updatedShows);
      setShowForm(false);

      // Update profile and community stats
      await updateUserProfile(user, updatedShows);
      updateCommunityStats();
      calculateUserRank(user.uid, updatedShows.length);
    } catch (error) {
      console.error('Failed to add show:', error);
      alert('Failed to add show. Please try again.');
    }
  };

  const deleteShow = async (showId) => {
    if (!user) return;
    if (!window.confirm('Delete this show?')) return;

    try {
      const showRef = doc(db, 'users', user.uid, 'shows', showId);
      await deleteDoc(showRef);
      const updatedShows = shows.filter(s => s.id !== showId);
      setShows(updatedShows);
      if (selectedShow?.id === showId) setSelectedShow(null);

      // Update profile and community stats
      await updateUserProfile(user, updatedShows);
      updateCommunityStats();
      calculateUserRank(user.uid, updatedShows.length);
    } catch (error) {
      console.error('Failed to delete show:', error);
      alert('Failed to delete show. Please try again.');
    }
  };

  const updateShowRating = async (showId, rating) => {
    const updatedShows = shows.map(show =>
      show.id === showId ? { ...show, rating } : show
    );
    setShows(updatedShows);
    if (selectedShow?.id === showId) {
      setSelectedShow(updatedShows.find(s => s.id === showId));
    }
    await saveShow(updatedShows.find(s => s.id === showId));
  };

  const updateShowComment = async (showId, comment) => {
    const updatedShows = shows.map(show =>
      show.id === showId ? { ...show, comment } : show
    );
    setShows(updatedShows);
    if (selectedShow?.id === showId) {
      setSelectedShow(updatedShows.find(s => s.id === showId));
    }
    await saveShow(updatedShows.find(s => s.id === showId));
  };

  const addSongToShow = async (showId, songData) => {
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
    const updatedShow = updatedShows.find(s => s.id === showId);
    setShows(updatedShows);
    setSelectedShow(updatedShow);
    await saveShow(updatedShow);
  };

  const updateSongRating = async (showId, songId, rating) => {
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
    const updatedShow = updatedShows.find(s => s.id === showId);
    setShows(updatedShows);
    setSelectedShow(updatedShow);
    await saveShow(updatedShow);
  };

  const updateSongComment = async (showId, songId, comment) => {
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
    const updatedShow = updatedShows.find(s => s.id === showId);
    setShows(updatedShows);
    setSelectedShow(updatedShow);
    await saveShow(updatedShow);
  };

  const batchRateUnrated = async (showId, rating) => {
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
    const updatedShow = updatedShows.find(s => s.id === showId);
    setShows(updatedShows);
    setSelectedShow(updatedShow);
    await saveShow(updatedShow);
  };

  const deleteSong = async (showId, songId) => {
    const updatedShows = shows.map(show => {
      if (show.id === showId) {
        return {
          ...show,
          setlist: show.setlist.filter(s => s.id !== songId)
        };
      }
      return show;
    });
    const updatedShow = updatedShows.find(s => s.id === showId);
    setShows(updatedShows);
    setSelectedShow(updatedShow);
    await saveShow(updatedShow);
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
      if (sortBy === 'rating') {
        // Sort by average rating of artist's shows (highest first)
        const avgA = a[1].filter(s => s.rating).reduce((acc, s, _, arr) => acc + s.rating / arr.length, 0) || 0;
        const avgB = b[1].filter(s => s.rating).reduce((acc, s, _, arr) => acc + s.rating / arr.length, 0) || 0;
        return avgB - avgA;
      }
      return b[1].length - a[1].length;
    });
  }, [sortedFilteredShows, sortBy]);

  const summaryStats = useMemo(() => {
    // Count unique songs (by name, case-insensitive)
    const uniqueSongs = new Set();
    shows.forEach(s => s.setlist.forEach(song => uniqueSongs.add(song.name.toLowerCase().trim())));
    const uniqueSongCount = uniqueSongs.size;

    const ratedShows = shows.filter(s => s.rating);
    const avgRating = ratedShows.length
      ? (ratedShows.reduce((a, s) => a + s.rating, 0) / ratedShows.length).toFixed(1)
      : null;
    const uniqueArtists = new Set(shows.map(s => s.artist)).size;
    const uniqueVenues = new Set(shows.map(s => s.venue)).size;
    return { totalSongs: uniqueSongCount, avgRating, uniqueArtists, uniqueVenues };
  }, [shows]);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white/50 font-medium">Loading...</div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white">
        {/* Header */}
        <div className="bg-black/20 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Music className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Show Tracker</h1>
              </div>
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white rounded-full font-medium transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign In
              </button>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <div className="w-28 h-28 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/40">
              <Music className="w-14 h-14 text-white" />
            </div>
            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white via-emerald-100 to-teal-200 bg-clip-text text-transparent">
              Track Your Concert Journey
            </h2>
            <p className="text-xl text-white/70 mb-10 max-w-xl mx-auto leading-relaxed">
              Save setlists, rate songs, discover patterns in your concert history, and join a community of live music lovers.
            </p>
            <button
              onClick={handleLogin}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-full transition-all text-lg font-semibold shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
            >
              <Music className="w-5 h-5" />
              Get Started Free
            </button>
          </div>

          {/* Community Stats */}
          {communityStats && (
            <div className="mt-16">
              <div className="text-center mb-10">
                <h3 className="text-2xl font-bold text-white/90 mb-2">Community Highlights</h3>
                <p className="text-white/50">Join {communityStats.totalUsers || 0} concert-goers tracking {communityStats.totalShows || 0} shows</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Top Shows Attended */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10 hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-semibold text-white/90">Top Show-Goers</h4>
                  </div>
                  <div className="space-y-3">
                    {(communityStats.topShowsAttended || []).slice(0, 5).map((user, i) => (
                      <div key={user.odubleserId} className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/40'}`}>
                          {i + 1}
                        </span>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-white/80 text-sm flex-1 truncate">{user.firstName}</span>
                        <span className="text-emerald-400 font-semibold text-sm">{user.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Songs Rated */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10 hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center">
                      <Star className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-semibold text-white/90">Top Raters</h4>
                  </div>
                  <div className="space-y-3">
                    {(communityStats.topSongsRated || []).slice(0, 5).map((user, i) => (
                      <div key={user.odubleserId} className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${i === 0 ? 'text-pink-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-pink-600' : 'text-white/40'}`}>
                          {i + 1}
                        </span>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-white/80 text-sm flex-1 truncate">{user.firstName}</span>
                        <span className="text-pink-400 font-semibold text-sm">{user.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Most Popular Songs */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10 hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-semibold text-white/90">Popular Songs</h4>
                  </div>
                  <div className="space-y-3">
                    {(communityStats.topSongsBySightings || []).slice(0, 5).map((song, i) => (
                      <div key={song.songName} className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${i === 0 ? 'text-violet-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-violet-600' : 'text-white/40'}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-white/80 text-sm truncate">{song.songName}</div>
                          <div className="text-white/40 text-xs truncate">{song.artists?.join(', ')}</div>
                        </div>
                        <span className="text-violet-400 font-semibold text-sm whitespace-nowrap">{song.userCount} fans</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Venues Visited */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10 hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-semibold text-white/90">Venue Explorers</h4>
                  </div>
                  <div className="space-y-3">
                    {(communityStats.topVenuesVisited || []).slice(0, 5).map((user, i) => (
                      <div key={user.odubleserId} className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${i === 0 ? 'text-cyan-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-cyan-600' : 'text-white/40'}`}>
                          {i + 1}
                        </span>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-white/80 text-sm flex-1 truncate">{user.firstName}</span>
                        <span className="text-cyan-400 font-semibold text-sm">{user.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto py-8 text-center text-white/30 text-sm">
          <p>Track shows from setlist.fm &middot; Rate your favorite performances &middot; Share your concert journey</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white/50 font-medium">Loading your shows...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Migration Prompt Modal */}
      {showMigrationPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-30">
          <div className="bg-slate-800 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-white">Import Existing Shows?</h2>
            <p className="text-white/60 mb-4">
              We found {localShowsToMigrate.length} show{localShowsToMigrate.length !== 1 ? 's' : ''} saved locally on this device.
              Would you like to import them to your account?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleMigrateData}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/30"
              >
                Import Shows
              </button>
              <button
                onClick={handleSkipMigration}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={(view) => { setActiveView(view); setSelectedArtist(null); }}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        userName={extractFirstName(user.displayName)}
      />

      {/* Main Content Area */}
      <div className="ml-64 min-h-screen">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {activeView === 'shows' && (
          <>
            {/* Summary stats */}
            {shows.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                {[
                  { label: 'Shows', value: shows.length, color: 'from-emerald-400 to-teal-400' },
                  { label: 'Songs', value: summaryStats.totalSongs, color: 'from-violet-400 to-purple-400' },
                  { label: 'Artists', value: summaryStats.uniqueArtists, color: 'from-amber-400 to-orange-400' },
                  { label: 'Avg Rating', value: summaryStats.avgRating || '--', color: 'from-pink-400 to-rose-400' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-center hover:bg-white/15 transition-all">
                    <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</div>
                    <div className="text-xs font-medium text-white/50 uppercase tracking-wide mt-1">{stat.label}</div>
                  </div>
                ))}
                {/* User Rank */}
                {userRank && (
                  <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-5 text-center hover:from-amber-500/30 hover:to-orange-500/30 transition-all">
                    <div className="flex items-center justify-center gap-2">
                      <Crown className="w-6 h-6 text-amber-400" />
                      <div className="text-3xl font-bold text-amber-400">#{userRank.rank}</div>
                    </div>
                    <div className="text-xs font-medium text-amber-200/70 uppercase tracking-wide mt-1">of {userRank.total} users</div>
                  </div>
                )}
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">My Shows</h1>
                <p className="text-white/60">All the concerts you've attended</p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all whitespace-nowrap shadow-lg shadow-emerald-500/25"
              >
                <Plus className="w-4 h-4" />
                Add Show
              </button>
            </div>

            {/* Search & Sort */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6">
              <div className="flex gap-3 flex-wrap items-center">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter shows..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
                  />
                </div>
                {shows.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white/50">Sort:</span>
                    {['date', 'artist', 'rating'].map(opt => (
                      <button
                        key={opt}
                        onClick={() => setSortBy(opt)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          sortBy === opt
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {sortedFilteredShows.length === 0 && !showForm && (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Music className="w-10 h-10 text-white/30" />
                </div>
                <p className="text-lg font-medium mb-1 text-white/70">No shows yet</p>
                <p className="text-sm text-white/40 mb-6">Use Search in the sidebar to find and import setlists</p>
                <button
                  onClick={() => setActiveView('search')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl font-medium transition-colors border border-emerald-500/30"
                >
                  <Search className="w-4 h-4" />
                  Search Setlist.fm
                </button>
              </div>
            )}

            {showForm && <ShowForm onSubmit={addShow} onCancel={() => setShowForm(false)} />}

            {/* Artist groups table */}
            {sortedFilteredShows.length > 0 && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="text-left px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Artist</th>
                      <th className="text-center px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Shows</th>
                      <th className="text-center px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Avg Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {artistGroups.map(([artist, artistShows]) => (
                      <ArtistShowsRow
                        key={artist}
                        artist={artist}
                        shows={artistShows}
                        expanded={selectedArtist === artist}
                        onToggle={() => setSelectedArtist(selectedArtist === artist ? null : artist)}
                        onSelectShow={setSelectedShow}
                        onDeleteShow={deleteShow}
                        onRateShow={updateShowRating}
                        selectedShowId={selectedShow?.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedShow && (
              <SetlistEditor
                show={selectedShow}
                onAddSong={(song) => addSongToShow(selectedShow.id, song)}
                onRateSong={(songId, rating) => updateSongRating(selectedShow.id, songId, rating)}
                onCommentSong={(songId, comment) => updateSongComment(selectedShow.id, songId, comment)}
                onDeleteSong={(songId) => deleteSong(selectedShow.id, songId)}
                onRateShow={(rating) => updateShowRating(selectedShow.id, rating)}
                onCommentShow={(comment) => updateShowComment(selectedShow.id, comment)}
                onBatchRate={(rating) => batchRateUnrated(selectedShow.id, rating)}
                onClose={() => setSelectedShow(null)}
              />
            )}
          </>
        )}

        {activeView === 'stats' && (
          <StatsView
            shows={shows}
            songStats={getSongStats()}
            artistStats={getArtistStats()}
            venueStats={getVenueStats()}
            topRatedShows={getTopRatedShows()}
            onRateSong={updateSongRating}
          />
        )}

        {activeView === 'search' && (
          <SearchView
            onImport={addShow}
            importedIds={importedIds}
          />
        )}

        {activeView === 'invite' && (
          <InviteView />
        )}

        {activeView === 'feedback' && (
          <FeedbackView />
        )}

        {activeView === 'community' && (
          <CommunityStatsView communityStats={communityStats} />
        )}

        {activeView === 'admin' && isAdmin && (
          <AdminView />
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
    <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-4">
      <h3 className="text-lg font-semibold mb-4 text-white">Add Show Manually</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Artist/Band"
          value={formData.artist}
          onChange={(e) => setFormData({...formData, artist: e.target.value})}
          className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
          required
        />
        <input
          type="text"
          placeholder="Venue"
          value={formData.venue}
          onChange={(e) => setFormData({...formData, venue: e.target.value})}
          className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
          required
        />
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
          className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white"
          required
        />
        <div className="flex gap-3 pt-2">
          <button type="submit" className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/25">
            Add Show
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function ArtistShowsRow({ artist, shows, expanded, onToggle, onSelectShow, onDeleteShow, onRateShow, selectedShowId }) {
  const avgRating = (() => {
    const rated = shows.filter(s => s.rating);
    if (rated.length === 0) return null;
    return (rated.reduce((a, s) => a + s.rating, 0) / rated.length).toFixed(1);
  })();

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-4">
          <div className="flex items-center gap-3">
            <ChevronDown className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: artistColor(artist) }} />
            <span className="font-medium" style={{ color: artistColor(artist) }}>{artist}</span>
          </div>
        </td>
        <td className="px-4 py-4 text-center">
          <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-sm font-semibold">
            {shows.length}
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
      {expanded && (
        <tr>
          <td colSpan={3} className="px-4 py-0 bg-white/[0.02]">
            <div className="py-4 pl-6 border-l-2 border-emerald-500/50 ml-2 mb-2">
              <div className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wide">Shows</div>
              <div className="space-y-3">
                {shows.map(show => {
                  const songAvg = avgSongRating(show.setlist);
                  const isSelected = selectedShowId === show.id;
                  return (
                    <div
                      key={show.id}
                      className={`group flex items-start justify-between bg-white/5 rounded-2xl p-4 border cursor-pointer transition-all ${
                        isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/10' : 'border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                      onClick={() => onSelectShow(show)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Calendar className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-white/80">{formatDate(show.date)}</span>
                          <span className="text-white/20">&middot;</span>
                          <MapPin className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-white/60">{show.venue}{show.city ? `, ${show.city}` : ''}</span>
                          <span className="text-white/20">&middot;</span>
                          <Music className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-white/60">{show.setlist.length} songs</span>
                        </div>
                        {show.tour && (
                          <div className="text-xs text-emerald-400 font-medium mt-1.5">Tour: {show.tour}</div>
                        )}
                        {show.comment && (
                          <div className="flex items-start gap-1.5 mt-1.5 text-xs text-white/50 italic">
                            <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            {show.comment}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-3" onClick={(e) => e.stopPropagation()}>
                          <RatingSelect value={show.rating} onChange={(r) => onRateShow(show.id, r)} label="Show:" />
                          {songAvg && (
                            <span className="text-xs font-medium text-white/40">Songs avg: {songAvg}/10</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteShow(show.id);
                        }}
                        className="text-white/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 ml-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SetlistEditor({ show, onAddSong, onRateSong, onCommentSong, onDeleteSong, onRateShow, onCommentShow, onBatchRate, onClose }) {
  const [songName, setSongName] = useState('');
  const [batchRating, setBatchRating] = useState(5);
  const [editingComment, setEditingComment] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [editingShowComment, setEditingShowComment] = useState(false);
  const [showCommentText, setShowCommentText] = useState(show.comment || '');

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-20">
      <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold" style={{ color: artistColor(show.artist) }}>{show.artist}</h2>
                {!show.isManual && (
                  <span className="text-xs font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                    setlist.fm
                  </span>
                )}
              </div>
              <p className="text-white/50 mt-1">
                {formatDate(show.date)} &middot; {show.venue}
                {show.city && `, ${show.city}`}
              </p>
              {show.tour && (
                <p className="text-emerald-400 text-sm font-medium mt-1">Tour: {show.tour}</p>
              )}
              <div className="mt-3">
                <RatingSelect value={show.rating} onChange={onRateShow} label="Show rating:" />
              </div>
              {!editingShowComment && (
                <div className="mt-2">
                  {show.comment ? (
                    <div
                      className="text-sm text-white/50 italic bg-white/5 p-2.5 rounded-lg border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                      onClick={() => { setEditingShowComment(true); setShowCommentText(show.comment || ''); }}
                    >
                      <div className="flex items-start gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/40" />
                        <span>{show.comment}</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingShowComment(true); setShowCommentText(''); }}
                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/60 transition-colors"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Add show note
                    </button>
                  )}
                </div>
              )}
              {editingShowComment && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={showCommentText}
                    onChange={(e) => setShowCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { onCommentShow(showCommentText.trim()); setEditingShowComment(false); }
                    }}
                    placeholder="Add a note about this show..."
                    className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
                    autoFocus
                  />
                  <button
                    onClick={() => { onCommentShow(showCommentText.trim()); setEditingShowComment(false); }}
                    className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingShowComment(false)}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white/60 rounded-lg text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleAddSong} className="flex gap-3">
            <input
              type="text"
              placeholder="Add song to setlist..."
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
            />
            <button type="submit" className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/25">
              <Plus className="w-5 h-5" />
            </button>
          </form>

          {unratedCount > 0 && (
            <div className="flex items-center gap-3 mt-4 p-3 bg-white/5 border border-white/10 rounded-xl">
              <span className="text-xs font-medium text-white/50">Rate {unratedCount} unrated:</span>
              <RatingSelect value={batchRating} onChange={(v) => setBatchRating(v || 5)} />
              <button
                onClick={() => onBatchRate(batchRating)}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
          {show.setlist.length === 0 ? (
            <p className="text-center text-white/40 py-8 font-medium">No songs in setlist</p>
          ) : (
            <div className="space-y-3">
              {show.setlist.map((song, index) => (
                <React.Fragment key={song.id}>
                  {song.setBreak && (
                    <div className="text-emerald-400 font-semibold text-sm pt-3 pb-1 border-t border-white/10 mt-3">
                      {song.setBreak}
                    </div>
                  )}
                  <div className="group bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-white/30 font-mono text-sm mt-1">{index + 1}.</span>
                        <div className="flex-1">
                          <span className="font-medium text-white">{song.name}</span>
                          {song.cover && (
                            <span className="text-sm text-emerald-400 ml-2">({song.cover})</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteSong(song.id)}
                        className="text-white/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 ml-8">
                      <RatingSelect value={song.rating} onChange={(v) => onRateSong(song.id, v)} label="Rating:" />
                      <button
                        onClick={() => startEditComment(song)}
                        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                          song.comment
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/60'
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        {song.comment ? 'Edit note' : 'Add note'}
                      </button>
                    </div>
                    {song.comment && editingComment !== song.id && (
                      <div className="ml-8 mt-2 text-sm text-white/50 italic bg-white/5 p-2.5 rounded-lg border border-white/10">
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
                          className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
                          autoFocus
                        />
                        <button
                          onClick={() => saveComment(song.id)}
                          className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingComment(null)}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white/60 rounded-lg text-xs font-medium transition-colors"
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

function SongStatsRow({ song, index, onRateSong }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <ChevronDown className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            <span className="font-medium text-white">{song.name}</span>
          </div>
        </td>
        <td className="px-4 py-4 text-center">
          <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-sm font-semibold">
            {song.count}x
          </span>
        </td>
        <td className="px-4 py-4 text-center">
          {song.avgRating ? (
            <span className="text-sm font-semibold text-emerald-400">
              {song.avgRating}/10
            </span>
          ) : (
            <span className="text-white/30">--</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={3} className="px-4 py-0 bg-white/[0.02]">
            <div className="py-4 pl-6 border-l-2 border-emerald-500/50 ml-2 mb-2">
              <div className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wide">Performances</div>
              <div className="space-y-3">
                {song.shows.map((performance, i) => (
                  <div key={i} className="flex items-start justify-between bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <Calendar className="w-3.5 h-3.5 text-white/40" />
                        <span className="text-white/80">{formatDate(performance.date)}</span>
                        <span className="text-white/20">&middot;</span>
                        <span className="font-medium" style={{ color: artistColor(performance.artist) }}>
                          {performance.artist}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-1 text-white/50">
                        <MapPin className="w-3.5 h-3.5" />
                        {performance.venue}{performance.city ? `, ${performance.city}` : ''}
                      </div>
                      {performance.comment && (
                        <div className="flex items-start gap-1.5 mt-1.5 text-sm text-white/50 italic">
                          <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          {performance.comment}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      <RatingSelect
                        value={performance.rating}
                        onChange={(r) => onRateSong(performance.showId, performance.songId, r)}
                      />
                    </div>
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

function StatsView({ shows, songStats, artistStats, venueStats, topRatedShows, onRateSong }) {
  const [tab, setTab] = useState('songs');
  const [filterArtist, setFilterArtist] = useState('');
  const [filterVenue, setFilterVenue] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [expandedVenue, setExpandedVenue] = useState(null);
  const [expandedYear, setExpandedYear] = useState(null);
  const [expandedShow, setExpandedShow] = useState(null);

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

  // Venue details: grouped by venue -> year -> shows
  const venueDetails = useMemo(() => {
    const details = {};
    shows.forEach(show => {
      const venueName = show.venue + (show.city ? `, ${show.city}` : '');
      if (!details[venueName]) {
        details[venueName] = { years: {}, artistSet: new Set() };
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
  }, [shows]);

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
            <div className="bg-white/5 border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="text-left px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Artist</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Shows</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Total Songs</th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {artistStats.map((artist) => (
                    <tr key={artist.name} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: artistColor(artist.name) }} />
                          <span className="font-medium" style={{ color: artistColor(artist.name) }}>{artist.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-sm font-semibold">
                          {artist.count}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-white/60">{artist.totalSongs}</td>
                      <td className="px-4 py-4 text-center">
                        {artist.avgRating ? (
                          <span className="text-sm font-semibold text-emerald-400">
                            {artist.avgRating}/10
                          </span>
                        ) : (
                          <span className="text-white/30">--</span>
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
          <h2 className="text-xl font-bold mb-4 text-white">Venue Statistics</h2>
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
                      <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-sm font-semibold">
                        {venue.showCount} shows
                      </span>
                      <span className="text-white/50 text-sm">{venue.artistCount} artists</span>
                    </div>
                  </button>

                  {/* Expanded Years */}
                  {expandedVenue === venue.name && (
                    <div className="border-t border-white/10 bg-white/5">
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
                    <tr key={show.id} className="hover:bg-white/5 transition-colors">
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

function AdminView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const profilesSnapshot = await getDocs(collection(db, 'userProfiles'));
      const loadedUsers = profilesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        lastLogin: doc.data().lastLogin?.toDate?.() || new Date()
      }));
      setUsers(loadedUsers.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter(user =>
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStats = useMemo(() => ({
    totalUsers: users.length,
    totalShows: users.reduce((acc, u) => acc + (u.showCount || 0), 0),
    totalSongs: users.reduce((acc, u) => acc + (u.songCount || 0), 0),
    totalRated: users.reduce((acc, u) => acc + (u.ratedSongCount || 0), 0)
  }), [users]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-white/50 font-medium">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Admin Portal</h2>
        <button
          onClick={loadUsers}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: totalStats.totalUsers, color: 'from-violet-500 to-purple-500' },
          { label: 'Total Shows', value: totalStats.totalShows, color: 'from-emerald-500 to-teal-500' },
          { label: 'Total Songs', value: totalStats.totalSongs, color: 'from-amber-500 to-orange-500' },
          { label: 'Songs Rated', value: totalStats.totalRated, color: 'from-pink-500 to-rose-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
            <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
              {stat.value.toLocaleString()}
            </div>
            <div className="text-sm font-medium text-white/50 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-5 h-5 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">User</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide hidden md:table-cell">Email</th>
              <th className="text-center px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Shows</th>
              <th className="text-center px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Songs</th>
              <th className="text-center px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide hidden sm:table-cell">Venues</th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide hidden lg:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-white">{user.firstName || 'Anonymous'}</div>
                      <div className="text-sm text-white/40 md:hidden">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-white/60 hidden md:table-cell">{user.email}</td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-sm font-semibold">
                    {user.showCount || 0}
                  </span>
                </td>
                <td className="px-6 py-4 text-center text-white/60">{user.songCount || 0}</td>
                <td className="px-6 py-4 text-center text-white/60 hidden sm:table-cell">{user.venueCount || 0}</td>
                <td className="px-6 py-4 text-right text-white/40 text-sm hidden lg:table-cell">
                  {user.createdAt?.toLocaleDateString?.() || 'Unknown'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-white/40">
            {searchTerm ? 'No users match your search' : 'No users yet'}
          </div>
        )}
      </div>
    </div>
  );
}
