import { useState, useEffect, useMemo } from 'react';
import { User, Mail, Calendar, Music, MapPin, Star, Trophy, Edit2, Save, X, Camera, MessageSquare, ChevronDown, ChevronUp, Eye, Users } from 'lucide-react';
import { doc, updateDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../../firebase';
import NotificationSettings from '../notifications/NotificationSettings';

export default function ProfileView({ user, shows, userRank, onProfileUpdate, onViewShow, confirmedSuggestions = [], friends = [] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [memberSince, setMemberSince] = useState(null);
  const [commentsTab, setCommentsTab] = useState('my'); // 'my' | 'friends'
  const [friendComments, setFriendComments] = useState([]);
  const [friendCommentsLoading, setFriendCommentsLoading] = useState(false);
  const [friendCommentsLoaded, setFriendCommentsLoaded] = useState(false);
  const [myCommentsPage, setMyCommentsPage] = useState(1);
  const [friendCommentsPage, setFriendCommentsPage] = useState(1);
  const [filterFriend, setFilterFriend] = useState('');
  const COMMENTS_PER_PAGE = 20;

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');

      // Load member since date from Firestore
      const loadProfile = async () => {
        const profileRef = doc(db, 'userProfiles', user.uid);
        const profile = await getDoc(profileRef);
        if (profile.exists() && profile.data().createdAt) {
          setMemberSince(profile.data().createdAt.toDate());
        }
      };
      loadProfile();
    }
  }, [user]);

  // Calculate stats from shows
  const stats = {
    totalShows: shows.length,
    totalSongs: shows.reduce((acc, s) => acc + (s.setlist?.length || 0), 0),
    ratedSongs: shows.reduce((acc, s) => acc + (s.setlist?.filter(song => song.rating)?.length || 0), 0),
    uniqueVenues: new Set(shows.map(s => s.venue)).size,
    uniqueArtists: new Set(shows.map(s => s.artist)).size,
    avgShowRating: shows.filter(s => s.rating).length > 0
      ? (shows.filter(s => s.rating).reduce((a, s) => a + s.rating, 0) / shows.filter(s => s.rating).length).toFixed(1)
      : null
  };

  // Extract all user's comments (show notes + song notes)
  const myComments = useMemo(() => {
    const comments = [];
    shows.forEach(show => {
      if (show.comment && show.comment.trim()) {
        comments.push({
          type: 'show',
          text: show.comment,
          show,
          date: show.date,
          songName: null,
        });
      }
      (show.setlist || []).forEach(song => {
        if (song.comment && song.comment.trim()) {
          comments.push({
            type: 'song',
            text: song.comment,
            show,
            date: show.date,
            songName: song.name,
          });
        }
      });
    });
    // Sort by show date descending
    comments.sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB - dateA;
    });
    return comments;
  }, [shows]);

  // Load friend comments from confirmed suggestions
  useEffect(() => {
    if (commentsTab !== 'friends' || friendCommentsLoaded || !user?.uid) return;
    if (confirmedSuggestions.length === 0) {
      setFriendCommentsLoaded(true);
      return;
    }

    let cancelled = false;
    const loadFriendComments = async () => {
      setFriendCommentsLoading(true);
      const allComments = [];

      for (const suggestion of confirmedSuggestions) {
        try {
          const snap = await getDocs(collection(db, 'showSuggestions', suggestion.id, 'comments'));
          snap.docs.forEach(d => {
            const data = d.data();
            // Only include comments from other users (friends' comments)
            if (data.authorUid !== user.uid) {
              allComments.push({
                id: d.id,
                ...data,
                suggestionId: suggestion.id,
                showData: suggestion.showData || suggestion.sharedShow || {},
                showKey: suggestion.showKey,
              });
            }
          });
        } catch (e) {
          console.error('Failed to load comments for suggestion:', suggestion.id, e);
        }
      }

      if (!cancelled) {
        allComments.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setFriendComments(allComments);
        setFriendCommentsLoaded(true);
        setFriendCommentsLoading(false);
      }
    };

    loadFriendComments();
    return () => { cancelled = true; };
  }, [commentsTab, confirmedSuggestions, user?.uid, friendCommentsLoaded]);

  // Get unique friend names from friend comments for filtering
  const uniqueCommenters = useMemo(() => {
    const names = new Set(friendComments.map(c => c.authorName).filter(Boolean));
    return [...names].sort();
  }, [friendComments]);

  const filteredFriendComments = useMemo(() => {
    if (!filterFriend) return friendComments;
    return friendComments.filter(c => c.authorName === filterFriend);
  }, [friendComments, filterFriend]);

  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    setError('');

    try {
      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim(),
        photoURL: photoURL.trim() || null
      });

      // Update Firestore profile
      const profileRef = doc(db, 'userProfiles', user.uid);
      await updateDoc(profileRef, {
        displayName: displayName.trim(),
        firstName: displayName.trim().split(' ')[0] || 'Anonymous',
        photoURL: photoURL.trim()
      });

      onProfileUpdate?.({ displayName: displayName.trim(), photoURL: photoURL.trim() });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(user?.displayName || '');
    setPhotoURL(user?.photoURL || '');
    setIsEditing(false);
    setError('');
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatShowDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const formatTimestamp = (ts) => {
    if (!ts?.seconds) return '';
    return new Date(ts.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Paginated slices
  const paginatedMyComments = myComments.slice(0, myCommentsPage * COMMENTS_PER_PAGE);
  const paginatedFriendComments = filteredFriendComments.slice(0, friendCommentsPage * COMMENTS_PER_PAGE);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-start gap-6">
          {/* Profile Photo */}
          <div className="relative">
            {photoURL || user?.photoURL ? (
              <img
                src={photoURL || user?.photoURL}
                alt=""
                className="w-24 h-24 rounded-2xl object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={`w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center ${photoURL || user?.photoURL ? 'hidden' : ''}`}
            >
              <User className="w-12 h-12 text-white" />
            </div>
            {isEditing && (
              <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                  className="w-full px-4 py-2 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
                />
                <input
                  type="url"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="Photo URL (optional)"
                  className="w-full px-4 py-2 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40 text-sm"
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">
                    {user?.displayName || 'Anonymous'}
                  </h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                </div>
                <div className="flex items-center gap-2 text-white/60 mt-1">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2 text-white/60 mt-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Member since {formatDate(memberSince)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Music className="w-5 h-5" />}
          label="Shows"
          value={stats.totalShows}
          color="emerald"
        />
        <StatCard
          icon={<Music className="w-5 h-5" />}
          label="Songs Heard"
          value={stats.totalSongs}
          color="teal"
        />
        <StatCard
          icon={<Star className="w-5 h-5" />}
          label="Songs Rated"
          value={stats.ratedSongs}
          color="amber"
        />
        <StatCard
          icon={<MapPin className="w-5 h-5" />}
          label="Venues"
          value={stats.uniqueVenues}
          color="cyan"
        />
        <StatCard
          icon={<User className="w-5 h-5" />}
          label="Artists"
          value={stats.uniqueArtists}
          color="purple"
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" />}
          label="Rank"
          value={userRank ? `#${userRank.rank}` : '-'}
          subtext={userRank ? `of ${userRank.total}` : ''}
          color="amber"
        />
      </div>

      {/* Average Rating */}
      {stats.avgShowRating && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Average Show Rating</h3>
              <p className="text-white/50 text-sm">Based on {shows.filter(s => s.rating).length} rated shows</p>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
              <span className="text-3xl font-bold text-white">{stats.avgShowRating}</span>
              <span className="text-white/50">/10</span>
            </div>
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {/* Comments Header */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white">Comments</h3>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2">
            <button
              onClick={() => setCommentsTab('my')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                commentsTab === 'my'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              My Comments
              {myComments.length > 0 && (
                <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs">{myComments.length}</span>
              )}
            </button>
            <button
              onClick={() => setCommentsTab('friends')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                commentsTab === 'friends'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              <Users className="w-4 h-4" />
              Friends' Comments
              {friendComments.length > 0 && (
                <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs">{friendComments.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Comments Content */}
        <div className="px-6 pb-5">
          {commentsTab === 'my' && (
            <div className="space-y-3 mt-3">
              {myComments.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">No comments yet. Add notes to your shows to remember the details!</p>
                </div>
              ) : (
                <>
                  {paginatedMyComments.map((comment, i) => (
                    <div key={`${comment.show?.id}-${comment.songName || 'show'}-${i}`} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-white/40 mb-1.5">
                            <span className={`px-2 py-0.5 rounded-full ${comment.type === 'show' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/20 text-violet-400'}`}>
                              {comment.type === 'show' ? 'Show Note' : 'Song Note'}
                            </span>
                            <span>{formatShowDate(comment.date)}</span>
                          </div>
                          <p className="text-white/90 text-sm leading-relaxed">{comment.text}</p>
                          <div className="mt-2 text-xs text-white/50">
                            <span className="font-medium text-white/70">{comment.show?.artist}</span>
                            {comment.songName && <span> &middot; {comment.songName}</span>}
                            <span> &middot; {comment.show?.venue}</span>
                          </div>
                        </div>
                        {onViewShow && comment.show?.id && (
                          <button
                            onClick={() => onViewShow(comment.show)}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Show
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {myComments.length > paginatedMyComments.length && (
                    <button
                      onClick={() => setMyCommentsPage(p => p + 1)}
                      className="w-full py-3 text-sm text-white/50 hover:text-white/80 transition-colors"
                    >
                      Show more ({myComments.length - paginatedMyComments.length} remaining)
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {commentsTab === 'friends' && (
            <div className="space-y-3 mt-3">
              {/* Friend filter */}
              {uniqueCommenters.length > 1 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-white/40">Filter by friend:</span>
                  <select
                    value={filterFriend}
                    onChange={(e) => { setFilterFriend(e.target.value); setFriendCommentsPage(1); }}
                    className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">All friends</option>
                    {uniqueCommenters.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              {friendCommentsLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-white/40 text-sm">Loading friend comments...</p>
                </div>
              ) : filteredFriendComments.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">
                    {filterFriend
                      ? `No comments from ${filterFriend} yet.`
                      : "No friend comments yet. Share shows with friends to see their thoughts!"}
                  </p>
                </div>
              ) : (
                <>
                  {paginatedFriendComments.map((comment) => (
                    <div key={comment.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-white/40 mb-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                              {comment.authorName || 'Friend'}
                            </span>
                            <span>{formatTimestamp(comment.createdAt)}</span>
                          </div>
                          <p className="text-white/90 text-sm leading-relaxed">{comment.text}</p>
                          {comment.showData && (
                            <div className="mt-2 text-xs text-white/50">
                              <span className="font-medium text-white/70">{comment.showData.artist}</span>
                              <span> &middot; {comment.showData.venue}</span>
                              {comment.showData.date && <span> &middot; {formatShowDate(comment.showData.date)}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredFriendComments.length > paginatedFriendComments.length && (
                    <button
                      onClick={() => setFriendCommentsPage(p => p + 1)}
                      className="w-full py-3 text-sm text-white/50 hover:text-white/80 transition-colors"
                    >
                      Show more ({filteredFriendComments.length - paginatedFriendComments.length} remaining)
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <NotificationSettings userId={user?.uid} />
    </div>
  );
}

function StatCard({ icon, label, value, subtext, color }) {
  const colorClasses = {
    emerald: 'from-emerald-400 to-emerald-600',
    teal: 'from-teal-400 to-teal-600',
    amber: 'from-amber-400 to-amber-600',
    cyan: 'from-cyan-400 to-cyan-600',
    purple: 'from-purple-400 to-purple-600',
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] transition-all duration-200 cursor-default">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <span className="text-white">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtext && <div className="text-sm text-white/40">{subtext}</div>}
      <div className="text-sm text-white/60">{label}</div>
    </div>
  );
}
