import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Music, Plus, X, Star, Calendar, MapPin, List, BarChart3, Check, Search, Download, ChevronLeft, ChevronRight, Users, Building2, ChevronDown, MessageSquare, LogOut, User, Shield, Trophy, TrendingUp, Crown, Mail, Send, Menu, Coffee, Heart, Sparkles, Share2, Copy, ScrollText, Upload, AlertTriangle, UserPlus, UserCheck, UserX, Tag, Camera, RefreshCw } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, serverTimestamp, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { Link, useSearchParams } from 'react-router-dom';
import Footer from './Footer';
import AuthModal from './components/auth/AuthModal';
import ProfileView from './components/profile/ProfileView';

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
function Sidebar({ activeView, setActiveView, isAdmin, onLogout, userName, isOpen, onClose, isGuest, onCreateAccount, pendingNotificationCount }) {
  const navItems = [
    { id: 'search', label: 'Search', icon: Search },
    { id: 'shows', label: 'Shows', icon: List },
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    ...(isGuest ? [] : [
      { id: 'friends', label: 'Friends', icon: UserPlus, badge: pendingNotificationCount },
      { id: 'community', label: 'Community', icon: Users },
      { id: 'invite', label: 'Invite', icon: Send },
    ]),
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'release-notes', label: 'Release Notes', icon: ScrollText },
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
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Music className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-white">Setlist Tracker</span>
            </div>
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

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon, badge }) => (
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
        </nav>

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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-white">Setlist Tracker</span>
        </div>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>
    </div>
  );
}

// Friends View Component
function FriendsView({
  user, friends, pendingFriendRequests, sentFriendRequests, pendingShowTags,
  onSendFriendRequestByEmail, onSendFriendRequest, onAcceptFriendRequest,
  onDeclineFriendRequest, onRemoveFriend, onAcceptShowTag, onDeclineShowTag
}) {
  const [activeTab, setActiveTab] = useState('friends');
  const [searchEmail, setSearchEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendRequest = async () => {
    if (!searchEmail.trim()) return;
    setSending(true);
    await onSendFriendRequestByEmail(searchEmail);
    setSending(false);
    setSearchEmail('');
  };

  const requestCount = pendingFriendRequests.length + pendingShowTags.length;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Friends</h1>
      <p className="text-white/60 mb-6">Connect with friends and tag them at shows</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'friends', label: `My Friends (${friends.length})` },
          { id: 'requests', label: `Requests${requestCount > 0 ? ` (${requestCount})` : ''}` },
          { id: 'find', label: 'Find Friends' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
          >
            {tab.label}
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
                <button
                  onClick={() => onRemoveFriend(friend.friendUid)}
                  className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Remove friend"
                >
                  <UserX className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
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

          {pendingFriendRequests.length === 0 && pendingShowTags.length === 0 && sentFriendRequests.length === 0 && (
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
    </div>
  );
}

// Tag Friends Modal Component
function TagFriendsModal({ show, friends, onTag, onClose }) {
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [sending, setSending] = useState(false);

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

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Tag Friends</h2>
            <button onClick={onClose} className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5" />
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

        {/* Friend list */}
        <div className="flex-1 overflow-y-auto p-6">
          {friends.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">Add friends first from the Friends page!</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-white/50 mb-3">Select friends who were at this show:</p>
              {friends.map(friend => (
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
        </div>

        {/* Footer */}
        {friends.length > 0 && (
          <div className="p-6 border-t border-white/10 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleTag}
              disabled={selectedFriends.size === 0 || sending}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all ${
                selectedFriends.size > 0 && !sending
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
            >
              {sending ? 'Tagging...' : `Tag ${selectedFriends.size} Friend${selectedFriends.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Invite View Component
function InviteView({ currentUserUid }) {
  const [email, setEmail] = useState('');

  const inviteUrl = currentUserUid ? `https://mysetlists.net?ref=${currentUserUid}` : 'https://mysetlists.net';

  const handleInvite = () => {
    const subject = encodeURIComponent('Join me on Setlist Tracker!');
    const body = encodeURIComponent(
      `Hey!\n\nI've been using MySetlists to keep track of all the concerts I've been to. You can save setlists, rate songs, and see your concert stats.\n\nCheck it out and join the community!\n\n${inviteUrl}`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Invite Friends</h1>
      <p className="text-white/60 mb-8">Share Setlist Tracker with your concert-going friends.</p>

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
            value={inviteUrl}
            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white/60"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
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
    const subject = encodeURIComponent('Setlist Tracker Feedback');
    const body = encodeURIComponent(feedback);
    window.location.href = `mailto:pdl33@icloud.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Send Feedback</h1>
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

// Release Notes View Component
function ReleaseNotesView() {
  const releases = [
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
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Import Shows</h1>
      <p className="text-white/60 mb-8">Import your concert history from CSV, Excel, Google Sheets, or a screenshot</p>

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
                        <span className="text-red-400 text-xs" title={row.errors.join(', ')}>
                          <AlertTriangle className="w-4 h-4 inline mr-1" />
                          Error
                        </span>
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
                  <button
                    onClick={() => onAddFriend(user.odubleserId, user.firstName, '')}
                    className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                    title="Add friend"
                  >
                    <UserPlus className="w-3 h-3 inline mr-1" />
                    Add
                  </button>
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
                  <button
                    onClick={() => onAddFriend(user.odubleserId, user.firstName, '')}
                    className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                    title="Add friend"
                  >
                    <UserPlus className="w-3 h-3 inline mr-1" />
                    Add
                  </button>
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
                <button
                  onClick={clearArtistSelection}
                  className="text-white/60 hover:text-white p-1"
                  title="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
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
  const [authModal, setAuthModal] = useState(null); // null | 'login' | 'signup' | 'forgot-password'
  const [guestMode, setGuestMode] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false); // Prompt to create account after first show

  // Capture invite referral from URL param (?ref=uid) and persist in localStorage
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const refUid = searchParams.get('ref');
    if (refUid) {
      localStorage.setItem('invite-referrer', refUid);
      // Clean the URL without reloading the page
      window.history.replaceState({}, '', window.location.pathname);
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

  // Admin
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // Derived friends data
  const friendUids = useMemo(() => friends.map(f => f.friendUid), [friends]);
  const pendingNotificationCount = pendingFriendRequests.length + pendingShowTags.length;

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

    return () => {
      unsubIncoming();
      unsubSent();
      unsubTags();
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
  const enterGuestMode = () => {
    setGuestMode(true);
    loadGuestShows();
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
      for (const friendUid of selectedFriendUids) {
        await addDoc(collection(db, 'showTags'), {
          fromUid: user.uid,
          fromName: user.displayName || 'Anonymous',
          toUid: friendUid,
          showData: sanitizedShow,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }
      setTagFriendsShow(null);
    } catch (error) {
      console.error('Failed to tag friends:', error);
      alert('Failed to tag friends. Please try again.');
    }
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

  // Show login screen if not authenticated and not in guest mode
  if (!user && !guestMode) {
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
                <h1 className="text-2xl font-bold tracking-tight">Setlist Tracker</h1>
              </div>
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
            <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-2xl shadow-emerald-500/40">
              <Music className="w-10 h-10 md:w-14 md:h-14 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6 bg-gradient-to-r from-white via-emerald-100 to-teal-200 bg-clip-text text-transparent">
              Track Your Concert Journey
            </h2>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Migration Prompt Modal */}
      {showMigrationPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-3 md:p-4 z-30">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-50">
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

      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={(view) => { setActiveView(view); setSelectedArtist(null); }}
        isAdmin={isAdmin}
        onLogout={guestMode ? () => { setGuestMode(false); setShows([]); } : handleLogout}
        userName={guestMode ? 'Guest' : extractFirstName(user?.displayName)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isGuest={guestMode}
        onCreateAccount={() => openAuthModal('signup')}
        pendingNotificationCount={pendingNotificationCount}
      />

      {/* Main Content Area */}
      <div className="ml-0 md:ml-64 min-h-screen pt-14 md:pt-0">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-8">
          {activeView === 'shows' && (
          <>
            {/* Summary stats */}
            {shows.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
                {[
                  { label: 'Shows', value: shows.length, color: 'from-emerald-400 to-teal-400' },
                  { label: 'Songs', value: summaryStats.totalSongs, color: 'from-violet-400 to-purple-400' },
                  { label: 'Artists', value: summaryStats.uniqueArtists, color: 'from-amber-400 to-orange-400' },
                  { label: 'Venues', value: summaryStats.uniqueVenues, color: 'from-cyan-400 to-blue-400' },
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
                <h1 className="text-xl md:text-2xl font-bold text-white mb-1">My Shows</h1>
                <p className="text-white/60">All the concerts you've attended</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setActiveView('search')}
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
                <button
                  onClick={() => setActiveView('import')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all whitespace-nowrap border border-white/10"
                >
                  <Upload className="w-4 h-4" />
                  Import File
                </button>
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
                    onClick={() => setActiveView('search')}
                    className="relative inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
                  >
                    <span className="absolute inset-0 rounded-xl bg-emerald-400 animate-ping opacity-20" />
                    <Search className="w-5 h-5" />
                    Search for a Show
                  </button>
                  <button
                    onClick={() => setActiveView('import')}
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
                onTagFriends={!guestMode ? (show) => setTagFriendsShow(show) : undefined}
              />
            )}

            {tagFriendsShow && (
              <TagFriendsModal
                show={tagFriendsShow}
                friends={friends}
                onTag={(selectedFriendUids) => tagFriendsAtShow(tagFriendsShow, selectedFriendUids)}
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
          />
        )}

        {activeView === 'invite' && !guestMode && (
          <InviteView currentUserUid={user?.uid} />
        )}

        {activeView === 'feedback' && (
          <FeedbackView />
        )}

        {activeView === 'release-notes' && (
          <ReleaseNotesView />
        )}

        {activeView === 'import' && (
          <ImportView onImport={addShow} onUpdateShow={updateShowData} existingShows={shows} onNavigate={(view) => {
            setActiveView(view);
            // Reload shows from Firestore to ensure imported shows + setlists are reflected
            if (view === 'shows' && user && !guestMode) {
              loadShows(user.uid);
            }
          }} />
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
        </div>
      </div>

      <Footer />

      {/* PWA Install Prompt */}
      <InstallPrompt />
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

function SetlistEditor({ show, onAddSong, onRateSong, onCommentSong, onDeleteSong, onRateShow, onCommentShow, onBatchRate, onClose, onTagFriends }) {
  const [songName, setSongName] = useState('');
  const [batchRating, setBatchRating] = useState(5);
  const [editingComment, setEditingComment] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [editingShowComment, setEditingShowComment] = useState(false);
  const [showCommentText, setShowCommentText] = useState(show.comment || '');
  const [shareSuccess, setShareSuccess] = useState(false);

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-2 md:p-4 z-20">
      <div className="bg-slate-900 border border-white/10 rounded-2xl md:rounded-3xl max-w-[95vw] sm:max-w-lg md:max-w-2xl w-full max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 md:p-6 border-b border-white/10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl md:text-2xl font-bold" style={{ color: artistColor(show.artist) }}>{show.artist}</h2>
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
            <div className="flex items-start gap-2">
              {onTagFriends && (
                <button
                  onClick={() => onTagFriends(show)}
                  className="p-3 md:p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                  title="Tag friends at this show"
                >
                  <Tag className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={handleShare}
                className={`p-3 md:p-2 rounded-xl transition-colors ${shareSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                title="Share setlist"
              >
                {shareSuccess ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
              </button>
              <button onClick={onClose} className="p-3 md:p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
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
                className="px-4 py-2 md:px-3 md:py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm md:text-xs font-medium transition-colors"
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

function StatsView({ shows, songStats, artistStats, venueStats, topRatedShows, onRateSong, onCommentSong, onAddSong, onDeleteSong, onRateShow, onCommentShow, onBatchRate }) {
  const [tab, setTab] = useState('years');
  const [selectedYear, setSelectedYear] = useState(null);
  const [filterArtist, setFilterArtist] = useState('');
  const [filterVenue, setFilterVenue] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [expandedVenue, setExpandedVenue] = useState(null);
  const [expandedYear, setExpandedYear] = useState(null);
  const [expandedShow, setExpandedShow] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);

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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userShows, setUserShows] = useState([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [selectedAdminShow, setSelectedAdminShow] = useState(null);
  const [showSortBy, setShowSortBy] = useState('date');
  const [showSearchTerm, setShowSearchTerm] = useState('');

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
  };

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
              <div>
                <h2 className="text-xl font-bold text-white">
                  {selectedUser.displayName || selectedUser.firstName || 'Anonymous'}'s Shows
                </h2>
                <p className="text-sm text-white/50">{selectedUser.email}</p>
              </div>
            </div>
          </div>

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
          {/* Users List View (existing) */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold text-white">Admin Portal</h2>
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
