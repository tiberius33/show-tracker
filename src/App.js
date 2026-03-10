import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Music, Plus, X, Star, Calendar, MapPin, List, BarChart3, Check, Search, Download, ChevronLeft, ChevronRight, ChevronUp, Users, Building2, ChevronDown, MessageSquare, LogOut, User, Shield, Trophy, TrendingUp, Crown, Mail, Send, Menu, Coffee, Heart, Sparkles, Share2, Copy, ScrollText, Upload, AlertTriangle, UserPlus, UserCheck, UserX, Tag, Camera, RefreshCw, Bell, Eye, Database, ExternalLink, Ticket, Trash2, Clock } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, serverTimestamp, onSnapshot, query, where, addDoc, writeBatch, runTransaction, increment } from 'firebase/firestore';
import { logEvent } from 'firebase/analytics';
import { auth, db, googleProvider, analytics } from './firebase';
import { Link, useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Footer from './Footer';
import AuthModal from './components/auth/AuthModal';
import ProfileView from './components/profile/ProfileView';

// CSS-only tooltip wrapper (mobile-responsive, replaces native title attr)
function Tip({ text, children }) {
  if (!text) return children;
  return (
    <span className="tooltip-wrap">
      {children}
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

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
  // Use consistent yellow/amber color for all artists
  return '#f59e0b'; // Tailwind amber-500
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

// CSV Parser - handles quoted fields, escaped quotes, various line endings
function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(current.trim());
        if (row.some(cell => cell !== '')) rows.push(row);
        row = [];
        current = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(current.trim());
        if (row.some(cell => cell !== '')) rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }
  // Last field/row
  row.push(current.trim());
  if (row.some(cell => cell !== '')) rows.push(row);
  return rows;
}

// Robust date parser for import - normalizes to YYYY-MM-DD
function parseImportDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;

  // Excel serial date number
  if (/^\d{4,5}(\.\d+)?$/.test(s) && Number(s) > 1000 && Number(s) < 100000) {
    const serial = Number(s);
    const utcDays = Math.floor(serial - 25569);
    const d = new Date(utcDays * 86400000);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }

  // YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!isNaN(d)) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const mdy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (mdy) {
    let year = Number(mdy[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try native Date parsing as fallback (handles "January 5, 2024", etc.)
  const d = new Date(s);
  if (!isNaN(d) && d.getFullYear() > 1900) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

// Auto-detect column mapping from headers
function autoDetectMapping(headers) {
  const mapping = {};
  const patterns = {
    artist: /^(artist|band|performer|act|group|musician)s?$/i,
    venue: /^(venue|location|place|hall|theater|theatre|arena|club)$/i,
    date: /^(date|show.?date|event.?date|when|day)$/i,
    city: /^(city|town|metro|location.?city)$/i,
    country: /^(country|nation|state.?country)$/i,
    rating: /^(rating|score|stars|rank)$/i,
    comment: /^(comment|comments|notes?|review|thoughts|memo)$/i,
    tour: /^(tour|tour.?name|tour.?title|event|event.?name)$/i,
  };

  headers.forEach((header, index) => {
    const h = header.trim();
    for (const [field, pattern] of Object.entries(patterns)) {
      if (pattern.test(h) && !(field in mapping)) {
        mapping[field] = index;
        break;
      }
    }
  });

  return mapping;
}

// Skeleton Loader Component
function SkeletonCard() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-white/10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-white/10 rounded-lg w-3/4" />
          <div className="h-4 bg-white/10 rounded-lg w-1/2" />
          <div className="h-3 bg-white/10 rounded-lg w-1/3" />
        </div>
        <div className="w-16 h-8 bg-white/10 rounded-lg" />
      </div>
    </div>
  );
}

function ShowsListSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
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

    // Get all shows from all users for song and venue aggregation
    const allSongs = {};
    const allVenues = {};
    let totalShows = 0;
    let totalSongs = 0;

    // Use profile-level counts for totals (always accessible)
    totalShows = profiles.reduce((acc, p) => acc + (p.showCount || 0), 0);
    totalSongs = profiles.reduce((acc, p) => acc + (p.songCount || 0), 0);

    for (const profile of profiles) {
      try {
        const showsSnapshot = await getDocs(collection(db, 'users', profile.id, 'shows'));
        const userShows = showsSnapshot.docs.map(doc => doc.data());

        for (const show of userShows) {
          // Track venue attendance
          const venueName = show.venue + (show.city ? `, ${show.city}` : '');
          if (!allVenues[venueName]) {
            allVenues[venueName] = { count: 0, artists: new Set() };
          }
          allVenues[venueName].count++;
          allVenues[venueName].artists.add(show.artist);

          const setlist = show.setlist || [];
          for (const song of setlist) {
            const songKey = song.name.toLowerCase().trim();
            if (!allSongs[songKey]) {
              allSongs[songKey] = {
                songName: song.name,
                users: new Set(),
                artists: new Set(),
                ratings: []
              };
            }
            allSongs[songKey].users.add(profile.id);
            allSongs[songKey].artists.add(show.artist);
            if (song.rating) {
              allSongs[songKey].ratings.push(song.rating);
            }
          }
        }
      } catch (err) {
        // Permission denied for other users' shows — skip gracefully
        // Leaderboards still work from profile data
      }
    }

    // Build leaderboards
    const topShowsAttended = [...profiles]
      .sort((a, b) => (b.showCount || 0) - (a.showCount || 0))
      .slice(0, 5)
      .map(p => ({
        odubleserId: p.id,
        firstName: p.firstName,
        photoURL: p.photoURL,
        count: p.showCount || 0
      }));

    const topSongsRated = [...profiles]
      .sort((a, b) => (b.ratedSongCount || 0) - (a.ratedSongCount || 0))
      .slice(0, 5)
      .map(p => ({
        odubleserId: p.id,
        firstName: p.firstName,
        photoURL: p.photoURL,
        count: p.ratedSongCount || 0
      }));

    const topVenuesVisited = [...profiles]
      .sort((a, b) => (b.venueCount || 0) - (a.venueCount || 0))
      .slice(0, 5)
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
      .slice(0, 5);

    // Top songs by average rating (minimum 2 ratings to qualify)
    const topSongsByRating = Object.values(allSongs)
      .filter(s => s.ratings.length >= 2)
      .map(s => ({
        songName: s.songName,
        avgRating: (s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length).toFixed(1),
        ratingCount: s.ratings.length,
        artists: [...s.artists].slice(0, 3)
      }))
      .sort((a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating))
      .slice(0, 5);

    // Top venues by number of shows
    const topVenues = Object.entries(allVenues)
      .map(([name, data]) => ({
        venueName: name,
        showCount: data.count,
        artistCount: data.artists.size
      }))
      .sort((a, b) => b.showCount - a.showCount)
      .slice(0, 5);

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
      topSongsBySightings,
      topSongsByRating,
      topVenues
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
function Sidebar({ activeView, setActiveView, isAdmin, onLogout, userName, isOpen, onClose, isGuest, onCreateAccount, pendingNotificationCount, upcomingShowsBadgeCount }) {
  const pinnedTopItems = [
    { id: 'search', label: 'Search', icon: Search },
  ];

  const scrollItems = [
    { id: 'shows', label: 'Shows', icon: List },
    { id: 'scan-import', label: 'Scan / Import', icon: Camera },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    ...(isGuest ? [] : [
      { id: 'friends', label: 'Friends', icon: UserPlus, badge: pendingNotificationCount },
      { id: 'community', label: 'Community', icon: Users },
    ]),
    { id: 'upcoming-shows', label: 'Upcoming Shows', icon: Ticket, badge: upcomingShowsBadgeCount, beta: true },
    { id: 'roadmap', label: 'Roadmap', icon: TrendingUp },
    { id: 'release-notes', label: 'Release Notes', icon: ScrollText },
  ];

  const pinnedBottomItems = [
    ...(isGuest ? [] : [{ id: 'invite', label: 'Invite', icon: Send }]),
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  ];

  const handleNavClick = (id) => {
    setActiveView(id);
    if (onClose) onClose(); // Close mobile drawer
  };

  const handleLogoutClick = () => {
    onLogout();
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-64 h-screen bg-slate-950/95 md:bg-slate-950/80 backdrop-blur-xl border-r border-white/5 flex flex-col fixed left-0 top-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <img src="/logo.svg" alt="MySetlists" className="h-10 w-auto" />
            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
        </div>

        {/* User info - hidden for now */}

        {/* Pinned top: Search */}
        <div className="p-3 space-y-1 border-b border-white/5">
          {pinnedTopItems.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                activeView === id
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <Icon className={`w-5 h-5 ${activeView === id ? 'text-emerald-400' : ''}`} />
              <span className="font-medium flex-1">{label}</span>
              {badge > 0 && (
                <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable middle */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {scrollItems.map(({ id, label, icon: Icon, badge, beta }) => (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                activeView === id
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <Icon className={`w-5 h-5 ${activeView === id ? 'text-emerald-400' : ''}`} />
              <span className="font-medium flex-1">{label}</span>
              {beta && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  Beta
                </span>
              )}
              {badge > 0 && (
                <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Pinned bottom: Invite + Feedback */}
        <div className="p-3 space-y-1 border-t border-white/5">
          {pinnedBottomItems.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                activeView === id
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <Icon className={`w-5 h-5 ${activeView === id ? 'text-emerald-400' : ''}`} />
              <span className="font-medium flex-1">{label}</span>
              {badge > 0 && (
                <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bottom section */}
        <div className="p-3 border-t border-white/5 space-y-1">
          {isGuest && (
            <>
              <div className="px-4 py-2 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-400">
                  Your shows are saved locally. Create an account to sync across devices.
                </p>
              </div>
              <button
                onClick={() => { onCreateAccount(); onClose && onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 transition-all"
              >
                <User className="w-5 h-5" />
                <span className="font-medium">Create Account</span>
              </button>
            </>
          )}
          {isAdmin && (
            <button
              onClick={() => handleNavClick('admin')}
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
          <a
            href="https://buymeacoffee.com/phillipd"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-amber-400 hover:bg-amber-500/10 transition-all"
          >
            <Coffee className="w-5 h-5" />
            <span className="font-medium">Support</span>
          </a>
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-white/60 hover:bg-white/5 hover:text-white/80 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{isGuest ? 'Exit Guest Mode' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </>
  );
}

// Mobile Header Component
function MobileHeader({ onMenuClick }) {
  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>
        <img src="/logo.svg" alt="MySetlists" className="h-8 w-auto" />
        <div className="w-10" /> {/* Spacer for centering */}
      </div>
    </div>
  );
}

// Friends View Component
// Shows Together View
function ShowsTogetherView({ friend, getShowsTogether, onBack }) {
  const [sharedShows, setSharedShows] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const shows = await getShowsTogether(friend.uid);
        if (!cancelled) setSharedShows(shows.sort((a, b) => parseDate(b.date) - parseDate(a.date)));
      } catch (e) {
        if (!cancelled) setError('Failed to load shows.');
      }
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.uid]);

  const mostSeenArtist = sharedShows ? (() => {
    const counts = {};
    sharedShows.forEach(s => { counts[s.artist] = (counts[s.artist] || 0) + 1; });
    const [artist, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
    return artist ? { artist, count } : null;
  })() : null;

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Friends
      </button>
      <h1 className="text-xl md:text-2xl font-bold text-white mb-1">
        Shows with {friend.name}
      </h1>
      {sharedShows === null ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-white/30 animate-spin" />
        </div>
      ) : error ? (
        <p className="text-rose-400">{error}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 mb-6 text-sm">
            <span className="text-white/60">
              <span className="text-white font-semibold">{sharedShows.length}</span> show{sharedShows.length !== 1 ? 's' : ''} together
            </span>
            {mostSeenArtist && (
              <span className="text-white/60">
                Most seen: <span className="text-amber-400 font-semibold">{mostSeenArtist.artist}</span>
                {mostSeenArtist.count > 1 && <span className="text-white/40"> ({mostSeenArtist.count}x)</span>}
              </span>
            )}
          </div>
          {sharedShows.length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">No shared shows found yet.</p>
              <p className="text-white/30 text-sm mt-1">Shows are matched by artist, venue, and date.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sharedShows.map(show => (
                <div key={show.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="font-medium mb-1" style={{ color: '#f59e0b' }}>{show.artist}</div>
                  <div className="flex items-center gap-3 text-sm text-white/50">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(show.date)}</span>
                    {show.venue && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{show.venue}{show.city ? `, ${show.city}` : ''}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FriendsView({
  user, friends, pendingFriendRequests, sentFriendRequests, pendingShowTags,
  onSendFriendRequestByEmail, onSendFriendRequest, onAcceptFriendRequest,
  onDeclineFriendRequest, onRemoveFriend, onAcceptShowTag, onDeclineShowTag,
  initialTab, getShowsTogether, showSuggestions, respondToSuggestion, openMemories,
  pendingInvites, inviteStats, onResendInvite, onCancelInvite,
  onBulkAcceptAll, onBulkAcceptFromFriend
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'friends');
  const [searchEmail, setSearchEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [showingTogetherWith, setShowingTogetherWith] = useState(null); // null | { uid, name }
  const [resendingIds, setResendingIds] = useState(new Set()); // invite IDs currently being resent
  const [bulkConfirm, setBulkConfirm] = useState(null); // null | { type: 'all' } | { type: 'friend', friendUid, friendName }
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const inviteList = pendingInvites || [];

  const isExpired = (invite) => {
    const lastSent = invite.lastSentAt?.toMillis?.() ?? invite.createdAt?.toMillis?.() ?? 0;
    return Date.now() - lastSent > 30 * 24 * 60 * 60 * 1000;
  };

  const timeAgo = (ts) => {
    if (!ts) return '';
    const ms = Date.now() - (ts.toMillis?.() ?? ts);
    const d = Math.floor(ms / 86400000);
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return `${d} days ago`;
    if (d < 30) return `${Math.floor(d / 7)} week${Math.floor(d / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(d / 30)} month${Math.floor(d / 30) > 1 ? 's' : ''} ago`;
  };

  const handleResend = async (invite) => {
    setResendingIds(prev => new Set(prev).add(invite.id));
    await onResendInvite(invite);
    setResendingIds(prev => { const s = new Set(prev); s.delete(invite.id); return s; });
  };

  // Navigate to initialTab when it changes (e.g., from notification banner)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const handleSendRequest = async () => {
    if (!searchEmail.trim()) return;
    setSending(true);
    await onSendFriendRequestByEmail(searchEmail);
    setSending(false);
    setSearchEmail('');
  };

  const pendingSuggestions = (showSuggestions || []).filter(
    s => s.responses?.[user?.uid] === 'pending' && s.overallStatus !== 'declined'
  );
  const partialSuggestions = (showSuggestions || []).filter(
    s => s.responses?.[user?.uid] === 'confirmed' && s.overallStatus === 'partially_confirmed'
  );

  // Group pending items by friend for bulk accept
  const friendGroups = useMemo(() => {
    const groups = {};
    pendingShowTags.forEach(tag => {
      const uid = tag.fromUid;
      if (!groups[uid]) groups[uid] = { name: tag.fromName, tags: [], suggestions: [] };
      groups[uid].tags.push(tag);
    });
    pendingSuggestions.forEach(s => {
      const otherUid = s.participants?.find(p => p !== user?.uid);
      if (otherUid) {
        if (!groups[otherUid]) groups[otherUid] = { name: s.names?.[otherUid] || 'A friend', tags: [], suggestions: [] };
        groups[otherUid].suggestions.push(s);
      }
    });
    return groups;
  }, [pendingShowTags, pendingSuggestions, user?.uid]);

  const totalPendingItems = pendingShowTags.length + pendingSuggestions.length;
  const friendGroupKeys = Object.keys(friendGroups);

  const handleBulkConfirm = async () => {
    setBulkProcessing(true);
    try {
      if (bulkConfirm.type === 'all') {
        await onBulkAcceptAll(pendingShowTags, pendingSuggestions);
      } else {
        await onBulkAcceptFromFriend(bulkConfirm.friendUid, pendingShowTags, pendingSuggestions);
      }
    } finally {
      setBulkProcessing(false);
      setBulkConfirm(null);
    }
  };

  const requestCount = pendingFriendRequests.length + pendingShowTags.length + pendingSuggestions.length;

  if (showingTogetherWith) {
    return (
      <ShowsTogetherView
        friend={showingTogetherWith}
        getShowsTogether={getShowsTogether}
        onBack={() => setShowingTogetherWith(null)}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Friends</h1>
      <p className="text-white/60 mb-6">Connect with friends and tag them at shows</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: 'friends', label: `My Friends (${friends.length})`, badge: 0 },
          { id: 'requests', label: 'Requests', badge: requestCount },
          { id: 'find', label: 'Find Friends', badge: 0 },
          { id: 'invites', label: 'Invites', badge: inviteList.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* My Friends Tab */}
      {activeTab === 'friends' && (
        <div className="space-y-3">
          {friends.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40 mb-2">No friends yet</p>
              <p className="text-white/30 text-sm">Search by email or add from the Community leaderboard!</p>
            </div>
          ) : (
            friends.map(friend => (
              <div key={friend.friendUid} className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-white">{friend.friendName || 'Anonymous'}</div>
                    <div className="text-sm text-white/40">{friend.friendEmail}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getShowsTogether && (
                    <Tip text="Shows together">
                      <button
                        onClick={() => setShowingTogetherWith({ uid: friend.friendUid, name: friend.friendName || 'Friend' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-medium transition-colors"
                      >
                        <Music className="w-3.5 h-3.5" />
                        Shows Together
                      </button>
                    </Tip>
                  )}
                  <Tip text="Remove friend">
                    <button
                      onClick={() => onRemoveFriend(friend.friendUid)}
                      className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </Tip>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Bulk Accept Bar */}
          {totalPendingItems > 0 && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/60">
                  {totalPendingItems} pending show{totalPendingItems !== 1 ? 's' : ''} to review
                </span>
                <button
                  onClick={() => setBulkConfirm({ type: 'all' })}
                  className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                >
                  <Check className="w-4 h-4 inline mr-1" />
                  Accept All ({totalPendingItems})
                </button>
              </div>
              {friendGroupKeys.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {friendGroupKeys.map(uid => {
                    const g = friendGroups[uid];
                    const count = g.tags.length + g.suggestions.length;
                    return (
                      <button
                        key={uid}
                        onClick={() => setBulkConfirm({ type: 'friend', friendUid: uid, friendName: g.name })}
                        className="px-3 py-1.5 bg-white/5 text-white/70 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors border border-white/10"
                      >
                        {g.name} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Incoming Friend Requests */}
          {pendingFriendRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Friend Requests</h3>
              <div className="space-y-3">
                {pendingFriendRequests.map(req => (
                  <div key={req.id} className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                        <UserPlus className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{req.fromName || 'Someone'}</div>
                        <div className="text-sm text-white/40">{req.fromEmail}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onAcceptFriendRequest(req.id)}
                        className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                      >
                        <UserCheck className="w-4 h-4 inline mr-1" />
                        Accept
                      </button>
                      <button
                        onClick={() => onDeclineFriendRequest(req.id)}
                        className="px-3 py-1.5 bg-white/5 text-white/50 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Show Tags */}
          {pendingShowTags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Show Tags</h3>
              <div className="space-y-3">
                {pendingShowTags.map(tag => (
                  <div key={tag.id} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-4 h-4 text-emerald-400" />
                      <span className="text-white/80 text-sm">
                        <span className="font-medium text-white">{tag.fromName}</span> tagged you at a show
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 mb-3">
                      <div className="font-medium" style={{ color: '#f59e0b' }}>{tag.showData?.artist}</div>
                      <div className="flex items-center gap-2 text-sm text-white/60 mt-1">
                        <Calendar className="w-3.5 h-3.5 text-white/40" />
                        <span>{formatDate(tag.showData?.date)}</span>
                        <span className="text-white/20">&middot;</span>
                        <MapPin className="w-3.5 h-3.5 text-white/40" />
                        <span>{tag.showData?.venue}{tag.showData?.city ? `, ${tag.showData.city}` : ''}</span>
                      </div>
                      {tag.showData?.setlist?.length > 0 && (
                        <div className="text-xs text-white/40 mt-2">
                          <Music className="w-3 h-3 inline mr-1" />
                          {tag.showData.setlist.length} songs in setlist
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onAcceptShowTag(tag.id)}
                        className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                      >
                        <Check className="w-4 h-4 inline mr-1" />
                        Add to My Shows
                      </button>
                      <button
                        onClick={() => onDeclineShowTag(tag.id)}
                        className="px-3 py-1.5 bg-white/5 text-white/50 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show Suggestions */}
          {pendingSuggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Were You There Together?</h3>
              <div className="space-y-3">
                {pendingSuggestions.map(s => {
                  const otherUid = s.participants?.find(p => p !== user?.uid);
                  const otherName = otherUid ? s.names?.[otherUid] : 'A friend';
                  return (
                    <div key={s.id} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-teal-400" />
                        <span className="text-white/80 text-sm">
                          <span className="font-medium text-white">{otherName}</span> may have been at this show with you
                        </span>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 mb-3">
                        <div className="font-medium" style={{ color: '#f59e0b' }}>{s.showData?.artist}</div>
                        <div className="flex items-center gap-2 text-sm text-white/60 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-white/40" />
                          <span>{formatDate(s.showData?.date)}</span>
                          {s.showData?.venue && (
                            <>
                              <span className="text-white/20">&middot;</span>
                              <MapPin className="w-3.5 h-3.5 text-white/40" />
                              <span>{s.showData.venue}{s.showData?.city ? `, ${s.showData.city}` : ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => respondToSuggestion && respondToSuggestion(s, 'confirmed')}
                          className="px-3 py-1.5 bg-teal-500/20 text-teal-400 rounded-lg text-sm font-medium hover:bg-teal-500/30 transition-colors"
                        >
                          <Check className="w-4 h-4 inline mr-1" />
                          Yes, I was there!
                        </button>
                        <button
                          onClick={() => respondToSuggestion && respondToSuggestion(s, 'declined')}
                          className="px-3 py-1.5 bg-white/5 text-white/50 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Waiting for friend to confirm */}
          {partialSuggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Waiting for Confirmation</h3>
              <div className="space-y-3">
                {partialSuggestions.map(s => {
                  const otherUid = s.participants?.find(p => p !== user?.uid);
                  const otherName = otherUid ? s.names?.[otherUid] : 'Your friend';
                  return (
                    <div key={s.id} className="bg-white/5 rounded-2xl p-4 border border-amber-500/10">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span className="text-white/70 text-sm">
                          Waiting for <span className="font-medium text-white">{otherName}</span> to confirm
                        </span>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="font-medium" style={{ color: '#f59e0b' }}>{s.showData?.artist}</div>
                        <div className="flex items-center gap-2 text-sm text-white/60 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-white/40" />
                          <span>{formatDate(s.showData?.date)}</span>
                          {s.showData?.venue && (
                            <>
                              <span className="text-white/20">&middot;</span>
                              <MapPin className="w-3.5 h-3.5 text-white/40" />
                              <span>{s.showData.venue}{s.showData?.city ? `, ${s.showData.city}` : ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sent Requests */}
          {sentFriendRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Sent Requests</h3>
              <div className="space-y-3">
                {sentFriendRequests.map(req => (
                  <div key={req.id} className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                        <Send className="w-4 h-4 text-white/40" />
                      </div>
                      <div>
                        <div className="font-medium text-white/60">{req.toName || req.toEmail || 'Unknown'}</div>
                        <div className="text-sm text-white/30">Pending</div>
                      </div>
                    </div>
                    <span className="text-xs text-amber-400/60 bg-amber-500/10 px-2 py-1 rounded-full">Awaiting response</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingFriendRequests.length === 0 && pendingShowTags.length === 0 && sentFriendRequests.length === 0 && pendingSuggestions.length === 0 && partialSuggestions.length === 0 && (
            <div className="text-center py-12 text-white/40">
              <Check className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p>No pending requests or tags</p>
            </div>
          )}
        </div>
      )}

      {/* Find Friends Tab */}
      {activeTab === 'find' && (
        <div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Search by email</h3>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="Enter your friend's email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
                  className="w-full pl-11 pr-4 py-2.5 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
                />
              </div>
              <button
                onClick={handleSendRequest}
                disabled={sending || !searchEmail.trim()}
                className={`px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                  sending || !searchEmail.trim()
                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25'
                }`}
              >
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
            <p className="text-white/30 text-sm mt-3">
              You can also add friends from the <span className="text-emerald-400">Community</span> leaderboard
            </p>
          </div>
        </div>
      )}

      {/* Invites Tab */}
      {activeTab === 'invites' && (
        <div className="space-y-4">
          {/* Summary stat */}
          {inviteStats && (
            <div className="flex items-center gap-2 text-sm text-white/50 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
              <Mail className="w-4 h-4 text-white/30 flex-shrink-0" />
              <span>
                You've invited <span className="text-white/80 font-medium">{inviteStats.total}</span> {inviteStats.total === 1 ? 'person' : 'people'} —{' '}
                <span className="text-emerald-400 font-medium">{inviteStats.accepted}</span> {inviteStats.accepted === 1 ? 'has' : 'have'} joined
              </span>
            </div>
          )}

          {inviteList.length === 0 ? (
            <div className="text-center py-12">
              <Send className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40 mb-1">No pending invites</p>
              <p className="text-white/30 text-sm">Invite your friends from the <span className="text-emerald-400">Invite</span> page!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inviteList
                .slice()
                .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
                .map(invite => {
                  const expired = isExpired(invite);
                  const isResending = resendingIds.has(invite.id);
                  const sentTs = invite.lastSentAt || invite.createdAt;
                  const originalTs = invite.createdAt;
                  const wasResent = !!invite.lastSentAt;
                  return (
                    <div
                      key={invite.id}
                      className={`bg-white/5 rounded-2xl p-4 border transition-all ${
                        expired ? 'border-white/5 opacity-60' : 'border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{invite.inviteeEmail}</div>
                          <div className="text-xs text-white/40 mt-0.5">
                            {wasResent ? (
                              <>Last resent {timeAgo(sentTs)} &middot; Originally sent {timeAgo(originalTs)}</>
                            ) : (
                              <>Sent {timeAgo(originalTs)}</>
                            )}
                          </div>
                        </div>
                        <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          expired
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {expired ? 'Expired' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResend(invite)}
                          disabled={isResending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {isResending
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <Send className="w-3.5 h-3.5" />
                          }
                          {isResending ? 'Sending…' : 'Resend Invite'}
                        </button>
                        <button
                          onClick={() => onCancelInvite && onCancelInvite(invite.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 border border-white/10 hover:border-red-500/20 rounded-lg text-xs font-medium transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
      {/* Bulk Accept Confirmation Modal */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !bulkProcessing && setBulkConfirm(null)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Accept Shows</h3>
            <p className="text-white/60 text-sm mb-6">
              {bulkConfirm.type === 'all'
                ? `Accept all ${totalPendingItems} pending show${totalPendingItems !== 1 ? 's' : ''}? They'll be added to your collection.`
                : `Accept all ${(friendGroups[bulkConfirm.friendUid]?.tags.length || 0) + (friendGroups[bulkConfirm.friendUid]?.suggestions.length || 0)} pending show${((friendGroups[bulkConfirm.friendUid]?.tags.length || 0) + (friendGroups[bulkConfirm.friendUid]?.suggestions.length || 0)) !== 1 ? 's' : ''} from ${bulkConfirm.friendName}?`
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkConfirm(null)}
                disabled={bulkProcessing}
                className="px-4 py-2 bg-white/5 text-white/60 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkConfirm}
                disabled={bulkProcessing}
                className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
              >
                {bulkProcessing ? 'Accepting…' : 'Accept All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Venue Rating Modal Component
function VenueRatingModal({ show, currentUser, onClose, onSaved }) {
  const SUB_LABELS = [
    { key: 'soundQuality', label: 'Sound Quality' },
    { key: 'sightlines', label: 'Sightlines' },
    { key: 'atmosphere', label: 'Atmosphere' },
    { key: 'accessibility', label: 'Accessibility' },
    { key: 'foodDrinks', label: 'Food & Drinks' },
  ];

  const [overallRating, setOverallRating] = useState(0);
  const [subRatings, setSubRatings] = useState({ soundQuality: 0, sightlines: 0, atmosphere: 0, accessibility: 0, foodDrinks: 0 });
  const [review, setReview] = useState('');
  const [existingId, setExistingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const venueKey = `${(show.venue || '').trim().toLowerCase()}::${(show.city || '').trim().toLowerCase()}`;

  useEffect(() => {
    async function loadExisting() {
      if (!currentUser) { setLoading(false); return; }
      try {
        const snap = await getDocs(query(
          collection(db, 'venueRatings'),
          where('venueKey', '==', venueKey),
          where('userId', '==', currentUser.uid)
        ));
        if (!snap.empty) {
          const d = snap.docs[0].data();
          setExistingId(snap.docs[0].id);
          setOverallRating(d.overallRating || 0);
          setSubRatings({ soundQuality: 0, sightlines: 0, atmosphere: 0, accessibility: 0, foodDrinks: 0, ...d.subRatings });
          setReview(d.review || '');
        }
      } catch (e) {
        console.error('Failed to load venue rating:', e);
      }
      setLoading(false);
    }
    loadExisting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!overallRating) return;
    setSaving(true);
    try {
      const docId = existingId || `${currentUser.uid}_${venueKey.replace(/[^a-z0-9]/g, '_').slice(0, 60)}`;
      await setDoc(doc(db, 'venueRatings', docId), {
        venueName: (show.venue || '').trim().toLowerCase(),
        venueCity: (show.city || '').trim().toLowerCase(),
        venueKey,
        venueDisplayName: show.venue || '',
        venueCityDisplay: show.city || '',
        userId: currentUser.uid,
        userDisplayName: currentUser.displayName || 'Anonymous',
        overallRating,
        subRatings,
        review: review.trim() || null,
        updatedAt: serverTimestamp(),
        ...(existingId ? {} : { createdAt: serverTimestamp() }),
      }, { merge: true });
      if (onSaved) onSaved(); else onClose();
    } catch (e) {
      console.error('Failed to save venue rating:', e);
      alert('Failed to save rating. Please try again.');
    }
    setSaving(false);
  };

  const StarPicker = ({ value, onChange, size = 'w-7 h-7' }) => (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          className={`${size} transition-colors ${n <= value ? 'text-amber-400' : 'text-white/20 hover:text-amber-400/50'}`}
        >
          <Star className="w-full h-full" fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 md:left-64 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{existingId ? 'Edit Your Rating' : 'Rate This Venue'}</h2>
            <p className="text-white/50 text-sm mt-0.5">{show.venue}{show.city ? `, ${show.city}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-3 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <RefreshCw className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Overall rating */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Overall Rating <span className="text-rose-400">*</span></label>
              <StarPicker value={overallRating} onChange={setOverallRating} size="w-9 h-9" />
            </div>
            {/* Sub-ratings */}
            <div className="space-y-3">
              <p className="text-sm text-white/50">Optional sub-ratings</p>
              {SUB_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-white/70 w-32">{label}</span>
                  <StarPicker value={subRatings[key] || 0} onChange={v => setSubRatings(p => ({ ...p, [key]: v }))} />
                </div>
              ))}
            </div>
            {/* Review */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Review <span className="text-white/30">(optional)</span></label>
              <textarea
                value={review}
                onChange={e => setReview(e.target.value.slice(0, 500))}
                placeholder="What did you think of the venue?"
                rows={3}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-white text-sm placeholder-white/40 resize-none"
              />
              <p className="text-xs text-white/30 mt-1 text-right">{review.length}/500</p>
            </div>
          </div>
        )}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!overallRating || saving}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : existingId ? 'Update Rating' : 'Save Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Tag Friends Modal Component
function TagFriendsModal({ show, friends, onTag, onInviteByEmail, onClose }) {
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  // invite sub-form state
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteStatus, setInviteStatus] = useState(null); // null | 'success' | 'error'

  const normalizedQuery = query.trim().toLowerCase();
  const filteredFriends = normalizedQuery
    ? friends.filter(f =>
        (f.friendName || '').toLowerCase().includes(normalizedQuery) ||
        (f.friendEmail || '').toLowerCase().includes(normalizedQuery)
      )
    : friends;

  const showInvitePrompt = normalizedQuery.length > 0 && filteredFriends.length === 0;

  const toggleFriend = (uid) => {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleTag = async () => {
    setSending(true);
    await onTag([...selectedFriends]);
    setSending(false);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteSending(true);
    setInviteStatus(null);
    try {
      await onInviteByEmail({ name: query.trim(), email: inviteEmail.trim(), message: inviteMessage.trim(), show });
      setInviteStatus('success');
      setInviteEmail('');
      setInviteMessage('');
    } catch {
      setInviteStatus('error');
    } finally {
      setInviteSending(false);
    }
  };

  return (
    <div className="fixed inset-0 md:left-64 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Tag Friends</h2>
            <button onClick={onClose} className="p-3 text-white/40 hover:text-white hover:bg-white/10 active:bg-white/20 rounded-xl transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <div className="font-medium" style={{ color: '#f59e0b' }}>{show.artist}</div>
            <div className="flex items-center gap-2 text-sm text-white/60 mt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(show.date)}</span>
              <span className="text-white/20">&middot;</span>
              <MapPin className="w-3.5 h-3.5" />
              <span>{show.venue}</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search input */}
          {!inviteMode && (
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search friends by name or email…"
                className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white text-sm placeholder-white/40"
              />
            </div>
          )}

          {/* Invite sub-form */}
          {inviteMode && (
            <div>
              <button
                onClick={() => { setInviteMode(false); setInviteStatus(null); }}
                className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-4 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back to friend list
              </button>
              <p className="text-white/70 text-sm mb-3">
                Send <span className="text-white font-medium">{query.trim()}</span> an invite to join mysetlists.net, with this show included.
              </p>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="friend@example.com"
                className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white text-sm placeholder-white/40 mb-3"
              />
              <textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Add a personal note… (optional)"
                rows={3}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white text-sm placeholder-white/40 resize-none mb-3"
              />
              {inviteStatus === 'success' && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-3">
                  <Check className="w-4 h-4" /> Invite sent! They'll get an email with the show details.
                </div>
              )}
              {inviteStatus === 'error' && (
                <div className="text-rose-400 text-sm mb-3">Something went wrong. Please try again.</div>
              )}
              <button
                onClick={handleSendInvite}
                disabled={!inviteEmail.trim() || inviteSending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {inviteSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {inviteSending ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          )}

          {/* Selected friend chips */}
          {!inviteMode && selectedFriends.size > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {[...selectedFriends].map(uid => {
                const f = friends.find(fr => fr.friendUid === uid);
                return f ? (
                  <span key={uid} className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-medium">
                    {f.friendName || 'Friend'}
                    <button onClick={() => toggleFriend(uid)} className="text-emerald-400/60 hover:text-emerald-300">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}

          {/* Friend list / invite prompt */}
          {!inviteMode && (
            <>
              {friends.length === 0 && !normalizedQuery ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">Add friends first from the Friends page!</p>
                </div>
              ) : showInvitePrompt ? (
                <div className="text-center py-6">
                  <p className="text-white/60 text-sm mb-3">
                    <span className="text-white font-medium">{query.trim()}</span> isn't on mysetlists.net yet.
                  </p>
                  <button
                    onClick={() => { setInviteMode(true); setInviteStatus(null); }}
                    className="flex items-center gap-2 mx-auto px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl font-medium text-sm transition-colors"
                  >
                    <Send className="w-4 h-4" /> Invite {query.trim()}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-white/50 mb-3">Select friends who were at this show:</p>
                  {filteredFriends.map(friend => (
                    <label
                      key={friend.friendUid}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        selectedFriends.has(friend.friendUid)
                          ? 'bg-emerald-500/15 border border-emerald-500/30'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFriends.has(friend.friendUid)}
                        onChange={() => toggleFriend(friend.friendUid)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                        selectedFriends.has(friend.friendUid)
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-white/20'
                      }`}>
                        {selectedFriends.has(friend.friendUid) && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">{friend.friendName || 'Anonymous'}</div>
                        <div className="text-xs text-white/40">{friend.friendEmail}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — tag button (only shown in list mode with selections) */}
        {!inviteMode && selectedFriends.size > 0 && (
          <div className="p-6 border-t border-white/10 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleTag}
              disabled={sending}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
            >
              {sending ? 'Tagging...' : `Tag ${selectedFriends.size} Friend${selectedFriends.size !== 1 ? 's' : ''} at This Show →`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Invite View Component
function InviteView({ currentUserUid, currentUser, onSendInvite }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null); // null | 'success' | 'error' | string (error message)
  const [copyLabel, setCopyLabel] = useState('Copy');

  const inviteUrl = currentUserUid ? `https://mysetlists.net?ref=${currentUserUid}` : 'https://mysetlists.net';

  const handleInvite = async () => {
    if (!email.trim() || !currentUserUid || !onSendInvite) return;
    setSending(true);
    setSendStatus(null);
    const result = await onSendInvite(email.trim());
    setSending(false);
    if (result?.success) {
      setSendStatus('success');
      setEmail('');
    } else {
      setSendStatus(result?.error || 'error');
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Invite Friends</h1>
      <p className="text-white/60 mb-8">Share mysetlists.net with your concert-going friends.</p>

      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <label className="block text-sm font-medium text-white/70 mb-2">
          Friend's Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSendStatus(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
          placeholder="friend@example.com"
          className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40 mb-4"
        />
        <button
          onClick={handleInvite}
          disabled={!email.trim() || sending}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
        >
          {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'Sending…' : 'Send Invitation'}
        </button>

        {sendStatus === 'success' && (
          <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <Check className="w-4 h-4" />
            Invite sent! They'll get an email from mysetlists.net.
          </div>
        )}
        {sendStatus && sendStatus !== 'success' && (
          <div className="mt-3 text-rose-400 text-sm">
            {sendStatus === 'error'
              ? 'Something went wrong. Try copying the link below instead.'
              : sendStatus}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-medium text-white/70 mb-2">Or share this link:</h3>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white/60"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              setCopyLabel('Copied!');
              setTimeout(() => setCopyLabel('Copy'), 2000);
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-sm font-medium transition-colors"
          >
            {copyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== ROADMAP SHARED CONSTANTS & SUB-COMPONENTS ==========

// Roadmap feature categories — used in FeedbackView, RoadmapView, PublicRoadmapPage, and AdminView
const ROADMAP_CATEGORIES = {
  ui: 'UI/Design',
  social: 'Social',
  data: 'Data & Stats',
  search: 'Search',
  other: 'Other',
};

// Roadmap column definitions — order and display for the three public columns
const ROADMAP_COLUMNS = [
  { key: 'upnext',     label: 'Up Next',     emoji: '🔜', headerColor: 'text-violet-400',  border: 'border-violet-500/30'  },
  { key: 'inprogress', label: 'In Progress',  emoji: '🛠️', headerColor: 'text-amber-400',   border: 'border-amber-500/30'   },
  { key: 'shipped',    label: 'Shipped',      emoji: '✅', headerColor: 'text-emerald-400', border: 'border-emerald-500/30' },
];

// timeAgo — relative date string from a Firestore Timestamp or Date
function timeAgo(ts) {
  if (!ts) return '';
  const ms = Date.now() - (ts.toMillis ? ts.toMillis() : (ts instanceof Date ? ts.getTime() : Number(ts)));
  const d = Math.floor(ms / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// RoadmapCard — shared between RoadmapView (in-app) and PublicRoadmapPage
function RoadmapCard({ item, hasVoted, isTopThree, onVote, voting, isLoggedIn }) {
  return (
    <div className={`bg-white/5 backdrop-blur-xl rounded-2xl border ${isTopThree ? 'border-amber-500/40' : 'border-white/10'} p-4 relative transition-all hover:bg-white/[0.07]`}>
      {isTopThree && (
        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30 whitespace-nowrap">
          Most Requested
        </span>
      )}
      <div className={isTopThree ? 'pr-28' : ''}>
        <p className="font-semibold text-white text-sm leading-snug mb-1">{item.title}</p>
        {item.description && item.description !== item.title && (
          <p className="text-white/50 text-xs leading-relaxed mb-2 line-clamp-3">{item.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {item.category && ROADMAP_CATEGORIES[item.category] && (
            <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white/40 rounded-full">
              {ROADMAP_CATEGORIES[item.category]}
            </span>
          )}
          {(item.publishedAt || item.createdAt) && (
            <span className="text-[10px] text-white/30">
              {item.status === 'shipped' ? 'Shipped ' : 'Added '}{timeAgo(item.publishedAt || item.createdAt)}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3">
        <Tip text={hasVoted ? 'Remove your vote' : (isLoggedIn ? 'Vote for this feature' : 'Sign in to vote')}>
          <button
            onClick={() => onVote(item)}
            disabled={voting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
              hasVoted
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-white/10 text-white/60 hover:bg-white/20 border border-white/10 hover:border-white/20'
            }`}
          >
            {voting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ChevronUp className={`w-4 h-4 ${hasVoted ? 'text-emerald-400' : ''}`} />
            )}
            <span>{item.voteCount || 0}</span>
          </button>
        </Tip>
      </div>
    </div>
  );
}

// RoadmapView — in-app roadmap view rendered inside the ShowTracker shell
function RoadmapView({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState({});     // { [itemId]: boolean }
  const [votingItemId, setVotingItemId] = useState(null);
  const [signInPrompt, setSignInPrompt] = useState(false);

  // Real-time listener for published roadmap items
  useEffect(() => {
    const q = query(
      collection(db, 'roadmapItems'),
      where('status', 'in', ['upnext', 'inprogress', 'shipped'])
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.log('Roadmap listener error:', err.message);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load which items the current user has voted on
  useEffect(() => {
    if (!user || items.length === 0) {
      setUserVotes({});
      return;
    }
    Promise.all(
      items.map(item =>
        getDoc(doc(db, 'roadmapItems', item.id, 'voters', user.uid))
          .then(d => [item.id, d.exists()])
      )
    ).then(results => setUserVotes(Object.fromEntries(results)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, items.length]);

  // Top 3 most-voted item IDs (across all columns)
  const topThreeIds = new Set(
    [...items]
      .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
      .slice(0, 3)
      .map(i => i.id)
  );

  // Toggle vote — uses runTransaction for atomic increment/decrement
  const handleVote = async (item) => {
    if (!user) { setSignInPrompt(true); return; }
    if (votingItemId) return;
    setVotingItemId(item.id);
    const itemRef = doc(db, 'roadmapItems', item.id);
    const voterRef = doc(db, 'roadmapItems', item.id, 'voters', user.uid);
    const hasVoted = !!userVotes[item.id];
    try {
      await runTransaction(db, async (tx) => {
        const voterSnap = await tx.get(voterRef);
        if (!hasVoted && !voterSnap.exists()) {
          tx.set(voterRef, { votedAt: serverTimestamp() });
          tx.update(itemRef, { voteCount: increment(1), updatedAt: serverTimestamp() });
        } else if (hasVoted && voterSnap.exists()) {
          tx.delete(voterRef);
          tx.update(itemRef, { voteCount: increment(-1), updatedAt: serverTimestamp() });
        }
      });
      setUserVotes(prev => ({ ...prev, [item.id]: !hasVoted }));
    } catch (err) {
      console.error('Vote error:', err);
    } finally {
      setVotingItemId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-white mb-2">What's Coming to MySetlists</h1>
        <p className="text-white/60">Vote on features you want most — the more votes, the higher it goes.</p>
      </div>

      {/* Sign-in prompt banner (for guests who click vote) */}
      {signInPrompt && (
        <div className="mb-6 flex items-center justify-between gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <p className="text-amber-400 text-sm">Sign in to vote on features you want!</p>
          <button onClick={() => setSignInPrompt(false)} className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-white/40">Loading roadmap...</div>
      ) : (
        <div className="flex flex-col gap-6 md:grid md:grid-cols-3 md:gap-6">
          {ROADMAP_COLUMNS.map(col => {
            const colItems = items
              .filter(i => i.status === col.key)
              .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
            return (
              <div key={col.key}>
                {/* Column header */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">{col.emoji}</span>
                  <h2 className={`font-bold text-base ${col.headerColor}`}>{col.label}</h2>
                  <span className="text-white/30 text-xs ml-auto">{colItems.length}</span>
                </div>
                {/* Cards */}
                <div className="space-y-3">
                  {colItems.map(item => (
                    <RoadmapCard
                      key={item.id}
                      item={item}
                      hasVoted={!!userVotes[item.id]}
                      isTopThree={topThreeIds.has(item.id)}
                      onVote={handleVote}
                      voting={votingItemId === item.id}
                      isLoggedIn={!!user}
                    />
                  ))}
                  {colItems.length === 0 && (
                    <p className="text-white/25 text-sm py-4">Nothing here yet</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========== FEEDBACK VIEW COMPONENT ==========
// Overhauled: type selector, category pills, Firestore storage, auto-draft roadmap items for feature requests
function FeedbackView({ user, onNavigate, unreadNotifications, onMarkRead }) {
  const [feedbackType, setFeedbackType] = useState('general'); // 'feature' | 'bug' | 'general'
  const [category, setCategory] = useState('other');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Mark notifications read on mount (clears roadmap_published banner from badge)
  useEffect(() => {
    if (onMarkRead) onMarkRead();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roadmapNotifications = (unreadNotifications || []).filter(n => n.type === 'roadmap_published');

  const handleSubmit = async () => {
    if (!message.trim() || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Write to feedback collection
      const feedbackData = {
        type: feedbackType,
        category: feedbackType === 'feature' ? category : null,
        message: message.trim(),
        submitterUid: user.uid,
        submitterEmail: user.email || '',
        submitterName: (user.displayName || '').split(' ')[0] || 'Anonymous',
        status: feedbackType === 'feature' ? 'linked' : 'new',
        roadmapItemId: null,
        createdAt: serverTimestamp(),
      };
      const feedbackRef = await addDoc(collection(db, 'feedback'), feedbackData);

      // If it's a feature request, auto-create a draft roadmap item
      if (feedbackType === 'feature') {
        const itemRef = await addDoc(collection(db, 'roadmapItems'), {
          title: message.trim().slice(0, 100),
          description: message.trim(),
          status: 'draft',
          category,
          voteCount: 0,
          sourceFeedbackId: feedbackRef.id,
          submitterUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          publishedAt: null,
        });
        await updateDoc(feedbackRef, { roadmapItemId: itemRef.id });
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError('Failed to submit. Please try again.');
      console.error('Feedback submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const FEEDBACK_TYPES = [
    { id: 'feature', label: 'Feature Request' },
    { id: 'bug',     label: 'Bug Report'      },
    { id: 'general', label: 'General Feedback' },
  ];

  const CATEGORIES = [
    { id: 'ui',     label: 'UI/Design'   },
    { id: 'social', label: 'Social'      },
    { id: 'data',   label: 'Data & Stats' },
    { id: 'search', label: 'Search'      },
    { id: 'other',  label: 'Other'       },
  ];

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Thanks for your feedback!</h2>
          <p className="text-white/60 mb-6">
            {feedbackType === 'feature'
              ? "Your idea has been added to the feedback queue. Check the roadmap to see what's coming!"
              : "We read everything and use it to make MySetlists better."}
          </p>
          {feedbackType === 'feature' && (
            <button
              onClick={() => onNavigate && onNavigate('roadmap')}
              className="flex items-center gap-2 mx-auto mb-4 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-violet-500/25"
            >
              <TrendingUp className="w-4 h-4" />
              View Roadmap
            </button>
          )}
          <button
            onClick={() => { setSubmitted(false); setMessage(''); setFeedbackType('general'); setCategory('other'); }}
            className="text-white/40 hover:text-white/60 text-sm transition-colors"
          >
            Send more feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Roadmap notification banner */}
      {roadmapNotifications.length > 0 && (
        <div className="mb-6 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
          <p className="text-emerald-400 text-sm font-medium mb-1">
            Your feature idea is on the roadmap!
          </p>
          <p className="text-white/60 text-xs mb-2">
            "{roadmapNotifications[0].itemTitle}" — check it out and see how the community votes on it.
          </p>
          <button
            onClick={() => onNavigate && onNavigate('roadmap')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            View Roadmap →
          </button>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <h1 className="text-xl md:text-2xl font-bold text-white">Send Feedback</h1>
        <button
          onClick={() => onNavigate && onNavigate('roadmap')}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors mt-1"
        >
          <TrendingUp className="w-3 h-3" />
          View Roadmap
        </button>
      </div>
      <p className="text-white/60 mb-8">We'd love to hear your thoughts, suggestions, or bug reports.</p>

      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 space-y-5">

        {/* Feedback type selector */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setFeedbackType(t.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                  feedbackType === t.id
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category selector — only for feature requests */}
        {feedbackType === 'feature' && (
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                    category === c.id
                      ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                      : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message textarea */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            {feedbackType === 'feature' ? 'Describe your idea' : feedbackType === 'bug' ? 'What went wrong?' : 'Your Feedback'}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              feedbackType === 'feature' ? "What feature would make MySetlists better for you?" :
              feedbackType === 'bug' ? "What happened? What were you trying to do?" :
              "Tell us what you think..."
            }
            rows={6}
            className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40 resize-none"
          />
        </div>

        {submitError && (
          <p className="text-red-400 text-sm">{submitError}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!message.trim() || submitting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
        >
          {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? 'Sending...' : 'Send Feedback'}
        </button>
      </div>
    </div>
  );
}

// Release Notes View Component
function ReleaseNotesView() {
  const releases = [
    {
      version: '1.0.28',
      date: 'March 10, 2026',
      title: 'Bulk Accept, Unified Scan/Import, Sidebar Refresh',
      changes: [
        'New: Bulk accept pending show tags and suggestions — accept all at once or per friend',
        'New: Scan Tickets and Import File merged into a single "Scan / Import" tabbed view',
        'Sidebar: Search pinned at top, Invite & Feedback pinned at bottom, everything else scrolls',
        'Sidebar reordered for better flow — Friends and Community moved up, Upcoming Shows follows Stats',
        'Simplified onboarding: single tooltip for the unified Scan / Import button',
      ]
    },
    {
      version: '1.0.27',
      date: 'March 9, 2026',
      title: 'Mobile-Friendly Tooltips',
      changes: [
        'Fixed: Onboarding tooltips no longer get cut off on iPhone and small screens',
        'Mobile: onboarding tooltips now appear below buttons instead of to the left, staying fully visible',
        'All button tooltips (Rate Venue, Tag Friends, Share, etc.) now work on touch devices via tap',
        'Desktop: hover tooltips continue to work as before',
        'Tooltips auto-adjust to stay within screen boundaries with proper edge padding',
      ]
    },
    {
      version: '1.0.26',
      date: 'March 9, 2026',
      title: 'Onboarding Tooltips & Ticket Scanner',
      changes: [
        'New: Onboarding tooltips guide first-time users through Import File and Scan Tickets features',
        'Tooltips appear sequentially with a gentle animation and dismiss with "Got it"',
        'New: Scan Tickets — upload photos of physical ticket stubs, wristbands, or digital tickets',
        'AI reads artist, venue, date, and city from ticket images, even old or worn stubs',
        'Automatically searches setlist.fm for matching setlists after scanning',
        'Batch scanning: upload multiple tickets at once and process them all together',
        'Emerald green favicon now matches the site logo',
      ]
    },
    {
      version: '1.0.24',
      date: 'March 4, 2026',
      title: 'Public Roadmap & Voting',
      changes: [
        "New: Public roadmap at mysetlists.net/roadmap \u2014 see what\u2019s Up Next, In Progress, and Shipped",
        'Vote on features you want most \u2014 top 3 most-voted items get a \u201cMost Requested\u201d badge',
        'Votes update in real time \u2014 no refresh needed',
        'Feature requests now save to a feedback queue and automatically create draft roadmap items',
        'Admin: new Roadmap tab for reviewing drafts, publishing items, creating items manually, and moving items between columns',
        'Get an in-app notification when your feature request makes it to the roadmap',
      ]
    },
    {
      version: '1.0.23',
      date: 'March 4, 2026',
      title: 'Pending Invites Dashboard',
      changes: [
        'New: See all pending email invites in Friends \u2192 Invites tab',
        'Resend any pending invite with one tap (limited to once per 24 hours to prevent spam)',
        'Cancel invites you no longer want to send',
        'Invites older than 30 days are marked Expired \u2014 resending resets the expiry clock',
        'Invite summary shows how many people you\u2019ve invited and how many have joined',
        'Duplicate invite guard: warns you if you try to invite someone who already has a pending invite',
        'Pending invite count now appears in the Friends badge in the sidebar',
      ]
    },
    {
      version: '1.0.22',
      date: 'March 4, 2026',
      title: 'Friend Show Suggestions, Shared Memories & SEO',
      changes: [
        'New: MySetlists now suggests when you and a friend may have been at the same show — confirm or decline from the Friends tab',
        'New: Share memories on any confirmed shared show — add, edit, and delete comments visible only to you and that friend',
        'New: Public artist pages at mysetlists.net/artist/[name] with community stats (shows tracked, fans, top songs, recent venues)',
        'New: Dynamic page titles and meta tags for better search engine visibility and sharing',
        'Improved: Notification badge now includes pending show-together suggestions',
      ]
    },
    {
      version: '1.0.21',
      date: 'March 4, 2026',
      title: 'Bug Fixes',
      changes: [
        'Fixed: Rate Venue button now opens the rating modal correctly from any page',
        'Fixed: Rate Venue modal now works when accessed from the Stats page as well as setlist view',
      ]
    },
    {
      version: '1.0.20',
      date: 'March 4, 2026',
      title: 'Venue Ratings, Social Tagging & Navigation',
      changes: [
        'Rate venues with 1–5 stars and optional sub-ratings (Sound, Sightlines, Atmosphere, Accessibility, Food & Drinks)',
        'See aggregate venue ratings and top-rated venues in your Stats page',
        'Tag multiple friends at a show in one tap with instant batch confirmation',
        'Tag friends when adding new shows, not just from existing setlists',
        'See all the shows you\'ve attended with a specific friend from their profile',
        'Browser back/forward buttons now work correctly throughout the app',
      ]
    },
    {
      version: '1.0.19',
      date: 'March 4, 2026',
      title: 'Email Invites, Show Tagging & Admin Tools',
      changes: [
        'Invite emails are now sent directly from mysetlists.net — no more opening your mail app',
        'Friends who join via your invite are automatically connected with a welcome message',
        'Tag friends at shows even if they haven\'t joined yet — they\'ll get an invite email with the show details',
        'New users who were tagged in shows see a "Shows your friends tagged you in" screen on first login',
        'Confirmed tags notify the friend who tagged you so they know you\'re officially show buddies',
        'Admin: full user deletion removes their account, shows, friend connections, and tags permanently',
      ]
    },
    {
      version: '1.0.18',
      date: 'February 20, 2026',
      title: 'Interactive Summary Stats',
      changes: [
        'Stat boxes are now ~50% smaller for a cleaner, less cluttered home screen',
        'Tap any stat box to jump directly to its detailed stats view (Songs, Artists, Venues, or Top Shows)',
        'User rank box now links to the Community page',
      ]
    },
    {
      version: '1.0.17',
      date: 'February 10, 2026',
      title: 'Notifications & Alerts',
      changes: [
        'Notification banner on the Shows page alerts you to pending friend requests and show tags',
        'Clicking the notification banner takes you directly to the Friends Requests tab',
        'Red badge on the Requests tab shows the number of pending friend requests and show tags',
      ]
    },
    {
      version: '1.0.16',
      date: 'February 9, 2026',
      title: 'Setlist Scanning & Onboarding',
      changes: [
        'Find Missing Setlists button scans your shows without setlists and fetches them from setlist.fm',
        'Improved setlist matching with artist name variations (e.g., "Dead & Company" vs "Dead and Company")',
        'Shows are refreshed when navigating back from Import to ensure imported shows appear immediately',
        'Setlist scanning preserves your existing ratings and comments',
        'New first-time user experience with import options: screenshot, CSV/Excel, and setlist.fm search',
      ]
    },
    {
      version: '1.0.15',
      date: 'February 9, 2026',
      title: 'Screenshot Import',
      changes: [
        'Upload a screenshot from Ticketmaster, AXS, or any ticket platform to import shows',
        'AI-powered image analysis identifies artists, venues, dates, and cities',
        'Detected shows are previewed for review before importing',
        'Setlists are automatically fetched from setlist.fm for screenshot-imported shows',
        'Supports PNG, JPG, and WebP image formats',
      ]
    },
    {
      version: '1.0.14',
      date: 'February 9, 2026',
      title: 'Sidebar Redesign',
      changes: [
        'Reorganized sidebar navigation for a cleaner layout',
        'Restored Invite option to the sidebar',
        'Moved Feedback and Release Notes below Community and Invite',
        'Hidden profile section from sidebar for a streamlined look',
      ]
    },
    {
      version: '1.0.13',
      date: 'February 9, 2026',
      title: 'Invite Auto-Friendship',
      changes: [
        'Users who join via an invite link are now automatically friends with the person who invited them',
        'Invite links now include a referral code so the app knows who sent the invitation',
        'No friend request needed — the friendship is created instantly when the invited user signs up',
      ]
    },
    {
      version: '1.0.12',
      date: 'February 9, 2026',
      title: 'Bug Fixes & Improvements',
      changes: [
        'Fixed community stats not updating — leaderboards now show all users correctly',
        'Fixed community song and venue aggregation failing due to Firestore permissions',
        'Removed duplicate years list on the Stats page',
      ]
    },
    {
      version: '1.0.11',
      date: 'February 9, 2026',
      title: 'Auto-Fetch Setlists on Import',
      changes: [
        'Imported shows now automatically search setlist.fm for matching setlists',
        'Setlists are matched by artist name and exact date',
        'Found setlists include full song lists with set breaks and encore markers',
        'Tour information is also pulled when available from setlist.fm',
        'Progress indicator shows setlist fetch status during import',
        'Import completion screen shows how many setlists were found',
      ]
    },
    {
      version: '1.0.10',
      date: 'February 8, 2026',
      title: 'Friends & Show Tagging',
      changes: [
        'Add friends by email or directly from the Community leaderboard',
        'Friend requests require acceptance — mutual friendship only',
        'Tag friends at shows you attended together',
        'Tagged shows require friend approval before importing to their collection',
        'Approved tags copy the full setlist (without your ratings or comments)',
        'Real-time notification badge for pending requests and show tags',
        'New Friends page with My Friends, Requests, and Find Friends tabs',
      ]
    },
    {
      version: '1.0.9',
      date: 'February 8, 2026',
      title: 'Admin User Support',
      changes: [
        'Admins can click any user to view their shows in the Admin Portal',
        'User show detail view with search, sort, and setlist inspection',
        'On-demand show loading for efficient data access',
      ]
    },
    {
      version: '1.0.8',
      date: 'February 7, 2026',
      title: 'File Import',
      changes: [
        'Import shows from CSV, Excel, or Google Sheets files',
        'Smart column detection — automatically maps your headers',
        'Preview and validate data before importing',
        'Duplicate detection warns about shows already in your collection',
        'Drag-and-drop or browse to upload files',
      ]
    },
    {
      version: '1.0.7',
      date: 'February 7, 2026',
      title: 'Artist Stats Upgrade',
      changes: [
        'Expandable artist rows in the Stats Artists tab — click to see all shows for that artist',
        'Double-click any show under an artist to open full show details',
      ]
    },
    {
      version: '1.0.6',
      date: 'February 7, 2026',
      title: 'Legal Pages & Stats Improvements',
      changes: [
        'Added Privacy Policy, Terms of Service, and Cookie Policy pages',
        'New site-wide footer with links to all legal pages',
        'Cookie consent banner on first visit with Accept/Decline options',
        'Terms & Privacy consent language on the signup screen',
        'Redesigned Years tab with expandable accordion view',
        'Double-click any show in the Years view to open full show details',
        'Fixed duplicate Years tab in Stats navigation',
      ]
    },
    {
      version: '1.0.5',
      date: 'February 6, 2026',
      title: 'Guest Mode & Stats Improvements',
      changes: [
        'Try the app without creating an account - shows saved locally',
        'Click shows in Stats view to edit them (same as Shows page)',
        'New Years tab in Stats to browse shows by year',
        'Prompt to create account after adding first show in guest mode',
        'Guest shows automatically migrate when you create an account',
      ]
    },
    {
      version: '1.0.4',
      date: 'February 5, 2026',
      title: 'PWA & Authentication Updates',
      changes: [
        'Install as an app on your phone or desktop (PWA support)',
        'Email/password authentication option added',
        'Profile page with your concert statistics',
        'Community leaderboards showing top show-goers',
        'Invite friends via email',
        'New sidebar navigation for easier access',
      ]
    },
    {
      version: '1.0.3',
      date: 'February 4, 2026',
      title: 'Enhanced Stats & Filtering',
      changes: [
        'Filter songs by artist, venue, or year in Stats',
        'Expandable venue details showing shows by year',
        'Top rated shows leaderboard',
        'Average song ratings displayed per show',
        'Improved mobile responsiveness',
      ]
    },
    {
      version: '1.0.2',
      date: 'February 3, 2026',
      title: 'Setlist Editing & Notes',
      changes: [
        'Add missing songs to any setlist',
        'Rate individual songs (1-10 scale)',
        'Add personal notes to songs',
        'Add notes to entire shows',
        'Batch rate all unrated songs at once',
        'Delete songs from setlists',
      ]
    },
    {
      version: '1.0.1',
      date: 'February 2, 2026',
      title: 'Search & Import',
      changes: [
        'Search setlist.fm for shows by artist',
        'Filter by year, venue, or city',
        'One-click import of setlists',
        'Manual show entry option',
        'Show rating system (1-10)',
      ]
    },
    {
      version: '1.0',
      date: 'February 1, 2026',
      title: 'Initial Release',
      changes: [
        'Track your concert history',
        'Google sign-in authentication',
        'Cloud sync across devices',
        'Basic statistics (shows, songs, artists)',
        'Share your collection stats',
      ]
    },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Release Notes</h1>
      <p className="text-white/60 mb-8">What's new in Setlist Tracker</p>

      <div className="space-y-6">
        {releases.map((release, index) => (
          <div
            key={release.version}
            className={`bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 ${
              index === 0 ? 'ring-2 ring-emerald-500/30' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-lg font-bold text-white">v{release.version}</span>
                  {index === 0 && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
                      Latest
                    </span>
                  )}
                </div>
                <h3 className="text-emerald-400 font-medium">{release.title}</h3>
              </div>
              <span className="text-white/40 text-sm">{release.date}</span>
            </div>
            <ul className="space-y-2">
              {release.changes.map((change, i) => (
                <li key={i} className="flex items-start gap-3 text-white/70">
                  <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// Resize image for upload — caps width at 1920px to stay under Netlify's payload limit
function resizeImageForUpload(file, maxDim = 1200) {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const needsResize = img.width > maxDim || img.height > maxDim;
      // Always use canvas to convert to JPEG for smaller payload
      const canvas = document.createElement('canvas');
      if (needsResize) {
        const scale = Math.min(maxDim / img.width, maxDim / img.height);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Always output as JPEG for much smaller file size
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = () => {
        const ext = file.name.split('.').pop().toLowerCase();
        const mediaTypeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
        resolve({ base64: reader.result.split(',')[1], mediaType: mediaTypeMap[ext] || 'image/png' });
      };
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
}

// Import View Component
function ImportView({ onImport, onUpdateShow, existingShows, onNavigate }) {
  const [step, setStep] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [rawData, setRawData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [previewRows, setPreviewRows] = useState([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importResults, setImportResults] = useState({ imported: 0, failed: 0, skipped: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [setlistFetchStep, setSetlistFetchStep] = useState(null); // null | 'fetching' | 'complete'
  const [setlistFetchProgress, setSetlistFetchProgress] = useState(0);
  const [setlistFetchTotal, setSetlistFetchTotal] = useState(0);
  const [setlistsFound, setSetlistsFound] = useState(0);
  const [screenshotAnalyzing, setScreenshotAnalyzing] = useState(false);
  const [screenshotError, setScreenshotError] = useState(null);

  const fields = useMemo(() => [
    { key: 'artist', label: 'Artist', required: true },
    { key: 'venue', label: 'Venue', required: true },
    { key: 'date', label: 'Date', required: true },
    { key: 'city', label: 'City', required: false },
    { key: 'country', label: 'Country', required: false },
    { key: 'rating', label: 'Rating', required: false },
    { key: 'comment', label: 'Comment', required: false },
    { key: 'tour', label: 'Tour', required: false },
  ], []);

  const processFileData = (rows) => {
    if (rows.length < 2) {
      setParseError('File must contain a header row and at least one data row.');
      return;
    }
    const hdrs = rows[0];
    const data = rows.slice(1).filter(row => row.some(cell => cell !== ''));
    if (data.length === 0) {
      setParseError('No data rows found in file.');
      return;
    }
    setHeaders(hdrs);
    setRawData(data);
    const detected = autoDetectMapping(hdrs);
    setMapping(detected);
    setStep('mapping');
    setParseError(null);
  };

  const handleFile = async (file) => {
    setFileName(file.name);
    setParseError(null);
    setScreenshotError(null);
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const text = await file.text();
      const rows = parseCSV(text);
      processFileData(rows);
    } else if (ext === 'xlsx' || ext === 'xls') {
      try {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const stringRows = rows.map(row => row.map(cell => String(cell)));
        processFileData(stringRows);
      } catch (err) {
        setParseError('Failed to read Excel file. Please ensure it is a valid .xlsx or .xls file.');
      }
    } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      await handleScreenshot(file);
    } else {
      setParseError('Unsupported file type. Please upload a .csv, .xlsx, .xls, or image file (.png, .jpg).');
    }
  };

  const handleScreenshot = async (file) => {
    setScreenshotAnalyzing(true);
    setScreenshotError(null);

    try {
      // Read, resize, and convert to JPEG for smaller payload
      const { base64, mediaType } = await resizeImageForUpload(file);

      // Send to Netlify function for Claude analysis
      const response = await fetch('/.netlify/functions/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error(`Server returned invalid response (status ${response.status}). The image may be too large — try cropping it or using a smaller screenshot.`);
      }

      if (!response.ok) {
        const detail = data.details ? ` (${JSON.stringify(data.details)})` : '';
        throw new Error((data.error || 'Failed to analyze screenshot') + detail);
      }

      const shows = Array.isArray(data.shows) ? data.shows : [];
      if (shows.length === 0) {
        setScreenshotError('No shows were detected in this screenshot. Try a different image showing your past events.');
        setScreenshotAnalyzing(false);
        return;
      }

      // Transform Claude's response into preview rows (same format as CSV import)
      const rows = [];
      for (const show of shows) {
        try {
          const record = {
            artist: show.artist || '',
            venue: show.venue || '',
            date: show.date || '',
            city: show.city || '',
            country: '',
            rating: '',
            comment: '',
            tour: '',
          };

          const errors = [];
          if (!record.artist) errors.push('Missing artist');
          if (!record.venue) errors.push('Missing venue');
          if (!record.date) errors.push('Missing date');

          let parsedDate = null;
          if (record.date) {
            parsedDate = parseImportDate(record.date);
            if (!parsedDate) errors.push('Invalid date');
          }

          const isDuplicate = parsedDate && existingShows.some(s =>
            s.artist?.toLowerCase() === record.artist?.toLowerCase() &&
            s.venue?.toLowerCase() === record.venue?.toLowerCase() &&
            s.date === parsedDate
          );

          rows.push({
            raw: record,
            parsedDate,
            rating: null,
            errors,
            isDuplicate,
            skip: false,
          });
        } catch (rowErr) {
          console.error('Error processing show:', show, rowErr);
        }
      }

      setPreviewRows(rows);
      setStep('preview');
    } catch (err) {
      setScreenshotError(err.message || 'Failed to analyze screenshot. Please try again.');
    } finally {
      setScreenshotAnalyzing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  // Build preview rows with validation
  const buildPreviewRows = useCallback(() => {
    return rawData.map((row) => {
      const record = {};
      const errors = [];

      fields.forEach(field => {
        const colIndex = mapping[field.key];
        const value = colIndex !== undefined && colIndex !== '' ? (row[colIndex] || '') : '';
        record[field.key] = value;
      });

      // Validate required fields
      if (!record.artist) errors.push('Missing artist');
      if (!record.venue) errors.push('Missing venue');
      if (!record.date) errors.push('Missing date');

      // Validate date
      let parsedDate = null;
      if (record.date) {
        parsedDate = parseImportDate(record.date);
        if (!parsedDate) errors.push('Invalid date');
      }

      // Validate rating
      let rating = null;
      if (record.rating) {
        const r = Number(record.rating);
        if (isNaN(r) || r < 1 || r > 10) {
          errors.push('Rating must be 1-10');
        } else {
          rating = r;
        }
      }

      // Check for duplicates
      const isDuplicate = parsedDate && existingShows.some(show =>
        show.artist?.toLowerCase() === record.artist?.toLowerCase() &&
        show.venue?.toLowerCase() === record.venue?.toLowerCase() &&
        show.date === parsedDate
      );

      return {
        raw: record,
        parsedDate,
        rating,
        errors,
        isDuplicate,
        skip: false,
      };
    });
  }, [rawData, mapping, existingShows, fields]);

  useEffect(() => {
    if (step === 'preview' && headers.length > 0) {
      setPreviewRows(buildPreviewRows());
    }
  }, [step, headers.length, buildPreviewRows]);

  const validRows = previewRows.filter(r => r.errors.length === 0 && !r.skip);
  const errorRows = previewRows.filter(r => r.errors.length > 0);
  const duplicateRows = previewRows.filter(r => r.isDuplicate && r.errors.length === 0);

  // Fetch setlist from setlist.fm API for a given show
  const fetchSetlistForShow = async ({ artist, date }) => {
    try {
      if (!artist || !date) return null;
      const year = date.split('-')[0];

      // Helper to search setlist.fm with pagination
      const searchAndMatch = async (searchArtist) => {
        for (let page = 1; page <= 3; page++) {
          const params = new URLSearchParams({ artistName: searchArtist, year, p: String(page) });
          const response = await fetch(`/.netlify/functions/search-setlists?${params.toString()}`);
          if (!response.ok) return null;
          const data = await response.json();
          if (!data.setlist || data.setlist.length === 0) return null;

          const match = data.setlist.find(s => {
            if (!s.eventDate) return false;
            const parts = s.eventDate.split('-');
            if (parts.length !== 3) return false;
            return `${parts[2]}-${parts[1]}-${parts[0]}` === date;
          });

          if (match) return match;
          if (data.setlist.length < 20) break;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        return null;
      };

      // Try original artist name first
      let match = await searchAndMatch(artist);

      // If no match and artist contains special chars like "&", try variations
      if (!match && artist.includes('&')) {
        match = await searchAndMatch(artist.replace(/&/g, 'and'));
      }
      // Try with "The" prefix removed/added
      if (!match && artist.toLowerCase().startsWith('the ')) {
        match = await searchAndMatch(artist.substring(4));
      } else if (!match) {
        match = await searchAndMatch('The ' + artist);
      }

      if (!match) return null;

      // Transform songs using same logic as SearchView importSetlist
      const songs = [];
      let setIndex = 0;
      if (match.sets && match.sets.set) {
        match.sets.set.forEach(set => {
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

      if (songs.length === 0) return null;

      return {
        setlist: songs,
        setlistfmId: match.id,
        tour: match.tour ? match.tour.name : null
      };
    } catch (err) {
      console.warn('Setlist fetch failed for', artist, date, err);
      return null;
    }
  };

  const handleStartImport = async () => {
    const toImport = validRows.filter(r => !r.skip);
    setImportTotal(toImport.length);
    setImportProgress(0);
    setSetlistFetchStep(null);
    setSetlistFetchProgress(0);
    setSetlistsFound(0);
    setStep('importing');

    let imported = 0;
    let failed = 0;
    const importedShows = []; // Track imported shows for setlist fetch

    // Phase 1: Import shows to Firestore
    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      try {
        const showData = {
          artist: row.raw.artist,
          venue: row.raw.venue,
          date: row.parsedDate,
          city: row.raw.city || '',
          country: row.raw.country || '',
          rating: row.rating || null,
          comment: row.raw.comment || '',
          tour: row.raw.tour || '',
          setlist: [],
        };
        const showId = await onImport(showData);
        imported++;
        if (showId) {
          importedShows.push({ showId, artist: showData.artist, date: showData.date, venue: showData.venue, city: showData.city });
        }
      } catch (err) {
        failed++;
      }
      setImportProgress(i + 1);
      if (i < toImport.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Phase 2: Fetch setlists from setlist.fm
    if (importedShows.length > 0 && onUpdateShow) {
      setSetlistFetchStep('fetching');
      setSetlistFetchTotal(importedShows.length);
      let found = 0;

      for (let i = 0; i < importedShows.length; i++) {
        const show = importedShows[i];
        try {
          const result = await fetchSetlistForShow({ artist: show.artist, date: show.date });
          if (result) {
            const updates = { setlist: result.setlist, setlistfmId: result.setlistfmId, isManual: false };
            if (result.tour) updates.tour = result.tour;
            await onUpdateShow(show.showId, updates);
            found++;
          }
        } catch (err) {
          // Non-blocking — setlist fetch failures don't affect import
          console.warn('Setlist fetch error for', show.artist, show.date, err);
        }
        setSetlistFetchProgress(i + 1);
        setSetlistsFound(found);
        // Rate limiting: 300ms between API calls
        if (i < importedShows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      setSetlistFetchStep('complete');
    }

    setImportResults({
      imported,
      failed,
      skipped: previewRows.length - toImport.length,
    });
    setStep('complete');
  };

  const resetImport = () => {
    setStep('upload');
    setFileName('');
    setRawData([]);
    setHeaders([]);
    setMapping({});
    setPreviewRows([]);
    setImportProgress(0);
    setImportTotal(0);
    setImportResults({ imported: 0, failed: 0, skipped: 0 });
    setParseError(null);
    setSetlistFetchStep(null);
    setSetlistFetchProgress(0);
    setSetlistFetchTotal(0);
    setSetlistsFound(0);
    setScreenshotAnalyzing(false);
    setScreenshotError(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Step indicator */}
      {(() => {
        const isScreenshotFlow = headers.length === 0 && step !== 'upload';
        const stepLabels = isScreenshotFlow
          ? ['Upload', 'Preview', 'Import']
          : ['Upload', 'Map Columns', 'Preview', 'Import'];
        const stepKeys = isScreenshotFlow
          ? ['upload', 'preview', 'importing', 'complete']
          : ['upload', 'mapping', 'preview', 'importing', 'complete'];
        const stepIndex = stepKeys.indexOf(step);
        const maxStepIndex = stepLabels.length - 1;

        return (
          <div className="flex items-center gap-2 mb-8">
            {stepLabels.map((label, i) => {
              const isActive = i <= stepIndex;
              const isCurrent = i === Math.min(stepIndex, maxStepIndex);
              return (
                <React.Fragment key={label}>
                  {i > 0 && <div className={`flex-1 h-0.5 ${isActive ? 'bg-emerald-500' : 'bg-white/10'}`} />}
                  <div className={`flex items-center gap-2 ${isCurrent ? 'text-emerald-400' : isActive ? 'text-white/80' : 'text-white/30'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isActive ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-white/5 border border-white/10'
                    }`}>
                      {i < stepIndex ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium">{label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        );
      })()}

      {/* Upload Step */}
      {step === 'upload' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
              screenshotAnalyzing ? 'border-violet-500 bg-violet-500/10' :
              dragOver ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/20 hover:border-white/40 cursor-pointer'
            }`}
            onClick={() => !screenshotAnalyzing && document.getElementById('import-file-input').click()}
          >
            {screenshotAnalyzing ? (
              <>
                <Camera className="w-12 h-12 mx-auto mb-4 text-violet-400 animate-pulse" />
                <p className="text-lg font-medium text-white mb-2">Analyzing Screenshot...</p>
                <p className="text-white/50 mb-4">AI is identifying shows from your image</p>
                <div className="w-48 h-1.5 bg-white/10 rounded-full mx-auto overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </>
            ) : (
              <>
                <Upload className={`w-12 h-12 mx-auto mb-4 ${dragOver ? 'text-emerald-400' : 'text-white/30'}`} />
                <p className="text-lg font-medium text-white mb-2">
                  {dragOver ? 'Drop your file here' : 'Drag & drop your file here'}
                </p>
                <p className="text-white/50 mb-4">or click to browse</p>
                <p className="text-white/30 text-sm">Supports .csv, .xlsx, .xls, and screenshot images (.png, .jpg)</p>
              </>
            )}
            <input
              id="import-file-input"
              type="file"
              accept=".csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {parseError && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{parseError}</p>
            </div>
          )}

          {screenshotError && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{screenshotError}</p>
            </div>
          )}

          <div className="mt-8 p-4 bg-white/5 rounded-xl">
            <h3 className="text-white font-medium mb-3">Import options</h3>
            <ul className="space-y-2 text-white/50 text-sm">
              <li className="flex items-start gap-2">
                <Upload className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>CSV or Excel file with columns for Artist, Venue, Date (+ optional City, Rating, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <Camera className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                <span>Screenshot from Ticketmaster, AXS, or any ticket platform showing your past events</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>Google Sheets: File → Download → CSV or Excel</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Mapping Step */}
      {step === 'mapping' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Map Your Columns</h2>
              <p className="text-white/50 text-sm mt-1">
                We detected {headers.length} columns from <span className="text-white/80">{fileName}</span>
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {fields.map(field => (
              <div key={field.key} className="flex items-center gap-4">
                <label className="w-28 text-sm text-white/80 flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-red-400">*</span>}
                </label>
                <select
                  value={mapping[field.key] !== undefined ? mapping[field.key] : ''}
                  onChange={(e) => setMapping(prev => ({
                    ...prev,
                    [field.key]: e.target.value === '' ? undefined : Number(e.target.value)
                  }))}
                  className="flex-1 px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 [&>option]:bg-slate-800"
                >
                  <option value="">— Skip —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Preview of first 3 rows */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-white/60 mb-3">Preview (first 3 rows)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {fields.filter(f => mapping[f.key] !== undefined).map(f => (
                      <th key={f.key} className="text-left px-3 py-2 text-white/60 font-medium">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawData.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {fields.filter(f => mapping[f.key] !== undefined).map(f => (
                        <td key={f.key} className="px-3 py-2 text-white/70">{row[mapping[f.key]] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetImport}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => {
                const missingRequired = fields
                  .filter(f => f.required && mapping[f.key] === undefined)
                  .map(f => f.label);
                if (missingRequired.length > 0) {
                  setParseError(`Please map required columns: ${missingRequired.join(', ')}`);
                  return;
                }
                setParseError(null);
                setStep('preview');
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/25"
            >
              Preview Import
            </button>
          </div>

          {parseError && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{parseError}</p>
            </div>
          )}
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Review Import</h2>
              <p className="text-white/50 text-sm mt-1">{previewRows.length} rows found in {fileName}</p>
            </div>
          </div>

          {/* Summary badges */}
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="px-3 py-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg text-sm font-medium">
              {validRows.length} ready to import
            </span>
            {errorRows.length > 0 && (
              <span className="px-3 py-1.5 bg-red-500/15 text-red-400 rounded-lg text-sm font-medium">
                {errorRows.length} with errors
              </span>
            )}
            {duplicateRows.length > 0 && (
              <span className="px-3 py-1.5 bg-amber-500/15 text-amber-400 rounded-lg text-sm font-medium">
                {duplicateRows.length} possible duplicates
              </span>
            )}
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto mb-6 max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800/95">
                <tr className="border-b border-white/10">
                  <th className="text-left px-3 py-2 text-white/60 font-medium w-8">#</th>
                  <th className="text-left px-3 py-2 text-white/60 font-medium">Artist</th>
                  <th className="text-left px-3 py-2 text-white/60 font-medium">Venue</th>
                  <th className="text-left px-3 py-2 text-white/60 font-medium">Date</th>
                  <th className="text-left px-3 py-2 text-white/60 font-medium">City</th>
                  <th className="text-left px-3 py-2 text-white/60 font-medium w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-white/5 ${
                      row.errors.length > 0
                        ? 'bg-red-500/5'
                        : row.isDuplicate
                        ? 'bg-amber-500/5'
                        : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-white/40">{i + 1}</td>
                    <td className="px-3 py-2 text-white/80">{row.raw.artist || '—'}</td>
                    <td className="px-3 py-2 text-white/80">{row.raw.venue || '—'}</td>
                    <td className="px-3 py-2 text-white/80">
                      {row.parsedDate ? formatDate(row.parsedDate) : <span className="text-red-400">{row.raw.date || '—'}</span>}
                    </td>
                    <td className="px-3 py-2 text-white/60">{row.raw.city || '—'}</td>
                    <td className="px-3 py-2">
                      {row.errors.length > 0 ? (
                        <Tip text={row.errors.join(', ')}>
                          <span className="text-red-400 text-xs">
                            <AlertTriangle className="w-4 h-4 inline mr-1" />
                            Error
                          </span>
                        </Tip>
                      ) : row.isDuplicate ? (
                        <span className="text-amber-400 text-xs">Duplicate?</span>
                      ) : (
                        <span className="text-emerald-400 text-xs">
                          <Check className="w-4 h-4 inline" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Error details */}
          {errorRows.length > 0 && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-300 text-sm font-medium mb-2">Rows with errors will be skipped:</p>
              <ul className="text-red-300/70 text-xs space-y-1">
                {errorRows.slice(0, 5).map((row, i) => (
                  <li key={i}>Row {previewRows.indexOf(row) + 1}: {row.errors.join(', ')}</li>
                ))}
                {errorRows.length > 5 && (
                  <li>...and {errorRows.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => headers.length === 0 ? resetImport() : setStep('mapping')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleStartImport}
              disabled={validRows.length === 0}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg ${
                validRows.length > 0
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-emerald-500/25'
                  : 'bg-white/5 text-white/30 cursor-not-allowed shadow-none'
              }`}
            >
              Import {validRows.length} Show{validRows.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Importing Step */}
      {step === 'importing' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
          {!setlistFetchStep ? (
            <>
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Download className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Importing Shows...</h2>
              <p className="text-white/50 mb-6">{importProgress} of {importTotal}</p>
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden max-w-md mx-auto">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                  style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Music className="w-8 h-8 text-violet-400 animate-pulse" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Fetching Setlists...</h2>
              <p className="text-white/50 mb-2">Searching setlist.fm for your shows</p>
              <p className="text-white/50 mb-6">{setlistFetchProgress} of {setlistFetchTotal} — {setlistsFound} found</p>
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden max-w-md mx-auto">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${setlistFetchTotal > 0 ? (setlistFetchProgress / setlistFetchTotal) * 100 : 0}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Import Complete!</h2>

          <div className="flex flex-wrap justify-center gap-4 my-6">
            <div className="px-4 py-3 bg-emerald-500/10 rounded-xl">
              <p className="text-2xl font-bold text-emerald-400">{importResults.imported}</p>
              <p className="text-white/50 text-sm">Imported</p>
            </div>
            {importResults.failed > 0 && (
              <div className="px-4 py-3 bg-red-500/10 rounded-xl">
                <p className="text-2xl font-bold text-red-400">{importResults.failed}</p>
                <p className="text-white/50 text-sm">Failed</p>
              </div>
            )}
            {importResults.skipped > 0 && (
              <div className="px-4 py-3 bg-white/5 rounded-xl">
                <p className="text-2xl font-bold text-white/50">{importResults.skipped}</p>
                <p className="text-white/50 text-sm">Skipped</p>
              </div>
            )}
            {setlistsFound > 0 && (
              <div className="px-4 py-3 bg-violet-500/10 rounded-xl">
                <p className="text-2xl font-bold text-violet-400">{setlistsFound}</p>
                <p className="text-white/50 text-sm">Setlists Found</p>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => onNavigate('shows')}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/25"
            >
              View My Shows
            </button>
            <button
              onClick={resetImport}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Community Stats View Component
function CommunityStatsView({ communityStats, onAddFriend, currentUserUid, currentFriendUids }) {
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
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Community Stats</h1>
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
            {(communityStats.topShowsAttended || []).slice(0, 5).map((user, i) => (
              <div key={user.odubleserId} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/40'}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/80 flex-1">{user.firstName}</span>
                {onAddFriend && user.odubleserId !== currentUserUid && !(currentFriendUids || []).includes(user.odubleserId) && (
                  <Tip text="Add friend">
                    <button
                      onClick={() => onAddFriend(user.odubleserId, user.firstName, '')}
                      className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                    >
                      <UserPlus className="w-3 h-3 inline mr-1" />
                      Add
                    </button>
                  </Tip>
                )}
                <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-semibold">
                  {user.count} shows
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Raters */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold text-white text-lg">Top Raters</h2>
          </div>
          <div className="space-y-3">
            {(communityStats.topSongsRated || []).slice(0, 5).map((user, i) => (
              <div key={user.odubleserId} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-pink-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-pink-600' : 'text-white/40'}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/80 flex-1">{user.firstName}</span>
                {onAddFriend && user.odubleserId !== currentUserUid && !(currentFriendUids || []).includes(user.odubleserId) && (
                  <Tip text="Add friend">
                    <button
                      onClick={() => onAddFriend(user.odubleserId, user.firstName, '')}
                      className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                    >
                      <UserPlus className="w-3 h-3 inline mr-1" />
                      Add
                    </button>
                  </Tip>
                )}
                <span className="bg-pink-500/20 text-pink-400 px-3 py-1 rounded-full text-sm font-semibold">
                  {user.count} ratings
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Rated Songs */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold text-white text-lg">Top Rated Songs</h2>
          </div>
          <div className="space-y-3">
            {(communityStats.topSongsByRating || []).slice(0, 5).map((song, i) => (
              <div key={song.songName} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-violet-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-violet-600' : 'text-white/40'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 truncate">{song.songName}</div>
                  <div className="text-white/40 text-xs truncate">{song.artists?.join(', ')}</div>
                </div>
                <div className="text-right">
                  <span className="bg-violet-500/20 text-violet-400 px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                    {song.avgRating}/10
                  </span>
                  <div className="text-white/30 text-xs mt-1">{song.ratingCount} ratings</div>
                </div>
              </div>
            ))}
            {(!communityStats.topSongsByRating || communityStats.topSongsByRating.length === 0) && (
              <p className="text-white/40 text-sm">Not enough ratings yet. Songs need at least 2 ratings to appear.</p>
            )}
          </div>
        </div>

        {/* Top Venues */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold text-white text-lg">Top Venues</h2>
          </div>
          <div className="space-y-3">
            {(communityStats.topVenues || []).slice(0, 5).map((venue, i) => (
              <div key={venue.venueName} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-cyan-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-cyan-600' : 'text-white/40'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 truncate">{venue.venueName}</div>
                  <div className="text-white/40 text-xs">{venue.artistCount} artists</div>
                </div>
                <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-sm font-semibold">
                  {venue.showCount} shows
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      const response = await fetch(`/.netlify/functions/search-artists?${params.toString()}`);

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
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Search Shows</h1>
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
              onKeyPress={(e) => e.key === 'Enter' && searchArtists()}
              disabled={selectedArtist !== null}
              className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40 disabled:opacity-50"
            />
            {selectedArtist && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
                <span className="text-emerald-400 text-sm flex-1">
                  <span className="text-white/60">Searching:</span> {selectedArtist.name}
                  {selectedArtist.disambiguation && (
                    <span className="text-white/40 ml-1">({selectedArtist.disambiguation})</span>
                  )}
                </span>
                <Tip text="Clear selection">
                  <button
                    onClick={clearArtistSelection}
                    className="text-white/60 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Tip>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Year</label>
            <input
              type="text"
              placeholder="e.g., 2024"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && selectedArtist && searchSetlists(1)}
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
              onKeyPress={(e) => e.key === 'Enter' && selectedArtist && searchSetlists(1)}
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
              onKeyPress={(e) => e.key === 'Enter' && (selectedArtist ? searchSetlists(1) : searchArtists())}
              className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
            />
          </div>
        </div>
        <button
          onClick={() => selectedArtist ? searchSetlists(1) : searchArtists()}
          disabled={isSearching || !artistName.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25"
        >
          <Search className="w-4 h-4" />
          {isSearching ? 'Searching...' : (selectedArtist ? 'Search Setlists' : 'Search Artists')}
        </button>
      </div>

      {/* Artist Picker */}
      {showArtistPicker && artistOptions.length > 0 && (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Select Artist</h2>
              <p className="text-sm text-white/50">Multiple artists found - please select the correct one</p>
            </div>
            <button
              onClick={() => {
                setShowArtistPicker(false);
                setArtistOptions([]);
              }}
              className="text-white/60 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-2">
            {artistOptions.map((artist) => (
              <button
                key={artist.mbid || artist.name}
                onClick={() => selectArtist(artist)}
                className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 rounded-xl transition-all group"
              >
                <div className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                  {artist.name}
                </div>
                {artist.disambiguation && (
                  <div className="text-sm text-white/50 mt-1">{artist.disambiguation}</div>
                )}
                {artist.sortName && artist.sortName !== artist.name && (
                  <div className="text-xs text-white/30 mt-1">Sort: {artist.sortName}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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

          {results.map((setlist) => {
            const songCount = setlist.sets?.set?.reduce((acc, s) => acc + (s.song?.length || 0), 0) || 0;
            const isExpanded = expandedSetlist === setlist.id;

            return (
              <div
                key={setlist.id}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all"
              >
                <div className="p-4 hover:bg-white/5">
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
                      {songCount > 0 && (
                        <button
                          onClick={() => setExpandedSetlist(isExpanded ? null : setlist.id)}
                          className="flex items-center gap-1 text-xs text-white/50 hover:text-white/70 mt-2 transition-colors"
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

                {/* Expandable Setlist */}
                {isExpanded && setlist.sets?.set && (
                  <div className="border-t border-white/10 bg-white/5 p-4">
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {setlist.sets.set.map((set, setIdx) => (
                        <div key={setIdx}>
                          {set.name && (
                            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mt-2 mb-1">
                              {set.name || (set.encore ? 'Encore' : `Set ${setIdx + 1}`)}
                            </div>
                          )}
                          {set.encore && !set.name && (
                            <div className="text-xs font-semibold text-amber-400 uppercase tracking-wide mt-2 mb-1">
                              Encore
                            </div>
                          )}
                          {set.song?.map((song, songIdx) => (
                            <div
                              key={songIdx}
                              className="flex items-center gap-2 py-1 text-sm text-white/70"
                            >
                              <span className="text-white/30 w-6 text-right text-xs">{songIdx + 1}.</span>
                              <span>{song.name}</span>
                              {song.cover && (
                                <span className="text-xs text-white/40">
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

// Ticket Scanner Component
function TicketScanner({ onImport, importedIds, existingShows }) {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [extractedShows, setExtractedShows] = useState([]);
  const [expandedSetlist, setExpandedSetlist] = useState(null);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    const imageFiles = selected.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setError('Please select image files (JPG, PNG, etc.)');
      return;
    }
    setFiles(prev => [...prev, ...imageFiles]);
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviews(prev => [...prev, { name: file.name, url: ev.target.result }]);
      };
      reader.readAsDataURL(file);
    });
    setError('');
  };

  const removeImage = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const analyzeTickets = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    setError('');
    setExtractedShows([]);

    try {
      const images = [];
      for (const file of files) {
        const { base64, mediaType } = await resizeImageForUpload(file);
        images.push({ base64, mediaType });
      }

      const response = await fetch('/.netlify/functions/analyze-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Server returned invalid response (status ${response.status}). Images may be too large — try fewer or smaller images.`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze tickets');
      }

      const shows = Array.isArray(data.shows) ? data.shows : [];
      if (shows.length === 0) {
        setError('No shows detected in the ticket images. Try different or clearer images.');
        setAnalyzing(false);
        return;
      }

      const initial = shows.map(s => ({
        ...s,
        setlistResults: [],
        searching: true,
        imported: false,
        noResults: false,
      }));
      setExtractedShows(initial);
      setAnalyzing(false);

      // Search setlist.fm for each extracted show
      for (let i = 0; i < shows.length; i++) {
        const show = shows[i];
        if (!show.artist) {
          setExtractedShows(prev => prev.map((s, idx) => idx === i ? { ...s, searching: false, noResults: true } : s));
          continue;
        }

        try {
          const artistParams = new URLSearchParams({ artistName: show.artist });
          const artistRes = await fetch(`/.netlify/functions/search-artists?${artistParams.toString()}`);
          let artistMbid = null;

          if (artistRes.ok) {
            const artistData = await artistRes.json();
            if (artistData.artist && artistData.artist.length > 0) {
              const exactMatch = artistData.artist.find(a => a.name.toLowerCase() === show.artist.toLowerCase());
              artistMbid = (exactMatch || artistData.artist[0]).mbid;
            }
          }

          const params = new URLSearchParams();
          if (artistMbid) {
            params.set('artistMbid', artistMbid);
          } else {
            params.set('artistName', show.artist);
          }
          if (show.date) {
            const yearMatch = show.date.match(/(\d{4})/);
            if (yearMatch) params.set('year', yearMatch[1]);
          }

          const setlistRes = await fetch(`/.netlify/functions/search-setlists?${params.toString()}`);

          if (setlistRes.ok) {
            const setlistData = await setlistRes.json();
            const results = setlistData.setlist || [];
            setExtractedShows(prev => prev.map((s, idx) =>
              idx === i ? { ...s, setlistResults: results.slice(0, 10), searching: false, noResults: results.length === 0 } : s
            ));
          } else {
            setExtractedShows(prev => prev.map((s, idx) =>
              idx === i ? { ...s, searching: false, noResults: true } : s
            ));
          }

          if (i < shows.length - 1) await new Promise(r => setTimeout(r, 400));
        } catch {
          setExtractedShows(prev => prev.map((s, idx) =>
            idx === i ? { ...s, searching: false, noResults: true } : s
          ));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to analyze tickets. Please try again.');
      setAnalyzing(false);
    }
  };

  const importSetlist = (showIdx, setlist) => {
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

    onImport({
      artist: setlist.artist.name,
      venue: setlist.venue.name,
      city: setlist.venue.city.name,
      country: setlist.venue.city.country.name,
      date: setlist.eventDate,
      setlist: songs,
      setlistfmId: setlist.id,
      tour: setlist.tour ? setlist.tour.name : null
    });

    setExtractedShows(prev => prev.map((s, idx) =>
      idx === showIdx ? { ...s, imported: true } : s
    ));
  };

  const importManually = (showIdx) => {
    const show = extractedShows[showIdx];
    onImport({
      artist: show.artist || '',
      venue: show.venue || '',
      city: show.city || '',
      date: show.date || '',
      setlist: [],
    });
    setExtractedShows(prev => prev.map((s, idx) =>
      idx === showIdx ? { ...s, imported: true } : s
    ));
  };

  const isAlreadyImported = (setlistId) => importedIds.has(setlistId);

  const formatSetlistDate = (dateStr) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toLocaleDateString();
    }
    return dateStr;
  };

  const reset = () => {
    setFiles([]);
    setPreviews([]);
    setExtractedShows([]);
    setError('');
    setExpandedSetlist(null);
  };

  return (
    <div>
      {/* Upload Area */}
      {extractedShows.length === 0 && (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6">
          <div className="flex flex-col items-center justify-center py-8">
            <Camera className="w-12 h-12 text-white/20 mb-4" />
            <p className="text-white/60 mb-4 text-center">
              Upload photos of your concert ticket stubs, wristbands, or digital tickets
            </p>
            <label className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white rounded-xl font-medium cursor-pointer transition-all shadow-lg shadow-violet-500/25">
              <Camera className="w-4 h-4" />
              {files.length > 0 ? 'Add More Images' : 'Select Images'}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {/* Image Previews */}
          {previews.length > 0 && (
            <div className="mt-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {previews.map((preview, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={preview.url}
                      alt={preview.name}
                      className="w-full h-32 object-cover rounded-xl border border-white/10"
                    />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white/80 text-xs px-2 py-1 rounded-b-xl truncate">
                      {preview.name}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={analyzeTickets}
                  disabled={analyzing}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing {files.length} ticket{files.length !== 1 ? 's' : ''}...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Analyze {files.length} Ticket{files.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
                <button
                  onClick={reset}
                  disabled={analyzing}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white/70 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {extractedShows.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Found {extractedShows.length} show{extractedShows.length !== 1 ? 's' : ''} from tickets
            </h2>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-xl text-sm font-medium transition-colors"
            >
              <Camera className="w-4 h-4" />
              Scan More
            </button>
          </div>

          {extractedShows.map((show, showIdx) => (
            <div key={showIdx} className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              {/* Extracted show header */}
              <div className="p-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{show.artist || 'Unknown Artist'}</div>
                    <div className="text-sm text-white/60 mt-1">
                      {show.venue || 'Unknown Venue'}
                      {show.city && <span> &middot; {show.city}</span>}
                    </div>
                    {show.date && (
                      <div className="text-sm text-white/40 mt-1">
                        {(() => { try { return new Date(show.date).toLocaleDateString(); } catch { return show.date; } })()}
                      </div>
                    )}
                  </div>
                  {show.imported && (
                    <span className="flex items-center gap-1 text-sm text-emerald-400">
                      <Check className="w-4 h-4" />
                      Imported
                    </span>
                  )}
                </div>
              </div>

              {/* Setlist search results */}
              <div className="p-4">
                {show.searching && (
                  <div className="flex items-center gap-3 text-white/50 text-sm py-4">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Searching setlist.fm for matching shows...
                  </div>
                )}

                {!show.searching && show.noResults && !show.imported && (
                  <div className="text-center py-4">
                    <p className="text-white/40 text-sm mb-3">No setlists found on setlist.fm</p>
                    <button
                      onClick={() => importManually(showIdx)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-all mx-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Add Without Setlist
                    </button>
                  </div>
                )}

                {!show.searching && show.setlistResults.length > 0 && !show.imported && (
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Select matching setlist:</p>
                    {show.setlistResults.map((setlist) => {
                      const songCount = setlist.sets?.set?.reduce((acc, s) => acc + (s.song?.length || 0), 0) || 0;
                      const isExpanded = expandedSetlist === `${showIdx}-${setlist.id}`;
                      const alreadyAdded = isAlreadyImported(setlist.id);

                      return (
                        <div key={setlist.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                          <div className="p-3 hover:bg-white/5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white">{setlist.artist.name}</div>
                                <div className="text-xs text-white/60 mt-0.5">
                                  {setlist.venue.name} &middot; {setlist.venue.city.name}
                                </div>
                                <div className="text-xs text-white/40 mt-0.5">
                                  {formatSetlistDate(setlist.eventDate)}
                                  {setlist.tour && <span className="text-emerald-400 ml-2">{setlist.tour.name}</span>}
                                </div>
                                {songCount > 0 && (
                                  <button
                                    onClick={() => setExpandedSetlist(isExpanded ? null : `${showIdx}-${setlist.id}`)}
                                    className="flex items-center gap-1 text-xs text-white/50 hover:text-white/70 mt-1 transition-colors"
                                  >
                                    <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    {songCount} songs
                                  </button>
                                )}
                              </div>
                              <button
                                onClick={() => !alreadyAdded && importSetlist(showIdx, setlist)}
                                disabled={alreadyAdded}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  alreadyAdded
                                    ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                                    : 'bg-white/10 hover:bg-white/20 text-white'
                                }`}
                              >
                                {alreadyAdded ? <><Check className="w-3 h-3" /> Added</> : <><Download className="w-3 h-3" /> Add</>}
                              </button>
                            </div>
                          </div>

                          {isExpanded && setlist.sets?.set && (
                            <div className="border-t border-white/10 bg-white/5 p-3">
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {setlist.sets.set.map((set, setIdx) => (
                                  <div key={setIdx}>
                                    {set.name && (
                                      <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mt-1 mb-1">{set.name}</div>
                                    )}
                                    {set.encore && !set.name && (
                                      <div className="text-xs font-semibold text-amber-400 uppercase tracking-wide mt-1 mb-1">Encore</div>
                                    )}
                                    {set.song?.map((song, songIdx) => (
                                      <div key={songIdx} className="flex items-center gap-2 py-0.5 text-xs text-white/70">
                                        <span className="text-white/30 w-5 text-right">{songIdx + 1}.</span>
                                        <span>{song.name}</span>
                                        {song.cover && <span className="text-white/40">({song.cover.name} cover)</span>}
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
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Combined Scan / Import View
function ScanImportView({ onImport, onUpdateShow, existingShows, importedIds, onNavigate }) {
  const [activeTab, setActiveTab] = useState('scan');

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Scan / Import Tickets</h1>
      <p className="text-white/60 mb-6">Add shows by scanning ticket stubs or importing a file</p>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'scan', label: 'Scan Tickets', icon: Camera },
          { id: 'import', label: 'Import File', icon: Upload },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'scan' && (
        <TicketScanner onImport={onImport} importedIds={importedIds} existingShows={existingShows} />
      )}
      {activeTab === 'import' && (
        <ImportView onImport={onImport} onUpdateShow={onUpdateShow} existingShows={existingShows} onNavigate={onNavigate} />
      )}
    </div>
  );
}

export default function ShowTracker() {
  const [shows, setShows] = useState([]);
  const [activeView, setActiveView] = useState('shows');
  const [statsTab, setStatsTab] = useState('years');
  const [friendsInitialTab, setFriendsInitialTab] = useState(null);
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
  const [authModal, setAuthModal] = useState(null); // null | 'login' | 'signup' | 'forgot-password'
  const [guestMode, setGuestMode] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false); // Prompt to create account after first show

  // Onboarding tooltip state
  const [tooltipStep, setTooltipStep] = useState(0); // 0=hidden, 1=import, 2=scan

  useEffect(() => {
    if (!isLoading && user && activeView === 'shows') {
      const now = Date.now();
      const lastVisit = localStorage.getItem('mysetlists_lastVisit');
      const hasSeenTooltips = localStorage.getItem('hasSeenOnboardingTooltips');
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // Show tooltips if: never visited OR last visit was more than 7 days ago
      const shouldShow = !hasSeenTooltips || (lastVisit && (now - parseInt(lastVisit, 10)) > sevenDaysMs);

      if (shouldShow) {
        const timer = setTimeout(() => setTooltipStep(1), 800);
        localStorage.setItem('mysetlists_lastVisit', String(now));
        return () => clearTimeout(timer);
      }

      // Update lastVisit timestamp on every session load (even if tooltips not shown)
      localStorage.setItem('mysetlists_lastVisit', String(now));
    }
  }, [isLoading, user, activeView]);

  const dismissTooltip = () => {
    setTooltipStep(0);
    localStorage.setItem('hasSeenOnboardingTooltips', '1');
    localStorage.setItem('mysetlists_lastVisit', String(Date.now()));
  };

  // URL-based navigation (back/forward button support)
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const VALID_VIEWS = ['shows','stats','search','friends','invite','feedback','release-notes','scan-import','community','profile','admin','upcoming-shows','roadmap'];
  // Backward compat: old URLs for import/scan-tickets redirect to scan-import
  const VIEW_REDIRECTS = { 'import': 'scan-import', 'scan-tickets': 'scan-import' };

  // Initialize activeView from ?view= param on first load
  useEffect(() => {
    let v = searchParams.get('view');
    if (v && VIEW_REDIRECTS[v]) v = VIEW_REDIRECTS[v];
    if (v && VALID_VIEWS.includes(v)) setActiveView(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep state in sync when user presses browser back/forward
  useEffect(() => {
    const handler = () => {
      const params = new URLSearchParams(window.location.search);
      let v = params.get('view');
      if (v && VIEW_REDIRECTS[v]) v = VIEW_REDIRECTS[v];
      setActiveView((v && VALID_VIEWS.includes(v)) ? v : 'shows');
      setSelectedArtist(null);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wrapper for user-triggered view changes — keeps URL in sync
  const navigateTo = (view) => {
    setActiveView(view);
    navigate(`/?view=${view}`, { replace: false });
  };

  // Capture invite referral from URL param (?ref=uid) and persist in localStorage
  useEffect(() => {
    const refUid = searchParams.get('ref');
    if (refUid) {
      localStorage.setItem('invite-referrer', refUid);
      // Clean ?ref from URL while keeping ?view= if present
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('ref');
      window.history.replaceState({}, '', cleanUrl.toString());
    }
  }, [searchParams]);

  // Community stats
  const [communityStats, setCommunityStats] = useState(null);
  const [userRank, setUserRank] = useState(null);

  // Setlist scanning
  const [setlistScanning, setSetlistScanning] = useState(false);
  const [setlistScanProgress, setSetlistScanProgress] = useState({ current: 0, total: 0, found: 0 });

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Celebration animation
  const [showCelebration, setShowCelebration] = useState(false);

  // Friends feature state
  const [friends, setFriends] = useState([]);
  const [pendingFriendRequests, setPendingFriendRequests] = useState([]);
  const [sentFriendRequests, setSentFriendRequests] = useState([]);
  const [pendingShowTags, setPendingShowTags] = useState([]);
  const [tagFriendsShow, setTagFriendsShow] = useState(null);

  // Show Suggestions — proactive "were you there together?" prompts
  // Collection: showSuggestions/{uid1}_{uid2}_{showKey} (uid1 < uid2 alphabetically)
  const [showSuggestions, setShowSuggestions] = useState([]);

  // Pending Invites — email invites this user has sent that are still pending
  const [pendingInvites, setPendingInvites] = useState([]);
  const [inviteStats, setInviteStats] = useState(null); // null | { total, accepted }

  // Shared Memories — comment threads on confirmed shared shows
  const [memoriesShow, setMemoriesShow]     = useState(null); // null | { suggestion, show }
  const [sharedComments, setSharedComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // In-app notifications (e.g. roadmap_published)
  // Collection: notifications/{notificationId} — { uid, type, message, itemId, itemTitle, read, createdAt }
  const [unreadNotifications, setUnreadNotifications] = useState([]);

  // Admin
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // Derived friends data
  const friendUids = useMemo(() => friends.map(f => f.friendUid), [friends]);

  // Derived suggestion state
  const myPendingSuggestions   = showSuggestions.filter(s => s.responses?.[user?.uid] === 'pending' && s.overallStatus !== 'declined');
  const myConfirmedSuggestions = showSuggestions.filter(s => s.overallStatus === 'confirmed');

  const pendingNotificationCount = pendingFriendRequests.length + pendingShowTags.length + myPendingSuggestions.length + pendingInvites.length + unreadNotifications.length;
  const [upcomingShowsBadgeCount, setUpcomingShowsBadgeCount] = useState(null);

  // Post-signup welcome + pending tags
  const [welcomeState, setWelcomeState] = useState(null);       // null | { inviterName, inviterUid }
  const [pendingTagsForReview, setPendingTagsForReview] = useState([]);

  // Global toast notification
  const [toast, setToast] = useState(null); // null | string

  // Venue rating modal
  const [venueRatingShow, setVenueRatingShow] = useState(null); // null | showObj
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Clear friendsInitialTab when navigating away from friends
  useEffect(() => {
    if (activeView !== 'friends') {
      setFriendsInitialTab(null);
    }
  }, [activeView]);

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

  // Load friends list
  const loadFriends = useCallback(async () => {
    if (!user) return;
    try {
      const friendsRef = collection(db, 'users', user.uid, 'friends');
      const snapshot = await getDocs(friendsRef);
      setFriends(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  }, [user]);

  // Real-time listeners for friend requests and show tags
  useEffect(() => {
    if (!user || guestMode) return;

    loadFriends();

    // Incoming friend requests (single-field query, filter status client-side to avoid composite index)
    const qIncoming = query(collection(db, 'friendRequests'), where('to', '==', user.uid));
    const unsubIncoming = onSnapshot(qIncoming, (snapshot) => {
      setPendingFriendRequests(
        snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(r => r.status === 'pending')
      );
    }, (error) => {
      console.log('Friend requests listener error:', error.message);
    });

    // Sent friend requests (single-field query, filter status client-side)
    const qSent = query(collection(db, 'friendRequests'), where('from', '==', user.uid));
    const unsubSent = onSnapshot(qSent, (snapshot) => {
      setSentFriendRequests(
        snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(r => r.status === 'pending')
      );
    }, (error) => {
      console.log('Sent requests listener error:', error.message);
    });

    // Incoming show tags (single-field query, filter status client-side)
    const qTags = query(collection(db, 'showTags'), where('toUid', '==', user.uid));
    const unsubTags = onSnapshot(qTags, (snapshot) => {
      setPendingShowTags(
        snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(t => t.status === 'pending')
      );
    }, (error) => {
      console.log('Show tags listener error:', error.message);
    });

    // Show suggestions — real-time listener on showSuggestions where this user is a participant
    // Firestore index required: participants (Array Contains) — Firebase will prompt to create on first load
    const qSuggestions = query(collection(db, 'showSuggestions'), where('participants', 'array-contains', user.uid));
    const unsubSuggestions = onSnapshot(qSuggestions, (snapshot) => {
      setShowSuggestions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.log('Show suggestions listener error:', error.message);
    });

    // Pending invites this user has sent (status === 'pending')
    const qInvites = query(
      collection(db, 'invites'),
      where('inviterUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubInvites = onSnapshot(qInvites, (snapshot) => {
      setPendingInvites(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.log('Pending invites listener error:', error.message);
    });

    // In-app notifications — e.g. "Your feature request made the roadmap!"
    // Collection: notifications/{notificationId}
    const qNotifications = query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      where('read', '==', false)
    );
    const unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
      setUnreadNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.log('Notifications listener error:', error.message);
    });

    return () => {
      unsubIncoming();
      unsubSent();
      unsubTags();
      unsubSuggestions();
      unsubInvites();
      unsubNotifications();
    };
  }, [user, guestMode, loadFriends]);

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
        // One-time retroactive suggestion scan
        runRetroactiveSuggestionScan().catch(() => {});
      }
    } catch (error) {
      console.error('Failed to load shows:', error);
    } finally {
      setIsLoading(false);
    }
  }, [calculateUserRank]);

  // Load guest shows from localStorage
  const loadGuestShows = useCallback(() => {
    try {
      const stored = localStorage.getItem('guest-shows');
      if (stored) {
        const guestShows = JSON.parse(stored);
        if (guestShows && guestShows.length > 0) {
          setShows(guestShows);
        }
      }
    } catch (error) {
      console.log('Failed to load guest shows:', error);
    }
    setIsLoading(false);
  }, []);

  // Save guest shows to localStorage
  const saveGuestShows = useCallback((showsToSave) => {
    try {
      localStorage.setItem('guest-shows', JSON.stringify(showsToSave));
    } catch (error) {
      console.log('Failed to save guest shows:', error);
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        // Mark guest session as converted if the user was in guest mode
        try {
          const guestSessionId = localStorage.getItem('guest-session-id');
          if (guestSessionId) {
            await updateDoc(doc(db, 'guestSessions', guestSessionId), {
              converted: true,
              convertedAt: serverTimestamp(),
              convertedUserId: currentUser.uid,
            });
            localStorage.removeItem('guest-session-id');
          }
        } catch (error) {
          console.log('Failed to update guest session conversion:', error);
        }

        setGuestMode(false);
        checkForLocalData();
        // Also check for guest shows to migrate
        const guestStored = localStorage.getItem('guest-shows');
        if (guestStored) {
          const guestShows = JSON.parse(guestStored);
          if (guestShows && guestShows.length > 0) {
            setLocalShowsToMigrate(prev => [...prev, ...guestShows]);
            setShowMigrationPrompt(true);
          }
        }
        loadShows(currentUser.uid);
        loadInviteStats(currentUser.uid);

        // Auto-friend the user who invited them via referral link
        const referrerUid = localStorage.getItem('invite-referrer');
        if (referrerUid && referrerUid !== currentUser.uid) {
          try {
            // Check if already friends to avoid duplicates
            const existingFriend = await getDoc(doc(db, 'users', currentUser.uid, 'friends', referrerUid));
            if (!existingFriend.exists()) {
              // Get referrer's profile for their name/email
              const referrerProfile = await getDoc(doc(db, 'userProfiles', referrerUid));
              const referrerData = referrerProfile.exists() ? referrerProfile.data() : {};

              // Create friend doc for the new user
              await setDoc(doc(db, 'users', currentUser.uid, 'friends', referrerUid), {
                friendUid: referrerUid,
                friendName: referrerData.displayName || referrerData.firstName || 'Friend',
                friendEmail: referrerData.email || '',
                friendPhotoURL: referrerData.photoURL || '',
                addedAt: serverTimestamp()
              });

              // Create friend doc for the referrer
              await setDoc(doc(db, 'users', referrerUid, 'friends', currentUser.uid), {
                friendUid: currentUser.uid,
                friendName: currentUser.displayName || 'New Friend',
                friendEmail: currentUser.email || '',
                friendPhotoURL: currentUser.photoURL || '',
                addedAt: serverTimestamp()
              });
            }
            localStorage.removeItem('invite-referrer');
          } catch (err) {
            console.warn('Auto-friend from invite failed:', err);
            // Don't block app load — remove the referrer to avoid retrying
            localStorage.removeItem('invite-referrer');
          }
        }

        // ── Email-based invite lookup ─────────────────────────────────────
        // Check for pending invites addressed to this user's email.
        // Creates auto-friendship, shows welcome modal, notifies inviter.
        try {
          const inviteQuery = query(
            collection(db, 'invites'),
            where('inviteeEmail', '==', currentUser.email.toLowerCase()),
            where('status', '==', 'pending')
          );
          const inviteSnap = await getDocs(inviteQuery);
          if (!inviteSnap.empty) {
            // Take the most recent invite
            const inviteDoc = inviteSnap.docs.sort((a, b) =>
              (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0)
            )[0];
            const inviteData = inviteDoc.data();
            const { inviterUid, inviterName, inviterEmail } = inviteData;

            if (inviterUid && inviterUid !== currentUser.uid) {
              // Create bidirectional friendship if not already friends
              const existingFriend = await getDoc(doc(db, 'users', currentUser.uid, 'friends', inviterUid));
              if (!existingFriend.exists()) {
                const inviterProfile = await getDoc(doc(db, 'userProfiles', inviterUid));
                const inviterData = inviterProfile.exists() ? inviterProfile.data() : {};
                await setDoc(doc(db, 'users', currentUser.uid, 'friends', inviterUid), {
                  friendUid: inviterUid,
                  friendName: inviterData.displayName || inviterName || 'Friend',
                  friendEmail: inviterData.email || inviterEmail || '',
                  friendPhotoURL: inviterData.photoURL || '',
                  addedAt: serverTimestamp(),
                });
                await setDoc(doc(db, 'users', inviterUid, 'friends', currentUser.uid), {
                  friendUid: currentUser.uid,
                  friendName: currentUser.displayName || 'New Friend',
                  friendEmail: currentUser.email || '',
                  friendPhotoURL: currentUser.photoURL || '',
                  addedAt: serverTimestamp(),
                });
              }

              // Mark invite as accepted
              await setDoc(doc(db, 'invites', inviteDoc.id), { status: 'accepted' }, { merge: true });

              // Show welcome modal to the new user
              setWelcomeState({ inviterName: inviterName || 'your friend', inviterUid });

              // Notify inviter via email
              if (inviterEmail) {
                const newUserFirstName = (currentUser.displayName || 'Your friend').split(' ')[0];
                fetch('/.netlify/functions/send-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: inviterEmail,
                    subject: `${newUserFirstName} joined mysetlists.net via your invite! 🎉`,
                    html: `
                      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
                        <h2 style="color:#10b981">Your invite worked! 🎉</h2>
                        <p><strong>${currentUser.displayName || 'Your friend'}</strong> just joined mysetlists.net via your invite link — you're now friends on the app!</p>
                        <p style="margin:24px 0">
                          <a href="https://mysetlists.net" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
                            Go to mysetlists.net →
                          </a>
                        </p>
                        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
                        <p style="color:#94a3b8;font-size:12px">mysetlists.net — track every show you've ever been to</p>
                      </div>
                    `,
                  }),
                }).catch(() => {}); // fire-and-forget
              }
            }
          }
        } catch (err) {
          console.warn('Email invite lookup failed:', err);
        }

        // ── Pending email tags lookup ─────────────────────────────────────
        // Check for show tags sent to this email before the user existed.
        try {
          const tagQuery = query(
            collection(db, 'pendingEmailTags'),
            where('toEmail', '==', currentUser.email.toLowerCase()),
            where('status', '==', 'pending')
          );
          const tagSnap = await getDocs(tagQuery);
          if (!tagSnap.empty) {
            setPendingTagsForReview(
              tagSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            );
          }
        } catch (err) {
          console.warn('Pending email tags lookup failed:', err);
        }

      } else if (guestMode) {
        loadGuestShows();
      } else {
        setShows([]);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [checkForLocalData, loadShows, guestMode, loadGuestShows]);

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
      localStorage.removeItem('guest-shows');
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

  // Auth modal handlers
  const openAuthModal = (mode) => setAuthModal(mode);
  const closeAuthModal = () => setAuthModal(null);
  const switchAuthMode = (mode) => setAuthModal(mode);
  const handleAuthSuccess = () => setAuthModal(null);

  // Enter guest mode
  const enterGuestMode = async () => {
    setGuestMode(true);
    loadGuestShows();

    // Track guest trial session in Firestore
    try {
      let sessionId = localStorage.getItem('guest-session-id');
      if (!sessionId) {
        const sessionDoc = await addDoc(collection(db, 'guestSessions'), {
          startedAt: serverTimestamp(),
          converted: false,
          showsAdded: 0,
          userAgent: navigator.userAgent,
        });
        sessionId = sessionDoc.id;
        localStorage.setItem('guest-session-id', sessionId);
      }
    } catch (error) {
      console.log('Failed to track guest session:', error);
    }
  };

  const saveShow = async (updatedShow) => {
    if (guestMode) {
      // Save to localStorage for guest users
      const updatedShows = shows.map(s => s.id === updatedShow.id ? updatedShow : s);
      saveGuestShows(updatedShows);
      return;
    }
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
    const showId = Date.now().toString();
    const newShow = {
      ...showData,
      id: showId,
      setlist: showData.setlist || [],
      createdAt: new Date().toISOString(),
      isManual: !showData.setlistfmId
    };

    const isFirstShow = shows.length === 0;

    if (guestMode) {
      // Guest mode: save to localStorage
      const updatedShows = [...shows, newShow];
      setShows(updatedShows);
      saveGuestShows(updatedShows);
      setShowForm(false);

      // Update guest session showsAdded count
      try {
        const sessionId = localStorage.getItem('guest-session-id');
        if (sessionId) {
          await updateDoc(doc(db, 'guestSessions', sessionId), { showsAdded: updatedShows.length });
        }
      } catch (error) {
        console.log('Failed to update guest session:', error);
      }

      // Show prompt to create account after first show
      if (isFirstShow) {
        setShowCelebration(true);
        setTimeout(() => {
          setShowCelebration(false);
          setShowGuestPrompt(true);
        }, 2000);
      }
      return showId;
    }

    if (!user) return null;

    try {
      const showRef = doc(db, 'users', user.uid, 'shows', showId);
      const { id, ...showDataWithoutId } = newShow;
      await setDoc(showRef, { ...showDataWithoutId, createdAt: serverTimestamp() });
      const updatedShows = [...shows, newShow];
      setShows(updatedShows);
      setShowForm(false);

      // Celebrate first show!
      if (isFirstShow) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
      }

      // Update profile and community stats
      await updateUserProfile(user, updatedShows);
      updateCommunityStats();
      calculateUserRank(user.uid, updatedShows.length);

      // Background suggestion check — non-blocking
      checkShowSuggestionsForNewShow(newShow).catch(() => {});

      return showId;
    } catch (error) {
      console.error('Failed to add show:', error);
      alert('Failed to add show. Please try again.');
      return null;
    }
  };

  const updateShowData = async (showId, updates) => {
    if (guestMode) {
      const updatedShows = shows.map(s => s.id === showId ? { ...s, ...updates } : s);
      setShows(updatedShows);
      saveGuestShows(updatedShows);
      return;
    }
    if (!user) return;
    try {
      const showRef = doc(db, 'users', user.uid, 'shows', showId);
      await updateDoc(showRef, updates);
      setShows(prev => prev.map(s => s.id === showId ? { ...s, ...updates } : s));
    } catch (error) {
      console.error('Failed to update show data:', error);
    }
  };

  const scanForMissingSetlists = async () => {
    const showsWithoutSetlists = shows.filter(s => !s.setlist || s.setlist.length === 0);
    if (showsWithoutSetlists.length === 0) {
      alert('All your shows already have setlists!');
      return;
    }

    setSetlistScanning(true);
    setSetlistScanProgress({ current: 0, total: showsWithoutSetlists.length, found: 0 });
    let found = 0;

    // Helper to search setlist.fm with pagination support
    const searchAndMatch = async (searchArtist, date, year) => {
      // Search up to 3 pages for a date match
      for (let page = 1; page <= 3; page++) {
        const params = new URLSearchParams({ artistName: searchArtist, year, p: String(page) });
        const response = await fetch(`/.netlify/functions/search-setlists?${params.toString()}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.setlist || data.setlist.length === 0) return null;

        const match = data.setlist.find(s => {
          if (!s.eventDate) return false;
          const parts = s.eventDate.split('-');
          if (parts.length !== 3) return false;
          return `${parts[2]}-${parts[1]}-${parts[0]}` === date;
        });

        if (match) return match;

        // If fewer than 20 results, no more pages
        if (data.setlist.length < 20) break;

        // Rate limit between pages
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return null;
    };

    // Helper to extract songs from a setlist match
    const extractSongs = (match) => {
      const songs = [];
      let setIndex = 0;
      if (match.sets && match.sets.set) {
        match.sets.set.forEach(set => {
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
      return songs;
    };

    for (let i = 0; i < showsWithoutSetlists.length; i++) {
      const show = showsWithoutSetlists[i];
      try {
        if (!show.artist || !show.date) continue;
        const year = show.date.split('-')[0];

        // Try original artist name
        let match = await searchAndMatch(show.artist, show.date, year);

        // Try with "&" replaced by "and"
        if (!match && show.artist.includes('&')) {
          await new Promise(resolve => setTimeout(resolve, 300));
          match = await searchAndMatch(show.artist.replace(/&/g, 'and'), show.date, year);
        }

        // Try removing/adding "The" prefix
        if (!match) {
          await new Promise(resolve => setTimeout(resolve, 300));
          if (show.artist.toLowerCase().startsWith('the ')) {
            match = await searchAndMatch(show.artist.substring(4), show.date, year);
          } else {
            match = await searchAndMatch('The ' + show.artist, show.date, year);
          }
        }

        if (match) {
          const songs = extractSongs(match);
          if (songs.length > 0) {
            const updates = { setlist: songs, setlistfmId: match.id, isManual: false };
            if (match.tour) updates.tour = match.tour.name;
            await updateShowData(show.id, updates);
            found++;
          }
        }
      } catch (err) {
        console.warn('Setlist scan error for', show.artist, err);
      }

      setSetlistScanProgress({ current: i + 1, total: showsWithoutSetlists.length, found });

      // Rate limiting between shows
      if (i < showsWithoutSetlists.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setSetlistScanning(false);
    if (found > 0) {
      alert(`Found ${found} new setlist${found !== 1 ? 's' : ''}!`);
    } else {
      alert('No new setlists found. Some shows may not have setlists on setlist.fm yet.');
    }
  };

  const deleteShow = async (showId) => {
    if (!window.confirm('Delete this show?')) return;

    if (guestMode) {
      const updatedShows = shows.filter(s => s.id !== showId);
      setShows(updatedShows);
      saveGuestShows(updatedShows);
      if (selectedShow?.id === showId) setSelectedShow(null);
      return;
    }

    if (!user) return;

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

  // === FRIEND FUNCTIONS ===

  const sendFriendRequest = async (targetUid, targetName, targetEmail) => {
    if (!user || targetUid === user.uid) {
      alert('You cannot send a friend request to yourself.');
      return;
    }

    try {
      // Check if already friends
      const friendRef = doc(db, 'users', user.uid, 'friends', targetUid);
      const existingFriend = await getDoc(friendRef);
      if (existingFriend.exists()) {
        alert('You are already friends with this user.');
        return;
      }

      // Check for existing pending requests (skip if collection read fails — new collection may not have rules yet)
      try {
        const allRequests = await getDocs(collection(db, 'friendRequests'));
        const pendingFromUs = allRequests.docs.find(d => {
          const data = d.data();
          return data.from === user.uid && data.to === targetUid && data.status === 'pending';
        });
        if (pendingFromUs) {
          alert('Friend request already sent.');
          return;
        }

        const pendingFromThem = allRequests.docs.find(d => {
          const data = d.data();
          return data.from === targetUid && data.to === user.uid && data.status === 'pending';
        });
        if (pendingFromThem) {
          await acceptFriendRequest(pendingFromThem.id);
          return;
        }
      } catch (readError) {
        // Collection may not exist yet or security rules may block reads — proceed with creating the request
        console.log('Could not check existing requests, proceeding:', readError.message);
      }

      await addDoc(collection(db, 'friendRequests'), {
        from: user.uid,
        to: targetUid,
        fromName: user.displayName || 'Anonymous',
        fromEmail: user.email || '',
        toName: targetName || '',
        toEmail: targetEmail || '',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('Friend request sent!');
    } catch (error) {
      console.error('Failed to send friend request:', error);
      alert('Failed to send friend request. Check the browser console for details — you may need to update Firestore security rules to allow the "friendRequests" collection.');
    }
  };

  const sendFriendRequestByEmail = async (email) => {
    if (!user) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail === user.email?.toLowerCase()) {
      alert('You cannot send a friend request to yourself.');
      return;
    }

    try {
      // Load all profiles and match case-insensitively (Firestore where() is case-sensitive)
      const profilesSnapshot = await getDocs(collection(db, 'userProfiles'));
      const matchingProfile = profilesSnapshot.docs.find(d =>
        d.data().email?.toLowerCase() === trimmedEmail
      );
      if (!matchingProfile) {
        alert('No user found with that email address. They may need to sign up first.');
        return;
      }
      await sendFriendRequest(matchingProfile.id, matchingProfile.data().displayName, matchingProfile.data().email);
    } catch (error) {
      console.error('Failed to find user or send request:', error);
      alert('Something went wrong. Check the browser console (F12) for details — this may be a Firestore permissions issue with new collections.');
    }
  };

  const acceptFriendRequest = async (requestId) => {
    if (!user) return;
    try {
      const reqRef = doc(db, 'friendRequests', requestId);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) return;
      const reqData = reqSnap.data();

      // Update request status
      await setDoc(reqRef, { status: 'accepted' }, { merge: true });

      // Create friend doc for current user
      const myFriendRef = doc(db, 'users', user.uid, 'friends', reqData.from);
      await setDoc(myFriendRef, {
        friendUid: reqData.from,
        friendName: reqData.fromName,
        friendEmail: reqData.fromEmail,
        friendPhotoURL: '',
        addedAt: serverTimestamp()
      });

      // Create friend doc for the sender
      const theirFriendRef = doc(db, 'users', reqData.from, 'friends', user.uid);
      await setDoc(theirFriendRef, {
        friendUid: user.uid,
        friendName: user.displayName || 'Anonymous',
        friendEmail: user.email || '',
        friendPhotoURL: user.photoURL || '',
        addedAt: serverTimestamp()
      });

      await loadFriends();
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      alert('Failed to accept friend request. Please try again.');
    }
  };

  const declineFriendRequest = async (requestId) => {
    try {
      const reqRef = doc(db, 'friendRequests', requestId);
      await setDoc(reqRef, { status: 'declined' }, { merge: true });
    } catch (error) {
      console.error('Failed to decline friend request:', error);
    }
  };

  const removeFriend = async (friendUid) => {
    if (!user) return;
    if (!window.confirm('Remove this friend?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'friends', friendUid));
      await deleteDoc(doc(db, 'users', friendUid, 'friends', user.uid));
      setFriends(prev => prev.filter(f => f.friendUid !== friendUid));
    } catch (error) {
      console.error('Failed to remove friend:', error);
    }
  };

  // === SHOW TAGGING FUNCTIONS ===

  const sanitizeShowForTag = (show) => ({
    artist: show.artist,
    venue: show.venue,
    date: show.date,
    city: show.city || '',
    tour: show.tour || '',
    setlistfmId: show.setlistfmId || null,
    isManual: show.isManual || false,
    setlist: (show.setlist || []).map(song => ({
      id: song.id,
      name: song.name,
    }))
  });

  const tagFriendsAtShow = async (show, selectedFriendUids) => {
    if (!user || selectedFriendUids.length === 0) return;
    const sanitizedShow = sanitizeShowForTag(show);
    try {
      const batch = writeBatch(db);
      for (const friendUid of selectedFriendUids) {
        const ref = doc(collection(db, 'showTags'));
        batch.set(ref, {
          fromUid: user.uid,
          fromName: user.displayName || 'Anonymous',
          toUid: friendUid,
          showData: sanitizedShow,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }
      await batch.commit();
      setTagFriendsShow(null);
      setToast(`Tagged ${selectedFriendUids.length} friend${selectedFriendUids.length !== 1 ? 's' : ''} at ${show.artist}!`);
    } catch (error) {
      console.error('Failed to tag friends:', error);
      alert('Failed to tag friends. Please try again.');
    }
  };

  // === SHOWS TOGETHER ===

  const getShowsTogether = async (friendUid) => {
    const [mySnap, theirSnap] = await Promise.all([
      getDocs(collection(db, 'users', user.uid, 'shows')),
      getDocs(collection(db, 'users', friendUid, 'shows')),
    ]);
    const myShows = mySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const theirShows = theirSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const norm = s => (s || '').trim().toLowerCase();
    const key = s => s.setlistfmId || `${norm(s.artist)}|${norm(s.venue)}|${norm(s.date)}`;
    const theirKeys = new Set(theirShows.map(key));
    return myShows.filter(s => theirKeys.has(key(s)));
  };

  // === SHOW SUGGESTIONS ===
  // Proactive "were you there together?" prompts when friends have the same show.
  // Collection: showSuggestions/{uid1}_{uid2}_{normalizedShowKey}
  // uid1 < uid2 alphabetically guarantees exactly one doc per pair+show.

  const normalizeShowKey = (show) => {
    const norm = v => (v || '').trim().toLowerCase();
    return show.setlistfmId || `${norm(show.artist)}|${norm(show.venue)}|${norm(show.date)}`;
  };

  const buildSuggestionDocId = (uid1raw, uid2raw, showKey) => {
    const [uid1, uid2] = [uid1raw, uid2raw].sort();
    return `${uid1}_${uid2}_${showKey.replace(/[^a-z0-9]/g, '_').slice(0, 80)}`;
  };

  // Create a suggestion doc if one doesn't already exist for this pair + show.
  const createShowSuggestion = async (friendUid, friendName, show) => {
    if (!user) return;
    const showKey = normalizeShowKey(show);
    const [uid1, uid2] = [user.uid, friendUid].sort();
    const docId = buildSuggestionDocId(uid1, uid2, showKey);
    const ref = doc(db, 'showSuggestions', docId);
    try {
      const existing = await getDoc(ref);
      if (existing.exists()) return; // already suggested — don't overwrite responses
      const myName = user.displayName || 'Someone';
      const name1 = uid1 === user.uid ? myName : friendName;
      const name2 = uid2 === user.uid ? myName : friendName;
      await setDoc(ref, {
        participants: [uid1, uid2],
        names: { [uid1]: name1, [uid2]: name2 },
        showKey,
        showData: {
          artist: show.artist || '',
          venue: show.venue || '',
          date: show.date || '',
          city: show.city || '',
          setlistfmId: show.setlistfmId || null,
        },
        responses: { [uid1]: 'pending', [uid2]: 'pending' },
        overallStatus: 'pending',
        emailSentToUid: null,
        emailSentAt: null,
        lastViewedAt: { [uid1]: null, [uid2]: null },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to create show suggestion:', e);
    }
  };

  // Called right after addShow() succeeds — checks all friends for a matching show.
  const checkShowSuggestionsForNewShow = async (newShow) => {
    if (!user || guestMode || friends.length === 0) return;
    const showKey = normalizeShowKey(newShow);
    for (const friend of friends) {
      try {
        const theirSnap = await getDocs(collection(db, 'users', friend.friendUid, 'shows'));
        const hasMatch = theirSnap.docs.some(d => {
          const s = d.data();
          return normalizeShowKey(s) === showKey;
        });
        if (hasMatch) {
          await createShowSuggestion(friend.friendUid, friend.friendName, newShow);
        }
      } catch (e) {
        console.error('Suggestion check error for friend:', friend.friendUid, e);
      }
    }
  };

  // Retroactive scan — runs once ever per user (localStorage flag).
  // Checks all existing shows against all friends and creates missing suggestions.
  const runRetroactiveSuggestionScan = async () => {
    if (!user || guestMode || friends.length === 0 || shows.length === 0) return;
    const flagKey = `suggestionScan_${user.uid}`;
    if (localStorage.getItem(flagKey)) return; // already done
    try {
      // Load all existing suggestion IDs in one query to avoid re-creating
      const existingSnap = await getDocs(
        query(collection(db, 'showSuggestions'), where('participants', 'array-contains', user.uid))
      );
      const existingIds = new Set(existingSnap.docs.map(d => d.id));
      for (const friend of friends) {
        try {
          const theirSnap = await getDocs(collection(db, 'users', friend.friendUid, 'shows'));
          const theirShows = theirSnap.docs.map(d => d.data());
          const theirKeySet = new Set(theirShows.map(s => normalizeShowKey(s)));
          for (const myShow of shows) {
            const showKey = normalizeShowKey(myShow);
            if (!theirKeySet.has(showKey)) continue;
            const docId = buildSuggestionDocId(user.uid, friend.friendUid, showKey);
            if (existingIds.has(docId)) continue;
            await createShowSuggestion(friend.friendUid, friend.friendName, myShow);
            existingIds.add(docId);
          }
        } catch (e) {
          console.error('Retroactive scan error for friend:', friend.friendUid, e);
        }
      }
      localStorage.setItem(flagKey, '1');
    } catch (e) {
      console.error('Retroactive suggestion scan failed:', e);
    }
  };

  // User responds to a suggestion: 'confirmed' or 'declined'.
  const respondToSuggestion = async (suggestion, response) => {
    if (!user) return;
    const friendUid = suggestion.participants.find(uid => uid !== user.uid);
    const theirResponse = suggestion.responses?.[friendUid];
    let newOverallStatus;
    if (response === 'declined') {
      newOverallStatus = 'declined';
    } else if (theirResponse === 'confirmed') {
      newOverallStatus = 'confirmed';
    } else {
      newOverallStatus = 'partially_confirmed';
    }
    const ref = doc(db, 'showSuggestions', suggestion.id);
    try {
      await updateDoc(ref, {
        [`responses.${user.uid}`]: response,
        overallStatus: newOverallStatus,
        updatedAt: serverTimestamp(),
      });
      // Send email nudge when we confirm and friend hasn't responded yet
      if (response === 'confirmed' && theirResponse === 'pending' && !suggestion.emailSentToUid) {
        const friendData = friends.find(f => f.friendUid === friendUid);
        if (friendData?.friendEmail) {
          const friendName = suggestion.names?.[friendUid] || 'your friend';
          const { artist, venue, date } = suggestion.showData;
          await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: friendData.friendEmail,
              subject: `${user.displayName || 'A friend'} thinks you were both at ${artist}!`,
              html: `<p>Hey ${friendName},</p><p><strong>${user.displayName || 'A friend'}</strong> confirmed they were at <strong>${artist}</strong> at ${venue} on ${date} — and thinks you might have been there too. Were you there together?</p><p><a href="https://mysetlists.net/?view=friends">Open MySetlists to confirm or dismiss</a></p>`,
            }),
          });
          await updateDoc(ref, { emailSentToUid: friendUid, emailSentAt: serverTimestamp() });
        }
      }
    } catch (e) {
      console.error('Failed to respond to suggestion:', e);
    }
  };

  // === SHARED MEMORIES ===
  // Comment threads on confirmed shared shows (overallStatus === 'confirmed').
  // Stored as: showSuggestions/{suggestionId}/comments/{commentId}

  const loadSharedComments = async (suggestionId) => {
    setCommentsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'showSuggestions', suggestionId, 'comments'));
      const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      comments.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setSharedComments(comments);
    } catch (e) {
      console.error('Failed to load shared comments:', e);
    }
    setCommentsLoading(false);
  };

  const openMemories = async (suggestion) => {
    const show = shows.find(s => normalizeShowKey(s) === suggestion.showKey) ||
                 { artist: suggestion.showData.artist, venue: suggestion.showData.venue, date: suggestion.showData.date };
    setMemoriesShow({ suggestion, show });
    await loadSharedComments(suggestion.id);
    // Mark this thread as viewed so the unread dot clears
    try {
      await updateDoc(doc(db, 'showSuggestions', suggestion.id), {
        [`lastViewedAt.${user.uid}`]: serverTimestamp(),
      });
    } catch (e) { /* non-critical */ }
  };

  const addSharedComment = async (suggestionId, text, suggestion) => {
    if (!user || !text.trim()) return;
    try {
      const commentRef = await addDoc(collection(db, 'showSuggestions', suggestionId, 'comments'), {
        authorUid: user.uid,
        authorName: user.displayName || 'Someone',
        text: text.trim().slice(0, 500),
        createdAt: serverTimestamp(),
        editedAt: null,
      });
      // Reload comments locally
      setSharedComments(prev => [...prev, {
        id: commentRef.id,
        authorUid: user.uid,
        authorName: user.displayName || 'Someone',
        text: text.trim().slice(0, 500),
        createdAt: { seconds: Date.now() / 1000 },
        editedAt: null,
      }]);
      // Email the other participant if they haven't been notified recently
      const otherUid = suggestion.participants.find(uid => uid !== user.uid);
      const otherLastViewed = suggestion.lastViewedAt?.[otherUid];
      const shouldEmail = !otherLastViewed; // email only if they've never opened Memories (first comment ever)
      if (shouldEmail) {
        const friendData = friends.find(f => f.friendUid === otherUid);
        if (friendData?.friendEmail) {
          const { artist, date } = suggestion.showData;
          await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: friendData.friendEmail,
              subject: `${user.displayName || 'A friend'} added a memory from ${artist}`,
              html: `<p><strong>${user.displayName || 'A friend'}</strong> added a comment to your shared memory of <strong>${artist}</strong> (${date}).</p><p><a href="https://mysetlists.net/?view=friends">Open MySetlists to see and reply</a></p>`,
            }),
          });
        }
      }
    } catch (e) {
      console.error('Failed to add comment:', e);
    }
  };

  const editSharedComment = async (suggestionId, commentId, newText) => {
    try {
      await updateDoc(doc(db, 'showSuggestions', suggestionId, 'comments', commentId), {
        text: newText.trim().slice(0, 500),
        editedAt: serverTimestamp(),
      });
      setSharedComments(prev => prev.map(c => c.id === commentId ? { ...c, text: newText.trim(), editedAt: { seconds: Date.now() / 1000 } } : c));
    } catch (e) { console.error('Failed to edit comment:', e); }
  };

  const deleteSharedComment = async (suggestionId, commentId) => {
    try {
      await deleteDoc(doc(db, 'showSuggestions', suggestionId, 'comments', commentId));
      setSharedComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) { console.error('Failed to delete comment:', e); }
  };

  const acceptShowTag = async (tagId) => {
    if (!user) return;
    try {
      const tagRef = doc(db, 'showTags', tagId);
      const tagSnap = await getDoc(tagRef);
      if (!tagSnap.exists()) return;
      const tagData = tagSnap.data();

      await addShow({
        ...tagData.showData,
        taggedBy: tagData.fromName,
        taggedByUid: tagData.fromUid
      });

      await setDoc(tagRef, { status: 'accepted' }, { merge: true });
    } catch (error) {
      console.error('Failed to accept show tag:', error);
      alert('Failed to import tagged show. Please try again.');
    }
  };

  const declineShowTag = async (tagId) => {
    try {
      const tagRef = doc(db, 'showTags', tagId);
      await setDoc(tagRef, { status: 'declined' }, { merge: true });
    } catch (error) {
      console.error('Failed to decline show tag:', error);
    }
  };

  // Bulk accept all pending show tags + suggestions
  const bulkAcceptAll = async (tags, suggestions) => {
    const results = await Promise.allSettled([
      ...tags.map(tag => acceptShowTag(tag.id)),
      ...suggestions.map(s => respondToSuggestion(s, 'confirmed')),
    ]);
    const accepted = results.filter(r => r.status === 'fulfilled').length;
    setToast(`Accepted ${accepted} pending item${accepted !== 1 ? 's' : ''}`);
  };

  // Bulk accept pending items from a specific friend
  const bulkAcceptFromFriend = async (friendUid, tags, suggestions) => {
    const friendTags = tags.filter(t => t.fromUid === friendUid);
    const friendSuggestions = suggestions.filter(s => s.participants?.includes(friendUid));
    const results = await Promise.allSettled([
      ...friendTags.map(tag => acceptShowTag(tag.id)),
      ...friendSuggestions.map(s => respondToSuggestion(s, 'confirmed')),
    ]);
    const accepted = results.filter(r => r.status === 'fulfilled').length;
    setToast(`Accepted ${accepted} item${accepted !== 1 ? 's' : ''}`);
  };

  // Accept a pending email tag (new user confirming a show tagged before they joined)
  const acceptPendingEmailTag = async (tag) => {
    if (!user) return;
    try {
      await addShow({ ...tag.showData, taggedBy: tag.fromName, taggedByUid: tag.fromUid });
      await setDoc(doc(db, 'pendingEmailTags', tag.id), { status: 'accepted' }, { merge: true });
      // Notify the tagger
      if (tag.fromEmail) {
        const newUserFirstName = (user.displayName || 'Your friend').split(' ')[0];
        fetch('/.netlify/functions/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: tag.fromEmail,
            subject: `${newUserFirstName} confirmed they were at ${tag.showData.artist} with you! 🎶`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
                <h2 style="color:#10b981">They were there! 🎶</h2>
                <p><strong>${user.displayName || 'Your friend'}</strong> just confirmed they were at
                <strong>${tag.showData.artist}</strong>${tag.showData.venue ? ` at ${tag.showData.venue}` : ''}${tag.showData.date ? ` on ${formatDate(tag.showData.date)}` : ''} with you!</p>
                <p>The show has been added to their setlist history on mysetlists.net.</p>
                <p style="margin:24px 0">
                  <a href="https://mysetlists.net" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
                    View their profile →
                  </a>
                </p>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
                <p style="color:#94a3b8;font-size:12px">mysetlists.net — track every show you've ever been to</p>
              </div>
            `,
          }),
        }).catch(() => {});
      }
      setPendingTagsForReview(prev => prev.filter(t => t.id !== tag.id));
    } catch (error) {
      console.error('Failed to accept pending email tag:', error);
    }
  };

  const declinePendingEmailTag = async (tag) => {
    try {
      await setDoc(doc(db, 'pendingEmailTags', tag.id), { status: 'declined' }, { merge: true });
      setPendingTagsForReview(prev => prev.filter(t => t.id !== tag.id));
    } catch (error) {
      console.error('Failed to decline pending email tag:', error);
    }
  };

  // Tag a non-registered friend at a show and send them an invite email
  const tagFriendByEmail = async ({ name, email: toEmailRaw, message, show }) => {
    if (!user) return;
    const toEmail = toEmailRaw.trim().toLowerCase();
    const sanitizedShow = sanitizeShowForTag(show);
    try {
      await addDoc(collection(db, 'pendingEmailTags'), {
        fromUid: user.uid,
        fromName: user.displayName || 'Anonymous',
        fromEmail: user.email || '',
        toEmail,
        toName: name,
        showData: sanitizedShow,
        personalMessage: message || null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      const inviterName = user.displayName || 'A friend';
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
          <h2 style="color:#10b981">${inviterName} tagged you in a show! 🎵</h2>
          <p><strong>${inviterName}</strong> saw <strong>${sanitizedShow.artist}</strong>${sanitizedShow.venue ? ` at ${sanitizedShow.venue}` : ''}${sanitizedShow.date ? ` on ${formatDate(sanitizedShow.date)}` : ''} and thinks you were there too!</p>
          ${message ? `<blockquote style="border-left:3px solid #10b981;padding-left:16px;color:#475569;font-style:italic;margin:16px 0">${message}</blockquote>` : ''}
          <p>Join mysetlists.net to confirm the show and add it to your concert history:</p>
          <p style="margin:24px 0">
            <a href="https://mysetlists.net?ref=${user.uid}" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Join mysetlists.net →
            </a>
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">mysetlists.net — track every show you've ever been to</p>
        </div>
      `;
      await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          subject: `${inviterName} tagged you in a show on mysetlists.net!`,
          html,
        }),
      });
    } catch (error) {
      console.error('Failed to tag friend by email:', error);
      throw error; // let TagFriendsModal surface the error
    }
  };

  // === NOTIFICATION MANAGEMENT ===

  // Mark all unread notifications as read (called when user opens Feedback view)
  const markNotificationsRead = useCallback(async () => {
    if (!user || unreadNotifications.length === 0) return;
    const batch = writeBatch(db);
    unreadNotifications.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit().catch(() => {});
  }, [user, unreadNotifications]);

  // === INVITE MANAGEMENT FUNCTIONS ===

  const loadInviteStats = async (uid) => {
    if (!uid) return;
    try {
      const snap = await getDocs(query(collection(db, 'invites'), where('inviterUid', '==', uid)));
      const docs = snap.docs.map(d => d.data());
      setInviteStats({
        total: docs.length,
        accepted: docs.filter(d => d.status === 'accepted').length,
      });
    } catch (err) {
      console.log('Failed to load invite stats:', err);
    }
  };

  const sendInvite = async (email) => {
    if (!user) return { error: 'Not signed in' };
    const toEmail = email.trim().toLowerCase();

    // Guard: duplicate pending invite to same email
    const existing = pendingInvites.find(inv => inv.inviteeEmail === toEmail);
    if (existing) {
      return { error: 'You already have a pending invite for this email. You can resend it from the Friends \u2192 Invites tab.' };
    }

    try {
      const inviterDisplayName = user.displayName || 'A friend';
      const inviteUrl = `https://mysetlists.net?ref=${user.uid}`;
      await addDoc(collection(db, 'invites'), {
        inviterUid: user.uid,
        inviterName: inviterDisplayName,
        inviterEmail: user.email || '',
        inviteeEmail: toEmail,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
          <h2 style="color:#10b981">Hey! ${inviterDisplayName} wants you to join mysetlists.net \uD83C\uDFB5</h2>
          <p>${inviterDisplayName} has been tracking all their concerts on mysetlists.net \u2014 saving setlists, rating songs, and seeing their all-time stats. They think you'd love it too.</p>
          <p style="margin:24px 0">
            <a href="${inviteUrl}" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Join mysetlists.net \u2192
            </a>
          </p>
          <p style="color:#64748b;font-size:14px">When you sign up, you and ${inviterDisplayName} will automatically be friends on the app.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">mysetlists.net \u2014 track every show you've ever been to</p>
        </div>
      `;
      await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          subject: `${inviterDisplayName} invited you to mysetlists.net!`,
          html,
        }),
      });
      loadInviteStats(user.uid);
      return { success: true };
    } catch (err) {
      console.error('Invite send failed:', err);
      return { error: 'Failed to send invite. Please try again.' };
    }
  };

  const resendInvite = async (invite) => {
    if (!user) return;
    // 24-hour throttle — check lastSentAt, fall back to createdAt
    const lastSent = invite.lastSentAt?.toMillis?.() ?? invite.createdAt?.toMillis?.() ?? 0;
    if (Date.now() - lastSent < 24 * 60 * 60 * 1000) {
      setToast('You can only resend to the same person once per 24 hours.');
      return false;
    }
    try {
      const inviterDisplayName = user.displayName || 'A friend';
      const inviteUrl = `https://mysetlists.net?ref=${user.uid}`;
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
          <h2 style="color:#10b981">Hey! ${inviterDisplayName} wants you to join mysetlists.net \uD83C\uDFB5</h2>
          <p>${inviterDisplayName} has been tracking all their concerts on mysetlists.net \u2014 saving setlists, rating songs, and seeing their all-time stats. They think you'd love it too.</p>
          <p style="margin:24px 0">
            <a href="${inviteUrl}" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Join mysetlists.net \u2192
            </a>
          </p>
          <p style="color:#64748b;font-size:14px">When you sign up, you and ${inviterDisplayName} will automatically be friends on the app.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">mysetlists.net \u2014 track every show you've ever been to</p>
        </div>
      `;
      const res = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: invite.inviteeEmail,
          subject: `${inviterDisplayName} invited you to mysetlists.net!`,
          html,
        }),
      });
      if (!res.ok) throw new Error('Email send failed');
      await updateDoc(doc(db, 'invites', invite.id), { lastSentAt: serverTimestamp() });
      setToast(`Invite resent to ${invite.inviteeEmail}`);
      return true;
    } catch (err) {
      console.error('Resend invite failed:', err);
      setToast('Failed to resend invite. Please try again.');
      return false;
    }
  };

  const cancelInvite = async (inviteId) => {
    try {
      await deleteDoc(doc(db, 'invites', inviteId));
      // onSnapshot auto-removes from pendingInvites — no manual setState needed
    } catch (err) {
      console.error('Cancel invite failed:', err);
      setToast('Failed to cancel invite. Please try again.');
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
        artistMap[show.artist] = { count: 0, ratings: [], uniqueSongs: new Set() };
      }
      artistMap[show.artist].count++;
      show.setlist.forEach(song => artistMap[show.artist].uniqueSongs.add(song.name.toLowerCase().trim()));
      if (show.rating) artistMap[show.artist].ratings.push(show.rating);
    });
    return Object.entries(artistMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalSongs: data.uniqueSongs.size,
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

  // === VENUE RATING HELPERS ===

  const normalizeVenueKey = (venue, city) =>
    `${(venue || '').trim().toLowerCase()}::${(city || '').trim().toLowerCase()}`;

  const getVenueRatings = async (venueKey) => {
    const snap = await getDocs(query(collection(db, 'venueRatings'), where('venueKey', '==', venueKey)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  const computeVenueAggregate = (ratings) => {
    if (!ratings.length) return null;
    const avg = arr => {
      const valid = arr.filter(v => v != null && v > 0);
      return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };
    return {
      count: ratings.length,
      overallAvg: avg(ratings.map(r => r.overallRating)),
      subAvgs: {
        soundQuality: avg(ratings.map(r => r.subRatings?.soundQuality)),
        sightlines: avg(ratings.map(r => r.subRatings?.sightlines)),
        atmosphere: avg(ratings.map(r => r.subRatings?.atmosphere)),
        accessibility: avg(ratings.map(r => r.subRatings?.accessibility)),
        foodDrinks: avg(ratings.map(r => r.subRatings?.foodDrinks)),
      }
    };
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

  // Show login screen if not authenticated and not in guest mode
  if (!user && !guestMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white">
        {/* Header */}
        <div className="bg-black/20 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <img src="/logo.svg" alt="MySetlists" className="h-11 w-auto" />
              <button
                onClick={() => openAuthModal('login')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white rounded-full font-medium transition-all"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-16">
          <div className="text-center mb-8 md:mb-16">
            <img
              src="/logo.svg"
              alt="MySetlists"
              className="h-24 md:h-32 w-auto mx-auto mb-6 md:mb-8 drop-shadow-2xl"
            />
            <p className="text-lg md:text-xl text-white/70 mb-8 md:mb-10 max-w-xl mx-auto leading-relaxed px-4">
              Save setlists, rate songs, discover patterns in your concert history, and join a community of live music lovers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => openAuthModal('signup')}
                className="inline-flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-full transition-all text-base md:text-lg font-semibold shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
              >
                <Music className="w-5 h-5" />
                Get Started Free
              </button>
              <button
                onClick={enterGuestMode}
                className="inline-flex items-center gap-2 px-6 py-3 md:py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full transition-all text-base font-medium"
              >
                Try it First
              </button>
            </div>
            <p className="mt-4 text-sm text-white/40">
              By creating an account, you agree to our{' '}
              <Link to="/terms" className="text-white/60 hover:text-white/80 underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-white/60 hover:text-white/80 underline">Privacy Policy</Link>.
            </p>
            <div className="mt-6">
              <a
                href="https://buymeacoffee.com/phillipd"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-amber-400 transition-colors"
              >
                <Heart className="w-4 h-4" />
                Support this project
              </a>
            </div>
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

        <Footer />

        {/* Auth Modal */}
        {authModal && (
          <AuthModal
            mode={authModal}
            onClose={closeAuthModal}
            onSwitchMode={switchAuthMode}
            onSuccess={handleAuthSuccess}
          />
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="ml-0 md:ml-64 min-h-screen pt-14 md:pt-0">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-8">
            {/* Skeleton header */}
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-2">
                <div className="h-7 w-32 bg-white/10 rounded-lg animate-pulse" />
                <div className="h-4 w-48 bg-white/10 rounded-lg animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-12 w-40 bg-white/10 rounded-xl animate-pulse" />
                <div className="h-12 w-40 bg-white/10 rounded-xl animate-pulse" />
              </div>
            </div>
            {/* Skeleton cards */}
            <ShowsListSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // Per-view SEO metadata
  const viewMeta = {
    shows:          { title: 'My Shows — MySetlists', description: 'Your personal concert history. View and rate every show you\'ve attended.' },
    stats:          { title: 'Stats — MySetlists', description: 'Dive into your concert stats: top artists, venues, songs, and more.' },
    search:         { title: 'Search Shows — MySetlists', description: 'Search setlist.fm to add shows to your concert history.' },
    friends:        { title: 'Friends — MySetlists', description: 'Connect with friends and share your live music journey.' },
    community:      { title: 'Community — MySetlists', description: 'See how you rank among all MySetlists users.' },
    invite:         { title: 'Invite Friends — MySetlists', description: 'Invite your friends to track shows together on MySetlists.' },
    'scan-import':  { title: 'Scan / Import — MySetlists', description: 'Scan ticket stubs or import your concert history from a file.' },
    profile:        { title: 'Profile — MySetlists', description: 'Your MySetlists profile and account settings.' },
    'release-notes':{ title: 'Release Notes — MySetlists', description: 'What\'s new in MySetlists.' },
    feedback:       { title: 'Feedback — MySetlists', description: 'Share your feedback to help improve MySetlists.' },
    roadmap:        { title: 'Roadmap — MySetlists', description: "See what's coming to MySetlists and vote on features you want most." },
  };
  const currentMeta = viewMeta[activeView] || { title: 'MySetlists — Track Your Concert Journey', description: 'Build your personal concert history with setlists, ratings, and stats.' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <Helmet>
        <title>{currentMeta.title}</title>
        <meta name="description" content={currentMeta.description} />
        <meta property="og:title" content={currentMeta.title} />
        <meta property="og:description" content={currentMeta.description} />
        <meta property="og:url" content="https://mysetlists.net/" />
      </Helmet>

      {/* Migration Prompt Modal */}
      {showMigrationPrompt && (
        <div className="fixed inset-0 md:left-64 bg-black/60 backdrop-blur-xl flex items-center justify-center p-3 md:p-4 z-[60]">
          <div className="bg-slate-800 border border-white/10 rounded-2xl md:rounded-3xl max-w-[95vw] sm:max-w-md w-full p-4 md:p-6 shadow-2xl">
            <h2 className="text-lg md:text-xl font-bold mb-4 text-white">Import Existing Shows?</h2>
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

      {/* First Show Celebration */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-center animate-bounce">
            <div className="text-8xl mb-4">🤙</div>
            <div className="text-2xl font-bold text-white bg-black/50 backdrop-blur-sm px-6 py-3 rounded-2xl">
              First show added!
            </div>
          </div>
        </div>
      )}

      {/* Guest Mode Account Prompt */}
      {showGuestPrompt && (
        <div className="fixed inset-0 md:left-64 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-[60]">
          <div className="bg-slate-800 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Great Start!</h2>
              <p className="text-white/60">
                Your show is saved locally on this device. Create a free account to:
              </p>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-3 text-white/80">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Save your shows permanently in the cloud</span>
              </li>
              <li className="flex items-center gap-3 text-white/80">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Access your collection from any device</span>
              </li>
              <li className="flex items-center gap-3 text-white/80">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Join the community leaderboards</span>
              </li>
            </ul>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowGuestPrompt(false); openAuthModal('signup'); }}
                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/30"
              >
                Create Free Account
              </button>
              <button
                onClick={() => setShowGuestPrompt(false)}
                className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 text-white/70 rounded-xl font-medium transition-colors"
              >
                Maybe Later
              </button>
            </div>
            <p className="text-center text-white/40 text-xs mt-4">
              Your locally saved shows will be imported to your account
            </p>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <MobileHeader onMenuClick={() => setSidebarOpen(true)} />

      {/* Welcome modal — shown once when a new user joins via an invite */}
      {welcomeState && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-emerald-500/30 rounded-2xl w-full max-w-md p-8 shadow-2xl shadow-emerald-500/10 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Music className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Welcome to mysetlists.net! 🎉</h2>
            <p className="text-white/70 leading-relaxed mb-6">
              You joined via <span className="text-emerald-400 font-semibold">{welcomeState.inviterName}</span>'s invite —
              you're already friends on the app. Start adding shows and compare your concert history!
            </p>
            <button
              onClick={() => setWelcomeState(null)}
              className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/25"
            >
              Let's go →
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={(view) => { navigateTo(view); setSelectedArtist(null); }}
        isAdmin={isAdmin}
        onLogout={guestMode ? () => { setGuestMode(false); setShows([]); } : handleLogout}
        userName={guestMode ? 'Guest' : extractFirstName(user?.displayName)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isGuest={guestMode}
        onCreateAccount={() => openAuthModal('signup')}
        pendingNotificationCount={pendingNotificationCount}
        upcomingShowsBadgeCount={upcomingShowsBadgeCount}
      />

      {/* Main Content Area */}
      <div className="ml-0 md:ml-64 min-h-screen pt-14 md:pt-0">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-8">

          {/* Pending email tags review — shown once after signup if shows were tagged */}
          {pendingTagsForReview.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <Tag className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Your friends tagged you in some shows!</h1>
                  <p className="text-white/50 text-sm">Review them and add any to your history.</p>
                </div>
              </div>
              <div className="space-y-4">
                {pendingTagsForReview.map(tag => (
                  <div key={tag.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="text-lg font-bold" style={{ color: '#f59e0b' }}>{tag.showData?.artist}</div>
                        <div className="flex items-center gap-3 text-sm text-white/60 mt-1 flex-wrap">
                          {tag.showData?.date && (
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(tag.showData.date)}</span>
                          )}
                          {tag.showData?.venue && (
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{tag.showData.venue}</span>
                          )}
                          {tag.showData?.city && <span>{tag.showData.city}</span>}
                        </div>
                        <div className="text-sm text-white/40 mt-1">Tagged by {tag.fromName}</div>
                        {tag.personalMessage && (
                          <p className="text-sm text-white/50 italic mt-2">"{tag.personalMessage}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => acceptPendingEmailTag(tag)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl font-medium transition-colors text-sm"
                      >
                        <Check className="w-4 h-4" /> Add to My History
                      </button>
                      <button
                        onClick={() => declinePendingEmailTag(tag)}
                        className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/50 rounded-xl font-medium transition-colors text-sm"
                      >
                        Not Me — Skip
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingTagsForReview.length === 0 && activeView === 'shows' && (
          <>
            {/* Friend request / show tag notification banner */}
            {!guestMode && pendingNotificationCount > 0 && (
              <button
                onClick={() => {
                  setFriendsInitialTab('requests');
                  navigateTo('friends');
                }}
                className="w-full mb-4 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 rounded-xl hover:from-violet-500/30 hover:to-purple-500/30 transition-all group"
              >
                <div className="relative">
                  <Bell className="w-5 h-5 text-violet-400" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                </div>
                <span className="text-white/90 text-sm font-medium">
                  {pendingFriendRequests.length > 0 && pendingShowTags.length > 0
                    ? `You have ${pendingFriendRequests.length} friend request${pendingFriendRequests.length !== 1 ? 's' : ''} and ${pendingShowTags.length} show tag${pendingShowTags.length !== 1 ? 's' : ''}`
                    : pendingFriendRequests.length > 0
                      ? `You have ${pendingFriendRequests.length} pending friend request${pendingFriendRequests.length !== 1 ? 's' : ''}`
                      : `You were tagged in ${pendingShowTags.length} show${pendingShowTags.length !== 1 ? 's' : ''} by friends`
                  }
                </span>
                <ChevronRight className="w-4 h-4 text-violet-400/60 ml-auto group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            {/* Summary stats */}
            {shows.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
                {[
                  { label: 'Shows', value: shows.length, color: 'from-emerald-400 to-teal-400', action: () => {} },
                  { label: 'Songs', value: summaryStats.totalSongs, color: 'from-violet-400 to-purple-400', action: () => { setStatsTab('songs'); navigateTo('stats'); } },
                  { label: 'Artists', value: summaryStats.uniqueArtists, color: 'from-amber-400 to-orange-400', action: () => { setStatsTab('artists'); navigateTo('stats'); } },
                  { label: 'Venues', value: summaryStats.uniqueVenues, color: 'from-cyan-400 to-blue-400', action: () => { setStatsTab('venues'); navigateTo('stats'); } },
                  { label: 'Avg Rating', value: summaryStats.avgRating || '--', color: 'from-pink-400 to-rose-400', action: () => { setStatsTab('top'); navigateTo('stats'); } },
                ].map(stat => (
                  <button key={stat.label} onClick={stat.action} className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 text-center hover:bg-white/15 transition-all cursor-pointer">
                    <div className={`text-xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</div>
                    <div className="text-[10px] font-medium text-white/50 uppercase tracking-wide mt-0.5">{stat.label}</div>
                  </button>
                ))}
                {/* User Rank */}
                {userRank && (
                  <button onClick={() => { navigateTo('community'); }} className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-xl border border-amber-500/30 rounded-xl p-2.5 text-center hover:from-amber-500/30 hover:to-orange-500/30 transition-all cursor-pointer">
                    <div className="flex items-center justify-center gap-1">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <div className="text-xl font-bold text-amber-400">#{userRank.rank}</div>
                    </div>
                    <div className="text-[10px] font-medium text-amber-200/70 uppercase tracking-wide mt-0.5">of {userRank.total}</div>
                  </button>
                )}
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white mb-1">My Shows</h1>
                <p className="text-white/60">All the concerts you've attended</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => navigateTo('search')}
                  className={`relative flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all whitespace-nowrap shadow-lg shadow-emerald-500/25 ${shows.length === 0 ? 'animate-pulse' : ''}`}
                >
                  {shows.length === 0 && (
                    <span className="absolute inset-0 rounded-xl bg-emerald-400 animate-ping opacity-20" />
                  )}
                  <Search className="w-4 h-4" />
                  Search for a Show
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all whitespace-nowrap border border-white/10"
                >
                  <Plus className="w-4 h-4" />
                  Add Manually
                </button>
                <div className="relative">
                  <button
                    onClick={() => navigateTo('scan-import')}
                    className={`flex items-center justify-center gap-2 px-4 py-3 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-xl font-medium transition-all whitespace-nowrap border border-violet-500/30 ${tooltipStep === 1 ? 'ring-2 ring-violet-500/60 ring-offset-2 ring-offset-slate-900' : ''}`}
                  >
                    <Camera className="w-4 h-4" />
                    Scan / Import
                  </button>
                  {tooltipStep === 1 && (
                    <>
                      {/* Desktop: tooltip to the left */}
                      <div className="hidden md:block absolute right-full mr-3 top-1/2 -translate-y-1/2 w-56 z-20 animate-in">
                        <div className="bg-violet-600 border border-violet-400/30 rounded-xl p-3 shadow-xl shadow-violet-500/20 relative">
                          <div className="absolute top-1/2 -translate-y-1/2 -right-2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-violet-600" />
                          <p className="text-white text-xs leading-relaxed mb-2">Scan ticket stubs with AI or import a CSV/Excel file to add shows in bulk</p>
                          <button onClick={dismissTooltip} className="text-violet-200 hover:text-white text-xs font-medium transition-colors">Got it ✓</button>
                        </div>
                      </div>
                      {/* Mobile: tooltip below */}
                      <div className="md:hidden absolute top-full mt-2 left-1/2 -translate-x-1/2 w-56 z-20 animate-in-mobile">
                        <div className="bg-violet-600 border border-violet-400/30 rounded-xl p-3 shadow-xl shadow-violet-500/20 relative">
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-violet-600" />
                          <p className="text-white text-xs leading-relaxed mb-2">Scan ticket stubs with AI or import a CSV/Excel file to add shows in bulk</p>
                          <button onClick={dismissTooltip} className="text-violet-200 hover:text-white text-xs font-medium transition-colors">Got it ✓</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {shows.length > 0 && shows.some(s => !s.setlist || s.setlist.length === 0) && (
                  <button
                    onClick={scanForMissingSetlists}
                    disabled={setlistScanning}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-xl font-medium transition-all whitespace-nowrap border border-violet-500/30 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${setlistScanning ? 'animate-spin' : ''}`} />
                    {setlistScanning ? 'Scanning...' : 'Find Missing Setlists'}
                  </button>
                )}
              </div>
            </div>

            {/* Setlist scanning progress */}
            {setlistScanning && (
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <RefreshCw className="w-5 h-5 text-violet-400 animate-spin" />
                  <span className="text-white font-medium">Scanning for setlists...</span>
                  <span className="text-white/50 text-sm ml-auto">{setlistScanProgress.current} / {setlistScanProgress.total}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-violet-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${setlistScanProgress.total > 0 ? (setlistScanProgress.current / setlistScanProgress.total) * 100 : 0}%` }}
                  />
                </div>
                {setlistScanProgress.found > 0 && (
                  <p className="text-violet-300 text-sm mt-2">{setlistScanProgress.found} setlist{setlistScanProgress.found !== 1 ? 's' : ''} found so far</p>
                )}
              </div>
            )}

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
              <div className="text-center py-12 md:py-16">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                  <Sparkles className="w-12 h-12 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Your Concert Journey Starts Here</h2>
                <p className="text-white/60 mb-6 max-w-md mx-auto">
                  Build your personal concert history with setlists, ratings, and stats.
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-3 mb-8">
                  <button
                    onClick={() => navigateTo('search')}
                    className="relative inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
                  >
                    <span className="absolute inset-0 rounded-xl bg-emerald-400 animate-ping opacity-20" />
                    <Search className="w-5 h-5" />
                    Search for a Show
                  </button>
                  <button
                    onClick={() => navigateTo('import')}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-xl font-semibold transition-all border border-violet-500/30 hover:scale-105"
                  >
                    <Upload className="w-5 h-5" />
                    Bulk Import
                  </button>
                </div>

                <div className="max-w-lg mx-auto bg-white/5 border border-white/10 rounded-2xl p-6 text-left">
                  <h3 className="text-white font-semibold mb-4 text-center">Quick ways to add your shows</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Camera className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-white/90 font-medium text-sm">Screenshot Import</p>
                        <p className="text-white/50 text-xs">Take a screenshot of your Ticketmaster, AXS, or StubHub past events and our AI will extract your shows</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Upload className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white/90 font-medium text-sm">CSV / Excel Import</p>
                        <p className="text-white/50 text-xs">Upload a .csv, .xlsx, or .xls spreadsheet with your concert history</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Search className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white/90 font-medium text-sm">Search setlist.fm</p>
                        <p className="text-white/50 text-xs">Search by artist to find shows with full setlists from setlist.fm</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showForm && (
              <ShowForm
                onSubmit={addShow}
                onCancel={() => setShowForm(false)}
                friends={user && !guestMode ? friends : []}
                onTagFriends={tagFriendsAtShow}
              />
            )}

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

            {selectedShow && (() => {
              const confirmedSuggestion = user && !guestMode
                ? myConfirmedSuggestions.find(s => s.showKey === normalizeShowKey(selectedShow))
                : null;
              return (
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
                  onTagFriends={!guestMode ? (show) => setTagFriendsShow(show) : undefined}
                  onRateVenue={user && !guestMode ? (show) => setVenueRatingShow(show) : undefined}
                  confirmedSuggestion={confirmedSuggestion || null}
                  sharedComments={memoriesShow?.suggestion?.id === confirmedSuggestion?.id ? sharedComments : []}
                  commentsLoading={commentsLoading}
                  onOpenMemories={confirmedSuggestion ? () => openMemories(confirmedSuggestion) : null}
                  onAddComment={confirmedSuggestion ? (text) => addSharedComment(confirmedSuggestion.id, text, confirmedSuggestion) : null}
                  onEditComment={confirmedSuggestion ? (cid, txt) => editSharedComment(confirmedSuggestion.id, cid, txt) : null}
                  onDeleteComment={confirmedSuggestion ? (cid) => deleteSharedComment(confirmedSuggestion.id, cid) : null}
                  currentUserUid={user?.uid}
                />
              );
            })()}

            {tagFriendsShow && (
              <TagFriendsModal
                show={tagFriendsShow}
                friends={friends}
                onTag={(selectedFriendUids) => tagFriendsAtShow(tagFriendsShow, selectedFriendUids)}
                onInviteByEmail={(params) => tagFriendByEmail({ ...params, show: tagFriendsShow })}
                onClose={() => setTagFriendsShow(null)}
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
            onCommentSong={updateSongComment}
            onAddSong={addSongToShow}
            onDeleteSong={deleteSong}
            onRateShow={updateShowRating}
            onCommentShow={updateShowComment}
            onBatchRate={batchRateUnrated}
            initialTab={statsTab}
            onRateVenue={user && !guestMode ? (show) => setVenueRatingShow(show) : undefined}
            fetchVenueRatings={getVenueRatings}
            normalizeVenueKey={normalizeVenueKey}
            computeVenueAggregate={computeVenueAggregate}
          />
        )}

        {activeView === 'search' && (
          <SearchView
            onImport={addShow}
            importedIds={importedIds}
          />
        )}

        {activeView === 'friends' && !guestMode && user && (
          <FriendsView
            user={user}
            friends={friends}
            pendingFriendRequests={pendingFriendRequests}
            sentFriendRequests={sentFriendRequests}
            pendingShowTags={pendingShowTags}
            onSendFriendRequestByEmail={sendFriendRequestByEmail}
            onSendFriendRequest={sendFriendRequest}
            onAcceptFriendRequest={acceptFriendRequest}
            onDeclineFriendRequest={declineFriendRequest}
            onRemoveFriend={removeFriend}
            onAcceptShowTag={acceptShowTag}
            onDeclineShowTag={declineShowTag}
            initialTab={friendsInitialTab}
            getShowsTogether={getShowsTogether}
            showSuggestions={showSuggestions}
            respondToSuggestion={respondToSuggestion}
            openMemories={openMemories}
            pendingInvites={pendingInvites}
            inviteStats={inviteStats}
            onResendInvite={resendInvite}
            onCancelInvite={cancelInvite}
            onBulkAcceptAll={bulkAcceptAll}
            onBulkAcceptFromFriend={bulkAcceptFromFriend}
          />
        )}

        {activeView === 'invite' && !guestMode && (
          <InviteView currentUserUid={user?.uid} currentUser={user} onSendInvite={sendInvite} />
        )}

        {activeView === 'feedback' && (
          <FeedbackView
            user={user}
            onNavigate={navigateTo}
            unreadNotifications={unreadNotifications}
            onMarkRead={markNotificationsRead}
          />
        )}

        {activeView === 'roadmap' && (
          <RoadmapView user={user} />
        )}

        {activeView === 'release-notes' && (
          <ReleaseNotesView />
        )}

        {activeView === 'scan-import' && (
          <ScanImportView
            onImport={addShow}
            onUpdateShow={updateShowData}
            existingShows={shows}
            importedIds={importedIds}
            onNavigate={(view) => {
              navigateTo(view);
              if (view === 'shows' && user && !guestMode) {
                loadShows(user.uid);
              }
            }}
          />
        )}

        {activeView === 'community' && !guestMode && (
          <CommunityStatsView
            communityStats={communityStats}
            onAddFriend={sendFriendRequest}
            currentUserUid={user?.uid}
            currentFriendUids={friendUids}
          />
        )}

        {activeView === 'profile' && !guestMode && user && (
          <ProfileView
            user={user}
            shows={shows}
            userRank={userRank}
            onProfileUpdate={() => {
              // Refresh user data if needed
            }}
          />
        )}

        {activeView === 'admin' && isAdmin && (
          <AdminView />
        )}

        {activeView === 'upcoming-shows' && (
          <UpcomingShowsView
            shows={shows}
            onCountLoaded={(count) => setUpcomingShowsBadgeCount(count > 0 ? count : null)}
          />
        )}
        </div>
      </div>

      <Footer />

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Venue Rating Modal — rendered globally so it works from any view */}
      {venueRatingShow && user && (
        <VenueRatingModal
          show={venueRatingShow}
          currentUser={user}
          onClose={() => setVenueRatingShow(null)}
          onSaved={() => {
            setToast(`Rating saved for ${venueRatingShow.venue}!`);
            setVenueRatingShow(null);
          }}
        />
      )}

      {/* Global toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] px-5 py-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/40 font-medium text-sm animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}

function ShowForm({ onSubmit, onCancel, friends = [], onTagFriends }) {
  const [formData, setFormData] = useState({
    artist: '',
    venue: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [tagOpen, setTagOpen] = useState(false);
  const [selectedTagFriends, setSelectedTagFriends] = useState(new Set());

  const toggleTagFriend = (uid) => {
    setSelectedTagFriends(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.artist && formData.venue && formData.date) {
      await onSubmit(formData);
      if (selectedTagFriends.size > 0 && onTagFriends) {
        await onTagFriends(formData, [...selectedTagFriends]);
      }
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
        {/* Tag Friends accordion (only for logged-in users with friends) */}
        {friends.length > 0 && (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setTagOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-sm"
            >
              <span className="flex items-center gap-2 text-white/70">
                <Tag className="w-4 h-4" />
                Tag friends at this show
                {selectedTagFriends.size > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                    {selectedTagFriends.size} selected
                  </span>
                )}
              </span>
              <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${tagOpen ? 'rotate-180' : ''}`} />
            </button>
            {tagOpen && (
              <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                {friends.map(f => (
                  <label
                    key={f.friendUid}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      selectedTagFriends.has(f.friendUid)
                        ? 'bg-emerald-500/15 border border-emerald-500/30'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={selectedTagFriends.has(f.friendUid)} onChange={() => toggleTagFriend(f.friendUid)} />
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedTagFriends.has(f.friendUid) ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'}`}>
                      {selectedTagFriends.has(f.friendUid) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-white">{f.friendName || f.friendEmail}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
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
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <UpcomingShows artistName={artist} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const TICKET_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms

function normalizeVenueName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function venuesFuzzyMatch(a, b) {
  const na = normalizeVenueName(a);
  const nb = normalizeVenueName(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function mergeTicketEvents(tmEvents, sgEvents) {
  const merged = [];
  const usedSgIndices = new Set();

  tmEvents.forEach((tm) => {
    let matchedSg = null;
    let matchedSgIdx = -1;

    sgEvents.forEach((sg, idx) => {
      if (!usedSgIndices.has(idx) && tm.date === sg.date && venuesFuzzyMatch(tm.venue, sg.venue)) {
        matchedSg = sg;
        matchedSgIdx = idx;
      }
    });

    if (matchedSg) {
      usedSgIndices.add(matchedSgIdx);
      merged.push({
        id: `tm_${tm.id}`,
        date: tm.date,
        time: tm.time,
        venue: tm.venue || matchedSg.venue,
        city: tm.city || matchedSg.city,
        state: tm.state || matchedSg.state,
        tmUrl: tm.url,
        sgUrl: matchedSg.url,
        minPrice: tm.minPrice || matchedSg.minPrice,
        maxPrice: tm.maxPrice || matchedSg.maxPrice
      });
    } else {
      merged.push({
        id: `tm_${tm.id}`,
        date: tm.date,
        time: tm.time,
        venue: tm.venue,
        city: tm.city,
        state: tm.state,
        tmUrl: tm.url,
        sgUrl: null,
        minPrice: tm.minPrice,
        maxPrice: tm.maxPrice
      });
    }
  });

  sgEvents.forEach((sg, idx) => {
    if (!usedSgIndices.has(idx)) {
      merged.push({
        id: `sg_${sg.id}`,
        date: sg.date,
        time: sg.time,
        venue: sg.venue,
        city: sg.city,
        state: sg.state,
        tmUrl: null,
        sgUrl: sg.url,
        minPrice: sg.minPrice,
        maxPrice: sg.maxPrice
      });
    }
  });

  merged.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  return merged.slice(0, 5);
}

function formatTicketDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone issues
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// UpcomingShowsView — sidebar view showing all unique artists with upcoming show indicator dots
function UpcomingShowsView({ shows, onCountLoaded }) {
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [sortBy, setSortBy] = useState('count'); // 'count' | 'alpha'
  const [artistDots, setArtistDots] = useState({}); // { [artistName]: true } when cached events exist

  // Derive unique artists + seen-count from shows prop
  const artistData = useMemo(() => {
    const map = {};
    shows.forEach(s => {
      if (s.artist) map[s.artist] = (map[s.artist] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [shows]);

  const sortedArtists = useMemo(() => {
    const copy = [...artistData];
    if (sortBy === 'alpha') {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      copy.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }
    return copy;
  }, [artistData, sortBy]);

  // On mount, cache-only check — reads Firestore ticketCache docs, no API calls
  useEffect(() => {
    if (artistData.length === 0) return;
    let cancelled = false;

    async function checkCache() {
      const dots = {};
      let totalEvents = 0;

      await Promise.all(
        artistData.map(async ({ name }) => {
          try {
            const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            const snap = await getDoc(doc(db, 'ticketCache', `tm_${slug}`));
            if (snap.exists()) {
              const cached = snap.data();
              const cachedAt = cached.cachedAt?.toMillis?.() || 0;
              if (Date.now() - cachedAt < TICKET_CACHE_TTL) {
                const events = cached.events || [];
                if (events.length > 0) {
                  dots[name] = true;
                  totalEvents += events.length;
                }
              }
            }
          } catch (_) {
            // silently ignore cache read errors
          }
        })
      );

      if (!cancelled) {
        setArtistDots(dots);
        if (onCountLoaded) onCountLoaded(totalEvents);
      }
    }

    checkCache();
    return () => { cancelled = true; };
  }, [artistData]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Band detail view ---
  if (selectedArtist !== null) {
    return (
      <div>
        <button
          onClick={() => setSelectedArtist(null)}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">All Artists</span>
        </button>

        <h2
          className="text-2xl font-bold mb-6"
          style={{ color: artistColor(selectedArtist) }}
        >
          {selectedArtist}
        </h2>

        <UpcomingShows artistName={selectedArtist} />
      </div>
    );
  }

  // --- Band list view ---
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-xl flex items-center justify-center border border-emerald-500/20">
          <Ticket className="w-5 h-5 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Upcoming Shows</h1>
        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
          Beta
        </span>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-200/80">
          Upcoming Shows is in beta. Show dates and availability are pulled from third-party sources and may not always be accurate. We're actively improving this feature!
        </p>
      </div>

      {/* Empty state */}
      {artistData.length === 0 && (
        <div className="text-center py-16">
          <Music className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/50 mb-4">Add some shows first to see upcoming tours</p>
        </div>
      )}

      {/* Sort toggle + list */}
      {artistData.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-white/40 text-sm">Sort by:</span>
            {[
              { key: 'count', label: 'Most Seen' },
              { key: 'alpha', label: 'A–Z' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  sortBy === key
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-white/5 text-white/50 border-white/10 hover:text-white/80 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            {sortedArtists.map(({ name, count }, idx) => (
              <button
                key={name}
                onClick={() => setSelectedArtist(name)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left group ${
                  idx !== 0 ? 'border-t border-white/5' : ''
                }`}
              >
                {/* Indicator dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  artistDots[name] ? 'bg-emerald-400' : 'bg-transparent'
                }`} />

                <span className="flex-1 text-white/90 font-medium group-hover:text-white transition-colors">
                  {name}
                </span>

                <span className="text-white/30 text-sm">
                  {count === 1 ? '1 show' : `${count} shows`}
                </span>

                <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UpcomingShows({ artistName }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [hasNoShows, setHasNoShows] = useState(false);

  useEffect(() => {
    if (!artistName) return;
    let cancelled = false;

    const slug = artistName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const tmCacheKey = `tm_${slug}`;
    const sgCacheKey = `sg_${slug}`;

    // Ticketmaster fetch — supports Attraction ID caching for exact artist matching.
    // On first call the Netlify function resolves and returns the Attraction ID;
    // subsequent calls pass it directly, skipping the TM attractions lookup entirely.
    async function fetchTmWithCache(cacheKey) {
      let cachedAttractionId = null;
      try {
        const cacheDoc = await getDoc(doc(db, 'ticketCache', cacheKey));
        if (cacheDoc.exists()) {
          const cached = cacheDoc.data();
          // Preserve the attraction ID even when the event cache has expired
          cachedAttractionId = cached.tmAttractionId || null;
          const cachedAt = cached.cachedAt && cached.cachedAt.toMillis ? cached.cachedAt.toMillis() : 0;
          if (Date.now() - cachedAt < TICKET_CACHE_TTL) {
            return cached.data || [];
          }
        }
      } catch (_) { /* cache miss — continue */ }

      try {
        let url = `/.netlify/functions/ticketmaster-events?artistName=${encodeURIComponent(artistName)}`;
        // Pass the cached attraction ID so the function skips the attractions lookup
        if (cachedAttractionId) url += `&attractionId=${encodeURIComponent(cachedAttractionId)}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const json = await res.json();
        const evts = json.events || [];
        const returnedAttractionId = json.attractionId || cachedAttractionId || null;
        try {
          const cacheData = { data: evts, cachedAt: serverTimestamp() };
          if (returnedAttractionId) cacheData.tmAttractionId = returnedAttractionId;
          await setDoc(doc(db, 'ticketCache', cacheKey), cacheData);
        } catch (_) { /* cache write failed — non-fatal */ }
        return evts;
      } catch (_) {
        return [];
      }
    }

    // SeatGeek fetch — simple cache wrapper (server-side exact filter handles matching)
    async function fetchSgWithCache(cacheKey) {
      try {
        const cacheDoc = await getDoc(doc(db, 'ticketCache', cacheKey));
        if (cacheDoc.exists()) {
          const cached = cacheDoc.data();
          const cachedAt = cached.cachedAt && cached.cachedAt.toMillis ? cached.cachedAt.toMillis() : 0;
          if (Date.now() - cachedAt < TICKET_CACHE_TTL) {
            return cached.data || [];
          }
        }
      } catch (_) { /* cache miss — continue */ }

      try {
        const res = await fetch(`/.netlify/functions/seatgeek-events?artistName=${encodeURIComponent(artistName)}`);
        if (!res.ok) return [];
        const json = await res.json();
        const evts = json.events || [];
        try {
          await setDoc(doc(db, 'ticketCache', cacheKey), { data: evts, cachedAt: serverTimestamp() });
        } catch (_) { /* cache write failed — non-fatal */ }
        return evts;
      } catch (_) {
        return [];
      }
    }

    async function load() {
      setLoading(true);
      const [tmEvents, sgEvents] = await Promise.all([
        fetchTmWithCache(tmCacheKey),
        fetchSgWithCache(sgCacheKey)
      ]);
      if (cancelled) return;
      const merged = mergeTicketEvents(tmEvents, sgEvents);
      setEvents(merged);
      setHasNoShows(merged.length === 0);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [artistName]);

  function handleTicketClick(platform) {
    try {
      logEvent(analytics, `ticket_click_${platform}`, { artist: artistName });
    } catch (_) {}
  }

  if (loading) {
    return (
      <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-white/40" />
          <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Upcoming Shows</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (hasNoShows) {
    const bandsintownUrl = `https://www.bandsintown.com/a/${encodeURIComponent(artistName)}?came_from=461&app_id=mysetlists`;
    return (
      <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-white/40" />
          <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Upcoming Shows</span>
        </div>
        <p className="text-sm text-white/40 mb-3">No upcoming shows found for {artistName}.</p>
        <a
          href={bandsintownUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Follow on Bandsintown for updates
        </a>
      </div>
    );
  }

  const hasBothPlatforms = events.some(e => e.tmUrl) && events.some(e => e.sgUrl);
  const tmSearchUrl = `https://www.ticketmaster.com/search?q=${encodeURIComponent(artistName)}`;
  const sgSearchUrl = `https://seatgeek.com/${encodeURIComponent(artistName.toLowerCase().replace(/\s+/g, '-'))}-tickets`;

  return (
    <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Upcoming Shows</span>
      </div>

      <div className="space-y-0">
        {events.map((event) => {
          const priceLabel = event.minPrice
            ? event.maxPrice && event.maxPrice !== event.minPrice
              ? `$${Math.round(event.minPrice)} – $${Math.round(event.maxPrice)}`
              : `From $${Math.round(event.minPrice)}`
            : null;

          const locationParts = [event.venue, [event.city, event.state].filter(Boolean).join(', ')].filter(Boolean);

          return (
            <div key={event.id} className="py-3 border-b border-white/5 last:border-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white/80">{formatTicketDate(event.date)}</span>
                    {locationParts.length > 0 && (
                      <>
                        <span className="text-white/20">&middot;</span>
                        <span className="text-sm text-white/60 truncate">{locationParts.join(' · ')}</span>
                      </>
                    )}
                  </div>
                  {priceLabel && (
                    <div className="text-xs text-white/40 mt-0.5">{priceLabel}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {event.tmUrl && (
                    <a
                      href={event.tmUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleTicketClick('ticketmaster')}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-colors whitespace-nowrap"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {hasBothPlatforms ? 'Official' : 'Official Tickets'}
                    </a>
                  )}
                  {event.sgUrl && (
                    <a
                      href={event.sgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleTicketClick('seatgeek')}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 transition-colors whitespace-nowrap"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {hasBothPlatforms ? 'Resale' : 'Resale Tickets'}
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
        <span className="text-xs text-white/30">See all on:</span>
        <a
          href={tmSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400/60 hover:text-blue-400 transition-colors"
        >
          Ticketmaster ↗
        </a>
        <span className="text-white/20">&middot;</span>
        <a
          href={sgSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors"
        >
          SeatGeek ↗
        </a>
      </div>
    </div>
  );
}

function SetlistEditor({ show, onAddSong, onRateSong, onCommentSong, onDeleteSong, onRateShow, onCommentShow, onBatchRate, onClose, onTagFriends, onRateVenue, confirmedSuggestion, sharedComments, commentsLoading, onOpenMemories, onAddComment, onEditComment, onDeleteComment, currentUserUid }) {
  const [songName, setSongName] = useState('');
  const [batchRating, setBatchRating] = useState(5);
  const [editingComment, setEditingComment] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [editingShowComment, setEditingShowComment] = useState(false);
  const [showCommentText, setShowCommentText] = useState(show.comment || '');
  const [shareSuccess, setShareSuccess] = useState(false);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [editingMemoryText, setEditingMemoryText] = useState('');

  const handleShare = async () => {
    const setlistText = show.setlist.map((song, i) => `${i + 1}. ${song.name}${song.rating ? ` (${song.rating}/10)` : ''}`).join('\n');
    const shareText = `${show.artist} @ ${show.venue}${show.city ? `, ${show.city}` : ''}\n${formatDate(show.date)}${show.tour ? `\n${show.tour}` : ''}\n\nSetlist:\n${setlistText}\n\nTracked with MySetlists.net`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${show.artist} - ${formatDate(show.date)}`,
          text: shareText,
        });
      } catch (err) {
        // User cancelled or share failed, try clipboard
        copyToClipboard(shareText);
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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
    <div className="fixed inset-0 md:left-64 bg-black/60 backdrop-blur-xl flex items-end md:items-center justify-center md:p-4 z-[60]">
      <div className="bg-slate-900 border border-white/10 rounded-t-2xl md:rounded-3xl max-w-[100vw] sm:max-w-lg md:max-w-2xl w-full max-h-[92vh] md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Compact top bar with close, share, and tag */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-white/10 bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-lg md:text-2xl font-bold truncate" style={{ color: artistColor(show.artist) }}>{show.artist}</h2>
            {!show.isManual && (
              <span className="text-[10px] md:text-xs font-semibold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 md:px-2 md:py-1 rounded-full flex-shrink-0">
                setlist.fm
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onRateVenue && show.venue && (
              <Tip text="Rate this venue">
                <button
                  onClick={() => onRateVenue(show)}
                  className="p-3 rounded-xl text-white/50 hover:text-amber-400 hover:bg-amber-500/10 active:bg-amber-500/20 transition-colors"
                >
                  <Star className="w-6 h-6" />
                </button>
              </Tip>
            )}
            {onTagFriends && (
              <Tip text="Tag friends at this show">
                <button
                  onClick={() => onTagFriends(show)}
                  className="p-3 rounded-xl text-white/50 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors"
                >
                  <Tag className="w-6 h-6" />
                </button>
              </Tip>
            )}
            <Tip text="Share setlist">
              <button
                onClick={handleShare}
                className={`p-3 rounded-xl transition-colors ${shareSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/50 hover:text-white hover:bg-white/10 active:bg-white/20'}`}
              >
                {shareSuccess ? <Check className="w-6 h-6" /> : <Share2 className="w-6 h-6" />}
              </button>
            </Tip>
            <button onClick={onClose} className="p-3 rounded-xl text-white/50 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scrollable content area with show info + setlist */}
        <div className="flex-1 overflow-y-auto">
          {/* Show details */}
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-white/10 bg-slate-900/80">
            <p className="text-white/50 text-sm">
              {formatDate(show.date)} &middot; {show.venue}
              {show.city && `, ${show.city}`}
            </p>
            {show.tour && (
              <p className="text-emerald-400 text-sm font-medium mt-1">Tour: {show.tour}</p>
            )}
            <div className="mt-2">
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

            {/* Add song form */}
            <form onSubmit={handleAddSong} className="flex gap-3 mt-3">
              <input
                type="text"
                placeholder="Add song to setlist..."
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40 text-sm"
              />
              <button type="submit" className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/25">
                <Plus className="w-5 h-5" />
              </button>
            </form>

            {unratedCount > 0 && (
              <div className="flex items-center gap-3 mt-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                <span className="text-xs font-medium text-white/50">Rate {unratedCount} unrated:</span>
                <RatingSelect value={batchRating} onChange={(v) => setBatchRating(v || 5)} />
                <button
                  onClick={() => onBatchRate(batchRating)}
                  className="px-4 py-2 md:px-3 md:py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm md:text-xs font-medium transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          <div className="p-4 md:p-6 bg-slate-900/50">
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
          <UpcomingShows artistName={show.artist} />

          {/* Shared Memories (confirmed show together) */}
          {confirmedSuggestion && (() => {
            const otherUid = confirmedSuggestion.participants?.find(p => p !== currentUserUid);
            const otherName = otherUid ? confirmedSuggestion.names?.[otherUid] : 'A friend';
            return (
              <div className="mt-4 border-t border-teal-500/20 pt-4">
                {/* Attendance chip */}
                <button
                  onClick={() => {
                    if (!memoriesOpen && onOpenMemories) onOpenMemories();
                    setMemoriesOpen(prev => !prev);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-sm font-medium hover:bg-teal-500/25 transition-colors mb-3"
                >
                  <Users className="w-4 h-4" />
                  You and {otherName} were both here
                  <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${memoriesOpen ? 'rotate-180' : ''}`} />
                </button>

                {memoriesOpen && (
                  <div className="bg-teal-500/5 rounded-2xl border border-teal-500/15 p-4">
                    <h4 className="text-sm font-semibold text-teal-300 mb-3">Shared Memories</h4>

                    {commentsLoading ? (
                      <p className="text-sm text-white/40 py-4 text-center">Loading...</p>
                    ) : (
                      <>
                        {sharedComments.length === 0 && (
                          <p className="text-sm text-white/40 mb-3 text-center py-2">No memories yet — add the first one!</p>
                        )}
                        <div className="space-y-3 mb-3">
                          {sharedComments.map(c => {
                            const isOwn = c.authorUid === currentUserUid;
                            return (
                              <div key={c.id} className={`rounded-xl p-3 ${isOwn ? 'bg-teal-500/10 ml-4' : 'bg-white/5 mr-4'}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-white/60">{c.authorName}</span>
                                  <span className="text-xs text-white/30">
                                    {c.editedAt ? 'edited' : c.createdAt?.toDate ? new Date(c.createdAt.toDate()).toLocaleDateString() : ''}
                                  </span>
                                </div>
                                {editingMemoryId === c.id ? (
                                  <div className="flex gap-2 mt-1">
                                    <input
                                      type="text"
                                      value={editingMemoryText}
                                      onChange={e => setEditingMemoryText(e.target.value)}
                                      maxLength={500}
                                      className="flex-1 px-2 py-1 bg-white/10 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' && editingMemoryText.trim()) {
                                          onEditComment && onEditComment(c.id, editingMemoryText.trim());
                                          setEditingMemoryId(null);
                                        }
                                        if (e.key === 'Escape') setEditingMemoryId(null);
                                      }}
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => { onEditComment && onEditComment(c.id, editingMemoryText.trim()); setEditingMemoryId(null); }}
                                      className="px-2 py-1 bg-teal-500 hover:bg-teal-400 text-white rounded-lg text-xs"
                                    >Save</button>
                                    <button
                                      onClick={() => setEditingMemoryId(null)}
                                      className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/60 rounded-lg text-xs"
                                    >Cancel</button>
                                  </div>
                                ) : (
                                  <p className="text-sm text-white/80 mt-0.5">{c.text}</p>
                                )}
                                {isOwn && editingMemoryId !== c.id && (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => { setEditingMemoryId(c.id); setEditingMemoryText(c.text); }}
                                      className="text-xs text-white/30 hover:text-white/60 transition-colors"
                                    >Edit</button>
                                    <button
                                      onClick={() => onDeleteComment && onDeleteComment(c.id)}
                                      className="text-xs text-white/30 hover:text-red-400 transition-colors"
                                    >Delete</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* New comment input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Share a memory..."
                            value={newMemoryText}
                            onChange={e => setNewMemoryText(e.target.value)}
                            maxLength={500}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && newMemoryText.trim()) {
                                onAddComment && onAddComment(newMemoryText.trim());
                                setNewMemoryText('');
                              }
                            }}
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                          />
                          <button
                            onClick={() => {
                              if (newMemoryText.trim()) {
                                onAddComment && onAddComment(newMemoryText.trim());
                                setNewMemoryText('');
                              }
                            }}
                            disabled={!newMemoryText.trim()}
                            className="px-3 py-2 bg-teal-500/80 hover:bg-teal-500 disabled:opacity-40 text-white rounded-xl text-sm transition-colors"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          </div>
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
  const [venueRatingsMap, setVenueRatingsMap] = useState({}); // venueKey → aggregate | null

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

function AdminView() {
  const [adminTab, setAdminTab] = useState('users'); // 'users' | 'guestTrials' | 'roadmap'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cacheEntries, setCacheEntries] = useState([]);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheClearArtist, setCacheClearArtist] = useState('');
  const [cacheStatus, setCacheStatus] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userShows, setUserShows] = useState([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [selectedAdminShow, setSelectedAdminShow] = useState(null);
  const [showSortBy, setShowSortBy] = useState('date');
  const [showSearchTerm, setShowSearchTerm] = useState('');

  // Guest trials state
  const [guestSessions, setGuestSessions] = useState([]);
  const [loadingGuests, setLoadingGuests] = useState(false);

  // Email compose state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // null | 'success' | 'error'

  // Delete user state
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null); // null | { id, firstName, email }
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Roadmap admin state
  // roadmapItems — Collection: roadmapItems/{itemId} — { title, description, status, category, voteCount, sourceFeedbackId, submitterUid, createdAt, updatedAt, publishedAt }
  // feedbackItems — Collection: feedback/{docId} — { type, category, message, submitterUid, submitterEmail, submitterName, status, roadmapItemId, createdAt }
  const [roadmapItems, setRoadmapItems] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('other');
  const [savingItem, setSavingItem] = useState(false);

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

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/.netlify/functions/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUid: deleteConfirmUser.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Deletion failed');
      setDeleteConfirmUser(null);
      // Remove from local list without a full reload
      setUsers(prev => prev.filter(u => u.id !== deleteConfirmUser.id));
      if (selectedUser?.id === deleteConfirmUser.id) setSelectedUser(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const loadGuestSessions = useCallback(async () => {
    setLoadingGuests(true);
    try {
      const snapshot = await getDocs(collection(db, 'guestSessions'));
      const sessions = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        startedAt: d.data().startedAt?.toDate?.() || new Date(),
        convertedAt: d.data().convertedAt?.toDate?.() || null,
      }));
      setGuestSessions(sessions.sort((a, b) => b.startedAt - a.startedAt));
    } catch (error) {
      console.error('Failed to load guest sessions:', error);
    } finally {
      setLoadingGuests(false);
    }
  }, []);

  const loadUserShows = useCallback(async (userId) => {
    setLoadingShows(true);
    try {
      const showsRef = collection(db, 'users', userId, 'shows');
      const snapshot = await getDocs(showsRef);
      const loadedShows = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserShows(loadedShows);
    } catch (error) {
      console.error('Failed to load user shows:', error);
      setUserShows([]);
    } finally {
      setLoadingShows(false);
    }
  }, []);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSelectedAdminShow(null);
    setShowSearchTerm('');
    setShowSortBy('date');
    loadUserShows(user.id);
  };

  const handleBackToUsers = () => {
    setSelectedUser(null);
    setUserShows([]);
    setSelectedAdminShow(null);
    setShowSearchTerm('');
    setShowEmailForm(false);
    setEmailSubject('');
    setEmailBody('');
    setEmailStatus(null);
  };

  const handleSendEmail = async () => {
    if (!selectedUser?.email || !emailSubject.trim() || !emailBody.trim()) return;
    setEmailSending(true);
    setEmailStatus(null);
    try {
      const res = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedUser.email,
          subject: emailSubject.trim(),
          html: emailBody.trim().replace(/\n/g, '<br />')
        })
      });
      if (res.ok) {
        setEmailStatus('success');
        setEmailSubject('');
        setEmailBody('');
        setTimeout(() => { setEmailStatus(null); setShowEmailForm(false); }, 2000);
      } else {
        setEmailStatus('error');
      }
    } catch {
      setEmailStatus('error');
    } finally {
      setEmailSending(false);
    }
  };

  // === ROADMAP ADMIN FUNCTIONS ===

  const loadRoadmapData = useCallback(async () => {
    setRoadmapLoading(true);
    try {
      const [itemsSnap, feedSnap] = await Promise.all([
        getDocs(collection(db, 'roadmapItems')),
        getDocs(query(collection(db, 'feedback'), where('type', '==', 'feature'))),
      ]);
      setRoadmapItems(
        itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      );
      setFeedbackItems(feedSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to load roadmap data:', err);
    } finally {
      setRoadmapLoading(false);
    }
  }, []);

  const publishRoadmapItem = async (item, targetStatus) => {
    setSavingItem(true);
    try {
      await updateDoc(doc(db, 'roadmapItems', item.id), {
        status: targetStatus,
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Notify the original submitter
      if (item.submitterUid) {
        await addDoc(collection(db, 'notifications'), {
          uid: item.submitterUid,
          type: 'roadmap_published',
          message: 'Your feature idea was published to the roadmap!',
          itemId: item.id,
          itemTitle: item.title || '',
          read: false,
          createdAt: serverTimestamp(),
        });
        // Optional email notification (fire and forget)
        const linkedFeedback = feedbackItems.find(f => f.id === item.sourceFeedbackId);
        if (linkedFeedback?.submitterEmail) {
          fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: linkedFeedback.submitterEmail,
              subject: 'Your feature idea is on the MySetlists roadmap!',
              html: `<p>Hey ${linkedFeedback.submitterName || 'there'}!</p><p>Great news — your feature idea <strong>"${item.title}"</strong> has been added to the <a href="https://mysetlists.net/roadmap">public roadmap</a>!</p><p>Head over and see how the community votes on it. Thanks for helping make MySetlists better!</p>`,
            }),
          }).catch(() => {});
        }
      }
      setRoadmapItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: targetStatus, publishedAt: new Date() } : i
      ));
    } catch (err) {
      console.error('Failed to publish roadmap item:', err);
    } finally {
      setSavingItem(false);
    }
  };

  const changeItemStatus = async (item, newStatus) => {
    try {
      await updateDoc(doc(db, 'roadmapItems', item.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...(newStatus !== 'draft' && !item.publishedAt ? { publishedAt: serverTimestamp() } : {}),
      });
      setRoadmapItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
    } catch (err) {
      console.error('Failed to change item status:', err);
    }
  };

  const dismissRoadmapItem = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'roadmapItems', item.id));
      setRoadmapItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Failed to dismiss roadmap item:', err);
    }
  };

  const createRoadmapItem = async () => {
    if (!newItemTitle.trim()) return;
    setSavingItem(true);
    try {
      const ref = await addDoc(collection(db, 'roadmapItems'), {
        title: newItemTitle.trim(),
        description: newItemDesc.trim(),
        status: 'draft',
        category: newItemCategory,
        voteCount: 0,
        sourceFeedbackId: null,
        submitterUid: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        publishedAt: null,
      });
      setRoadmapItems(prev => [{
        id: ref.id,
        title: newItemTitle.trim(),
        description: newItemDesc.trim(),
        status: 'draft',
        category: newItemCategory,
        voteCount: 0,
        sourceFeedbackId: null,
        submitterUid: null,
      }, ...prev]);
      setCreatingItem(false);
      setNewItemTitle('');
      setNewItemDesc('');
      setNewItemCategory('other');
    } catch (err) {
      console.error('Failed to create roadmap item:', err);
    } finally {
      setSavingItem(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadGuestSessions();
    loadRoadmapData();
  }, [loadUsers, loadGuestSessions, loadRoadmapData]);

  const filteredUsers = users.filter(user =>
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const loadCacheStats = async () => {
    if (!auth.currentUser) return;
    setCacheLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/.netlify/functions/cache-stats', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load cache stats');
      const { entries } = await res.json();
      setCacheEntries(entries);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setCacheLoading(false);
    }
  };

  const clearCache = async (by, name = null, key = null) => {
    if (by === 'all' && !window.confirm('Clear the entire setlist cache? All searches will hit the Setlist.fm API again until re-cached.')) return;
    if (!auth.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const body = by === 'artist' ? { by: 'artist', name }
        : by === 'key' ? { key }
        : { by: 'all' };
      const res = await fetch('/.netlify/functions/clear-cache', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      setCacheStatus(`Cleared ${result.deleted} cache ${result.deleted === 1 ? 'entry' : 'entries'}.`);
      setTimeout(() => setCacheStatus(''), 4000);
      setCacheClearArtist('');
      loadCacheStats();
    } catch (error) {
      setCacheStatus(`Error: ${error.message}`);
      setTimeout(() => setCacheStatus(''), 4000);
    }
  };

  const totalStats = useMemo(() => ({
    totalUsers: users.length,
    totalShows: users.reduce((acc, u) => acc + (u.showCount || 0), 0),
    totalSongs: users.reduce((acc, u) => acc + (u.songCount || 0), 0),
    totalRated: users.reduce((acc, u) => acc + (u.ratedSongCount || 0), 0)
  }), [users]);

  const guestTrialStats = useMemo(() => {
    const total = guestSessions.length;
    const converted = guestSessions.filter(s => s.converted).length;
    const withShows = guestSessions.filter(s => (s.showsAdded || 0) > 0).length;
    const totalShowsAdded = guestSessions.reduce((acc, s) => acc + (s.showsAdded || 0), 0);
    return {
      total,
      converted,
      conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0',
      withShows,
      totalShowsAdded,
    };
  }, [guestSessions]);

  const sortedFilteredUserShows = useMemo(() => {
    let filtered = userShows.filter(show =>
      show.artist?.toLowerCase().includes(showSearchTerm.toLowerCase()) ||
      show.venue?.toLowerCase().includes(showSearchTerm.toLowerCase()) ||
      show.city?.toLowerCase().includes(showSearchTerm.toLowerCase())
    );
    return filtered.sort((a, b) => {
      if (showSortBy === 'date') return parseDate(b.date) - parseDate(a.date);
      if (showSortBy === 'artist') return (a.artist || '').localeCompare(b.artist || '');
      if (showSortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return 0;
    });
  }, [userShows, showSearchTerm, showSortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-white/50 font-medium">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Shows Detail View */}
      {selectedUser ? (
        <>
          {/* Back button + User header */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToUsers}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">
                  {selectedUser.displayName || selectedUser.firstName || 'Anonymous'}'s Shows
                </h2>
                <p className="text-sm text-white/50">{selectedUser.email}</p>
              </div>
            </div>
            {selectedUser.email && (
              <button
                onClick={() => { setShowEmailForm(!showEmailForm); setEmailStatus(null); }}
                className="ml-auto flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium text-white/70 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
            )}
          </div>

          {/* Inline email compose */}
          {showEmailForm && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Mail className="w-4 h-4" />
                <span>To: {selectedUser.email}</span>
              </div>
              <input
                type="text"
                placeholder="Subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <textarea
                placeholder="Message body..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={5}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSendEmail}
                  disabled={emailSending || !emailSubject.trim() || !emailBody.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all text-sm"
                >
                  {emailSending ? 'Sending...' : 'Send'}
                </button>
                <button
                  onClick={() => { setShowEmailForm(false); setEmailSubject(''); setEmailBody(''); setEmailStatus(null); }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-xl font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                {emailStatus === 'success' && <span className="text-sm text-emerald-400">Sent!</span>}
                {emailStatus === 'error' && <span className="text-sm text-red-400">Failed to send. Check RESEND_API_KEY.</span>}
              </div>
            </div>
          )}

          {/* User stats summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Shows', value: selectedUser.showCount || 0 },
              { label: 'Songs', value: selectedUser.songCount || 0 },
              { label: 'Venues', value: selectedUser.venueCount || 0 },
              { label: 'Joined', value: selectedUser.createdAt?.toLocaleDateString?.() || 'Unknown', isDate: true },
            ].map(stat => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-emerald-400">
                  {stat.isDate ? stat.value : stat.value.toLocaleString()}
                </div>
                <div className="text-xs font-medium text-white/50 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Search + Sort controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter shows by artist, venue, or city..."
                value={showSearchTerm}
                onChange={(e) => setShowSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/50">Sort:</span>
              {['date', 'artist', 'rating'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setShowSortBy(opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    showSortBy === opt
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Loading state */}
          {loadingShows && (
            <div className="flex items-center justify-center py-16">
              <div className="text-white/50 font-medium">Loading shows...</div>
            </div>
          )}

          {/* Show cards */}
          {!loadingShows && (
            <div className="space-y-3">
              {sortedFilteredUserShows.map(show => {
                const songAvg = avgSongRating(show.setlist || []);
                return (
                  <div
                    key={show.id}
                    className="bg-white/5 rounded-2xl p-4 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition-all"
                    onClick={() => setSelectedAdminShow(show)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium" style={{ color: artistColor(show.artist) }}>
                            {show.artist}
                          </span>
                          {show.isManual && (
                            <span className="text-xs bg-white/10 text-white/40 px-2 py-0.5 rounded-full">Manual</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Calendar className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-white/80">{formatDate(show.date)}</span>
                          <span className="text-white/20">&middot;</span>
                          <MapPin className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-white/60">{show.venue}{show.city ? `, ${show.city}` : ''}</span>
                          <span className="text-white/20">&middot;</span>
                          <Music className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-white/60">{(show.setlist || []).length} songs</span>
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
                        <div className="flex items-center gap-3 mt-2">
                          {show.rating && (
                            <span className="text-sm font-semibold text-emerald-400">Show: {show.rating}/10</span>
                          )}
                          {songAvg && (
                            <span className="text-xs font-medium text-white/40">Songs avg: {songAvg}/10</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-white/20 flex-shrink-0 ml-3" />
                    </div>
                  </div>
                );
              })}

              {sortedFilteredUserShows.length === 0 && (
                <div className="text-center py-12 text-white/40">
                  {showSearchTerm ? 'No shows match your filter' : 'This user has no shows'}
                </div>
              )}
            </div>
          )}

          {/* SetlistEditor modal for show detail (read-only) */}
          {selectedAdminShow && (
            <SetlistEditor
              show={{...selectedAdminShow, setlist: selectedAdminShow.setlist || []}}
              onAddSong={() => {}}
              onRateSong={() => {}}
              onCommentSong={() => {}}
              onDeleteSong={() => {}}
              onRateShow={() => {}}
              onCommentShow={() => {}}
              onBatchRate={() => {}}
              onClose={() => setSelectedAdminShow(null)}
            />
          )}
        </>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold text-white">Admin Portal</h2>
            <button
              onClick={() => { loadUsers(); loadGuestSessions(); loadRoadmapData(); }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors text-sm"
            >
              Refresh
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setAdminTab('users')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminTab === 'users'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              <Users className="w-4 h-4" />
              Users
            </button>
            <button
              onClick={() => setAdminTab('guestTrials')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminTab === 'guestTrials'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              <Eye className="w-4 h-4" />
              Guest Trials
            </button>
            <button
              onClick={() => setAdminTab('roadmap')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminTab === 'roadmap'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Roadmap
            </button>
          </div>

          {/* Users Tab */}
          {adminTab === 'users' && (
            <>
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
                      <th className="w-10"></th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => handleSelectUser(user)}
                      >
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
                        <td className="px-2 py-4">
                          <ChevronRight className="w-4 h-4 text-white/20" />
                        </td>
                        <td className="px-2 py-4">
                          <Tip text="Delete user">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmUser({ id: user.id, firstName: user.firstName || 'this user', email: user.email });
                              }}
                              className="p-1.5 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </Tip>
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
            </>
          )}

          {/* Guest Trials Tab */}
          {adminTab === 'guestTrials' && (
            <>
              {/* Guest Trial Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Trials', value: guestTrialStats.total, color: 'from-violet-500 to-purple-500' },
                  { label: 'Converted', value: guestTrialStats.converted, color: 'from-emerald-500 to-teal-500' },
                  { label: 'Conversion Rate', value: `${guestTrialStats.conversionRate}%`, color: 'from-amber-500 to-orange-500' },
                  { label: 'Shows Added', value: guestTrialStats.totalShowsAdded, color: 'from-pink-500 to-rose-500' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
                    <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                      {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                    </div>
                    <div className="text-sm font-medium text-white/50 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Engaged Guests (added shows) */}
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
                <div className="text-sm font-medium text-white/50 mb-1">Engaged Guests</div>
                <div className="text-2xl font-bold text-emerald-400">{guestTrialStats.withShows}</div>
                <div className="text-xs text-white/40 mt-1">Guests who added at least one show</div>
              </div>

              {/* Guest Sessions Table */}
              {loadingGuests ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-white/50 font-medium">Loading guest sessions...</div>
                </div>
              ) : (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10">
                        <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Started</th>
                        <th className="text-center px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Shows Added</th>
                        <th className="text-center px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide">Status</th>
                        <th className="text-right px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wide hidden md:table-cell">Converted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {guestSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-white/80 text-sm">
                            {session.startedAt?.toLocaleDateString?.() || 'Unknown'}
                            <span className="text-white/40 ml-2 hidden sm:inline">
                              {session.startedAt?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) || ''}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-sm font-semibold ${
                              (session.showsAdded || 0) > 0
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-white/10 text-white/40'
                            }`}>
                              {session.showsAdded || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {session.converted ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                                <Check className="w-3 h-3" />
                                Converted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-white/10 text-white/40 px-2.5 py-1 rounded-full text-xs font-semibold">
                                <Eye className="w-3 h-3" />
                                Browsing
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-white/40 text-sm hidden md:table-cell">
                            {session.convertedAt?.toLocaleDateString?.() || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {guestSessions.length === 0 && (
                    <div className="text-center py-12 text-white/40">
                      No guest trial sessions recorded yet
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Roadmap Tab */}
      {adminTab === 'roadmap' && (
        <div className="space-y-6">
          {/* Header with New Item button */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Roadmap Items</h3>
            <button
              onClick={() => setCreatingItem(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              New Item
            </button>
          </div>

          {/* Create Item Form */}
          {creatingItem && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-semibold text-white">New Roadmap Item</h4>
              <input
                value={newItemTitle}
                onChange={e => setNewItemTitle(e.target.value)}
                placeholder="Title"
                className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <textarea
                value={newItemDesc}
                onChange={e => setNewItemDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
              />
              <select
                value={newItemCategory}
                onChange={e => setNewItemCategory(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                {Object.entries(ROADMAP_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k} className="bg-slate-900">{v}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={createRoadmapItem}
                  disabled={!newItemTitle.trim() || savingItem}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {savingItem ? 'Creating...' : 'Create Draft'}
                </button>
                <button
                  onClick={() => { setCreatingItem(false); setNewItemTitle(''); setNewItemDesc(''); setNewItemCategory('other'); }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {roadmapLoading ? (
            <div className="text-center py-8 text-white/40">Loading roadmap data...</div>
          ) : (
            <>
              {/* Drafts section */}
              {(() => {
                const drafts = roadmapItems.filter(i => i.status === 'draft');
                return (
                  <div>
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">
                      Drafts ({drafts.length})
                    </h4>
                    <div className="space-y-3">
                      {drafts.map(item => (
                        <AdminRoadmapCard
                          key={item.id}
                          item={item}
                          onStatusChange={(status) => changeItemStatus(item, status)}
                          onPublish={(status) => publishRoadmapItem(item, status)}
                          onDismiss={() => dismissRoadmapItem(item)}
                          feedbackItems={feedbackItems}
                          saving={savingItem}
                        />
                      ))}
                      {drafts.length === 0 && (
                        <p className="text-white/30 text-sm py-2">No draft items</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Published sections by status */}
              {[
                { key: 'upnext',     label: 'Up Next'     },
                { key: 'inprogress', label: 'In Progress' },
                { key: 'shipped',    label: 'Shipped'     },
              ].map(({ key, label }) => {
                const statusItems = roadmapItems.filter(i => i.status === key);
                return (
                  <div key={key}>
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">
                      {label} ({statusItems.length})
                    </h4>
                    <div className="space-y-3">
                      {statusItems.map(item => (
                        <AdminRoadmapCard
                          key={item.id}
                          item={item}
                          onStatusChange={(status) => changeItemStatus(item, status)}
                          onPublish={(status) => publishRoadmapItem(item, status)}
                          onDismiss={() => dismissRoadmapItem(item)}
                          feedbackItems={feedbackItems}
                          saving={savingItem}
                        />
                      ))}
                      {statusItems.length === 0 && (
                        <p className="text-white/30 text-sm py-2">None</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Cache Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-violet-400" />
            Setlist.fm Cache
          </h3>
          <button
            onClick={loadCacheStats}
            disabled={cacheLoading}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors text-sm disabled:opacity-50"
          >
            {cacheLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Cached Searches', value: cacheEntries.length, color: 'from-violet-500 to-purple-500' },
            { label: 'Active Entries', value: cacheEntries.filter(e => e.isActive).length, color: 'from-emerald-500 to-teal-500' },
            { label: 'Total Cache Hits', value: cacheEntries.reduce((a, e) => a + e.hitCount, 0), color: 'from-amber-500 to-orange-500' },
          ].map(stat => (
            <div key={stat.label} className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
              <div className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                {stat.value.toLocaleString()}
              </div>
              <div className="text-xs font-medium text-white/50 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Artist name to clear from cache..."
            value={cacheClearArtist}
            onChange={e => setCacheClearArtist(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && cacheClearArtist.trim() && clearCache('artist', cacheClearArtist)}
            className="flex-1 px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-white placeholder-white/40 text-sm"
          />
          <button
            onClick={() => clearCache('artist', cacheClearArtist)}
            disabled={!cacheClearArtist.trim()}
            className="px-4 py-2.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-xl font-medium transition-colors text-sm disabled:opacity-40"
          >
            Clear Artist
          </button>
          <button
            onClick={() => clearCache('all')}
            className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-medium transition-colors text-sm"
          >
            Clear All
          </button>
        </div>

        {cacheStatus && (
          <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${cacheStatus.startsWith('Error') ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {cacheStatus}
          </div>
        )}

        {cacheEntries.length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">Artist</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide hidden sm:table-cell">Page</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">Hits</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide hidden md:table-cell">TTL</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide hidden lg:table-cell">Expires</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cacheEntries.map(entry => (
                  <tr key={entry.key} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white font-medium capitalize">{entry.artistName || '—'}</td>
                    <td className="px-4 py-3 text-white/60 text-center hidden sm:table-cell">{entry.page}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full text-xs font-semibold">{entry.hitCount}</span>
                    </td>
                    <td className="px-4 py-3 text-white/60 text-center hidden md:table-cell">{entry.ttlHours}h</td>
                    <td className="px-4 py-3 text-white/40 text-center text-xs hidden lg:table-cell">{entry.expiresAt}</td>
                    <td className="px-4 py-3 text-center">
                      {entry.isActive
                        ? <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-xs">Active</span>
                        : <span className="bg-white/10 text-white/40 px-2 py-0.5 rounded-full text-xs">Expired</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Tip text="Delete this entry">
                        <button
                          onClick={() => clearCache('key', null, entry.key)}
                          className="text-red-400/50 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </Tip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!cacheLoading && cacheEntries.length === 0 && (
          <div className="text-center py-8 text-white/40 text-sm">
            No cache entries yet. Cache will populate as users search for setlists.
          </div>
        )}
      </div>

      {/* Delete User Confirmation Dialog */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-rose-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-rose-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Delete User</h2>
            </div>
            <p className="text-white/70 mb-2 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <span className="text-white font-medium">{deleteConfirmUser.firstName}</span>
              {deleteConfirmUser.email ? ` (${deleteConfirmUser.email})` : ''}?
            </p>
            <p className="text-white/50 text-sm mb-6 leading-relaxed">
              This will delete their account, all shows, friend connections, show tags, and invites.{' '}
              <span className="text-rose-400 font-medium">This cannot be undone.</span>
            </p>
            {deleteError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 mb-4 text-sm text-rose-400">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteConfirmUser(null); setDeleteError(null); }}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-400 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleteLoading ? 'Deleting…' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== ADMIN ROADMAP CARD ==========
// Per-item card shown in the Admin → Roadmap tab
function AdminRoadmapCard({ item, onStatusChange, onPublish, onDismiss, feedbackItems, saving }) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title || '');
  const [editDesc, setEditDesc] = useState(item.description || '');
  const [localSaving, setLocalSaving] = useState(false);

  const linkedFeedback = feedbackItems.find(f => f.id === item.sourceFeedbackId);

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setLocalSaving(true);
    try {
      await updateDoc(doc(db, 'roadmapItems', item.id), {
        title: editTitle.trim(),
        description: editDesc.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditing(false);
    } catch (err) {
      console.error('Failed to save edit:', err);
    } finally {
      setLocalSaving(false);
    }
  };

  const STATUS_OPTIONS = [
    { value: 'draft',      label: 'Draft'       },
    { value: 'upnext',     label: 'Up Next'     },
    { value: 'inprogress', label: 'In Progress' },
    { value: 'shipped',    label: 'Shipped'     },
  ];

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 space-y-3">
      {editing ? (
        <div className="space-y-2">
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="Title"
          />
          <textarea
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
            placeholder="Description (optional)"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={!editTitle.trim() || localSaving}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            >
              {localSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditTitle(item.title || ''); setEditDesc(item.description || ''); }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/60 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-white font-medium text-sm leading-snug">{item.title}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                {item.voteCount || 0} vote{item.voteCount !== 1 ? 's' : ''}
              </span>
              {item.category && ROADMAP_CATEGORIES[item.category] && (
                <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
                  {ROADMAP_CATEGORIES[item.category]}
                </span>
              )}
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-white/40 hover:text-white/70 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
          {item.description && item.description !== item.title && (
            <p className="text-white/50 text-xs mt-1 leading-relaxed line-clamp-2">{item.description}</p>
          )}
          {linkedFeedback && (
            <p className="text-white/30 text-xs mt-1.5 italic">
              From feedback by {linkedFeedback.submitterName || 'user'}: "{(linkedFeedback.message || '').slice(0, 80)}{linkedFeedback.message?.length > 80 ? '...' : ''}"
            </p>
          )}
        </div>
      )}

      {/* Status controls */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-white/5">
        <select
          value={item.status}
          onChange={e => onStatusChange(e.target.value)}
          disabled={saving}
          className="px-3 py-1.5 bg-white/10 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
              {opt.label}
            </option>
          ))}
        </select>

        {item.status === 'draft' && (
          <button
            onClick={() => onPublish('upnext')}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/30 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
          >
            <TrendingUp className="w-3 h-3" />
            Publish → Up Next
          </button>
        )}

        <button
          onClick={onDismiss}
          disabled={saving}
          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-medium transition-colors ml-auto disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// PWA Install Prompt Component
function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after user has been engaged (30 seconds)
      setTimeout(() => setShowPrompt(true), 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Install outcome:', outcome);
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again this session
    setDeferredPrompt(null);
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-4 shadow-xl z-50 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold">Install MySetlists</p>
          <p className="text-white/80 text-sm mt-1">Add to your home screen for quick access</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-white text-emerald-600 rounded-lg font-medium text-sm hover:bg-white/90 transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-white/80 hover:text-white text-sm transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PUBLIC ROADMAP PAGE  —  /roadmap
// Standalone public page — no sidebar, auth detected via onAuthStateChanged
// Uses same RoadmapCard and ROADMAP_COLUMNS constants as the in-app RoadmapView
// ============================================================
export function PublicRoadmapPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading, null = no user
  const [userVotes, setUserVotes] = useState({});
  const [votingItemId, setVotingItemId] = useState(null);
  const [signInPrompt, setSignInPrompt] = useState(false);

  // Detect auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u ?? null));
    return () => unsub();
  }, []);

  // Real-time listener for published roadmap items
  useEffect(() => {
    const q = query(
      collection(db, 'roadmapItems'),
      where('status', 'in', ['upnext', 'inprogress', 'shipped'])
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.log('Public roadmap error:', err.message);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load which items the logged-in user has voted on
  useEffect(() => {
    if (!currentUser || items.length === 0) {
      setUserVotes({});
      return;
    }
    Promise.all(
      items.map(item =>
        getDoc(doc(db, 'roadmapItems', item.id, 'voters', currentUser.uid))
          .then(d => [item.id, d.exists()])
      )
    ).then(results => setUserVotes(Object.fromEntries(results)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, items.length]);

  // Top 3 most-voted item IDs
  const topThreeIds = new Set(
    [...items]
      .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
      .slice(0, 3)
      .map(i => i.id)
  );

  // Toggle vote — runTransaction for atomic increment/decrement
  const handleVote = async (item) => {
    if (!currentUser) { setSignInPrompt(true); return; }
    if (votingItemId) return;
    setVotingItemId(item.id);
    const itemRef = doc(db, 'roadmapItems', item.id);
    const voterRef = doc(db, 'roadmapItems', item.id, 'voters', currentUser.uid);
    const hasVoted = !!userVotes[item.id];
    try {
      await runTransaction(db, async (tx) => {
        const voterSnap = await tx.get(voterRef);
        if (!hasVoted && !voterSnap.exists()) {
          tx.set(voterRef, { votedAt: serverTimestamp() });
          tx.update(itemRef, { voteCount: increment(1), updatedAt: serverTimestamp() });
        } else if (hasVoted && voterSnap.exists()) {
          tx.delete(voterRef);
          tx.update(itemRef, { voteCount: increment(-1), updatedAt: serverTimestamp() });
        }
      });
      setUserVotes(prev => ({ ...prev, [item.id]: !hasVoted }));
    } catch (err) {
      console.error('Vote error:', err);
    } finally {
      setVotingItemId(null);
    }
  };

  const pageTitle = 'Roadmap — MySetlists';
  const pageDesc = "See what's coming to MySetlists and vote on features you want most.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content="https://mysetlists.net/roadmap" />
        <link rel="canonical" href="https://mysetlists.net/roadmap" />
      </Helmet>

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <a href="/" className="flex-shrink-0">
            <img src="/logo.svg" alt="MySetlists" className="h-8 w-auto" />
          </a>
          <div className="flex items-center gap-3">
            {currentUser ? (
              <a
                href="/"
                className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                ← Back to app
              </a>
            ) : (
              <a
                href="/"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all"
              >
                Sign in to vote
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">What's Coming to MySetlists</h1>
          <p className="text-white/60">Vote on features you want most — the more votes, the higher it goes.</p>
        </div>

        {/* Sign-in prompt banner */}
        {signInPrompt && (
          <div className="mb-6 flex items-center justify-between gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
            <p className="text-amber-400 text-sm">
              <a href="/" className="font-medium underline hover:text-amber-300">Sign in</a> to vote on features you want!
            </p>
            <button onClick={() => setSignInPrompt(false)} className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-white/40">Loading roadmap...</div>
        ) : (
          <div className="flex flex-col gap-6 md:grid md:grid-cols-3 md:gap-6">
            {ROADMAP_COLUMNS.map(col => {
              const colItems = items
                .filter(i => i.status === col.key)
                .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
              return (
                <div key={col.key}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">{col.emoji}</span>
                    <h2 className={`font-bold text-base ${col.headerColor}`}>{col.label}</h2>
                    <span className="text-white/30 text-xs ml-auto">{colItems.length}</span>
                  </div>
                  <div className="space-y-3">
                    {colItems.map(item => (
                      <RoadmapCard
                        key={item.id}
                        item={item}
                        hasVoted={!!userVotes[item.id]}
                        isTopThree={topThreeIds.has(item.id)}
                        onVote={handleVote}
                        voting={votingItemId === item.id}
                        isLoggedIn={!!currentUser}
                      />
                    ))}
                    {colItems.length === 0 && (
                      <p className="text-white/25 text-sm py-4">Nothing here yet</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA for non-signed-in users */}
        {!currentUser && !loading && items.length > 0 && (
          <div className="mt-12 text-center">
            <p className="text-white/50 mb-4 text-sm">
              Track concerts you've been to and vote on the features you want most.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 transition-all"
            >
              <Music className="w-4 h-4" />
              Start Tracking on MySetlists
            </a>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

// ============================================================
// PUBLIC ARTIST PAGE  —  /artist/:artistSlug
// ============================================================
export function PublicArtistPage() {
  const { artistSlug } = useParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!artistSlug) return;
    setLoading(true);
    fetch(`/.netlify/functions/get-artist-stats?slug=${encodeURIComponent(artistSlug)}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(data => { setStats(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [artistSlug]);

  const artistName = stats?.artistName || artistSlug?.replace(/-/g, ' ');
  const canonicalUrl = `https://mysetlists.net/artist/${artistSlug}`;
  const ogTitle = `${artistName} Concert Stats — MySetlists`;
  const ogDescription = stats
    ? `${artistName} has been seen ${stats.showCount} times by ${stats.userCount} fans on MySetlists. See top songs and recent shows.`
    : `See concert stats for ${artistName} on MySetlists.`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={canonicalUrl} />
        {stats && (
          <script type="application/ld+json">{JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'MusicGroup',
            name: artistName,
            url: canonicalUrl,
            description: ogDescription,
          })}</script>
        )}
      </Helmet>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1" style={{ textTransform: 'capitalize' }}>{artistName}</h1>
          <p className="text-white/50">Community concert stats on MySetlists</p>
        </div>

        {loading && (
          <div className="text-center py-16 text-white/40">Loading stats...</div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-white/40 mb-4">No stats found for this artist yet.</p>
            <a href="/" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-medium transition-colors">
              Track a Show
            </a>
          </div>
        )}

        {stats && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                <div className="text-3xl font-bold text-emerald-400">{stats.showCount}</div>
                <div className="text-sm text-white/50 mt-1">Shows tracked</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                <div className="text-3xl font-bold text-teal-400">{stats.userCount}</div>
                <div className="text-sm text-white/50 mt-1">Fans tracking</div>
              </div>
            </div>

            {/* Top songs */}
            {stats.topSongs?.length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-5 mb-6">
                <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <Music className="w-4 h-4 text-emerald-400" />
                  Most Played Songs
                </h2>
                <div className="space-y-2">
                  {stats.topSongs.slice(0, 10).map((song, i) => (
                    <div key={song.name} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-white/30 font-mono text-sm w-5">{i + 1}.</span>
                        <span className="text-white/80 text-sm">{song.name}</span>
                      </div>
                      <span className="text-emerald-400 text-xs font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {song.count}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent shows */}
            {stats.recentShows?.length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-5 mb-8">
                <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-400" />
                  Recent Shows
                </h2>
                <div className="space-y-2">
                  {stats.recentShows.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                      <div>
                        <div className="text-white/80 text-sm">{s.venue}</div>
                        {s.city && <div className="text-white/40 text-xs">{s.city}</div>}
                      </div>
                      <span className="text-white/40 text-xs">{s.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="text-center">
              <p className="text-white/50 mb-4 text-sm">Track your own concert history for free</p>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 transition-all"
              >
                <Music className="w-4 h-4" />
                Start Tracking on MySetlists
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
