'use client';
import { useState, useEffect, useMemo } from 'react';
import { User, Mail, Calendar, Music, MapPin, Star, Trophy, Edit2, Save, X, Camera, Trash2, MailX, LogOut, MessageSquare, Users, Eye } from 'lucide-react';
import { doc, updateDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { updateProfile, signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { apiUrl } from '@/lib/api';
import NotificationSettings from '@/components/notifications/NotificationSettings';

export default function ProfileView({ user, shows, userRank, onProfileUpdate, onViewShow, confirmedSuggestions = [], friends = [] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [memberSince, setMemberSince] = useState(null);

  // Email opt-out state
  const [emailOptOut, setEmailOptOut] = useState(false);
  const [emailOptOutLoading, setEmailOptOutLoading] = useState(false);

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Comments state
  const [commentsTab, setCommentsTab] = useState('my');
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

      // Load member since date and email preferences from Firestore
      const loadProfile = async () => {
        const profileRef = doc(db, 'userProfiles', user.uid);
        const profile = await getDoc(profileRef);
        if (profile.exists()) {
          if (profile.data().createdAt) {
            setMemberSince(profile.data().createdAt.toDate());
          }
          setEmailOptOut(profile.data().emailOptOut || false);
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
    if (!confirmedSuggestions || confirmedSuggestions.length === 0) {
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
            if (data.authorUid !== user.uid) {
              allComments.push({
                id: d.id,
                ...data,
                suggestionId: suggestion.id,
                showData: suggestion.showData || suggestion.sharedShow || {},
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
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim(),
        photoURL: photoURL.trim() || null
      });

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

  const handleEmailOptOutToggle = async () => {
    if (!user?.uid) return;
    setEmailOptOutLoading(true);
    const newValue = !emailOptOut;
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(apiUrl('/api/email-preferences'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emailOptOut: newValue }),
      });
      if (!res.ok) throw new Error('Failed to update preferences');
      setEmailOptOut(newValue);
    } catch (err) {
      console.error('Failed to update email preferences:', err);
    } finally {
      setEmailOptOutLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.uid) return;
    if (deleteConfirmEmail.toLowerCase() !== (user.email || '').toLowerCase()) {
      setDeleteError('Email address does not match your account.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(apiUrl('/api/delete-account'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmEmail: deleteConfirmEmail }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Deletion failed');
      }

      await signOut(auth);
      window.location.href = '/';
    } catch (err) {
      console.error('Account deletion failed:', err);
      setDeleteError(err.message || 'Failed to delete account. Please try again.');
      setDeleteLoading(false);
    }
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

  const paginatedMyComments = myComments.slice(0, myCommentsPage * COMMENTS_PER_PAGE);
  const paginatedFriendComments = filteredFriendComments.slice(0, friendCommentsPage * COMMENTS_PER_PAGE);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-hover border border-subtle rounded-2xl p-6">
        <div className="flex items-start gap-6">
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
              className={`w-24 h-24 rounded-2xl bg-gradient-to-br from-brand to-amber flex items-center justify-center ${photoURL || user?.photoURL ? 'hidden' : ''}`}
            >
              <User className="w-12 h-12 text-primary" />
            </div>
            {isEditing && (
              <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
            )}
          </div>

          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                  className="w-full px-4 py-2 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary placeholder-muted"
                />
                <input
                  type="url"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="Photo URL (optional)"
                  className="w-full px-4 py-2 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary placeholder-muted text-sm"
                />
                {error && <p className="text-danger text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand disabled:opacity-50 text-primary rounded-xl font-medium transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-primary">
                    {user?.displayName || 'Anonymous'}
                  </h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-hover hover:bg-hover text-secondary rounded-lg text-sm font-medium transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                </div>
                <div className="flex items-center gap-2 text-secondary mt-1">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2 text-secondary mt-1">
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
        <StatCard icon={<Music className="w-5 h-5" />} label="Shows" value={stats.totalShows} color="emerald" />
        <StatCard icon={<Music className="w-5 h-5" />} label="Songs Heard" value={stats.totalSongs} color="teal" />
        <StatCard icon={<Star className="w-5 h-5" />} label="Songs Rated" value={stats.ratedSongs} color="amber" />
        <StatCard icon={<MapPin className="w-5 h-5" />} label="Venues" value={stats.uniqueVenues} color="cyan" />
        <StatCard icon={<User className="w-5 h-5" />} label="Artists" value={stats.uniqueArtists} color="purple" />
        <StatCard icon={<Trophy className="w-5 h-5" />} label="Rank" value={userRank ? `#${userRank.rank}` : '-'} subtext={userRank ? `of ${userRank.total}` : ''} color="amber" />
      </div>

      {/* Average Rating */}
      {stats.avgShowRating && (
        <div className="bg-hover border border-subtle rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-primary">Average Show Rating</h3>
              <p className="text-secondary text-sm">Based on {shows.filter(s => s.rating).length} rated shows</p>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-brand fill-amber" />
              <span className="text-3xl font-bold text-primary">{stats.avgShowRating}</span>
              <span className="text-secondary">/10</span>
            </div>
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div className="bg-hover border border-subtle rounded-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-amber flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary">Comments</h3>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCommentsTab('my')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                commentsTab === 'my'
                  ? 'bg-brand/20 text-brand border border-brand/30'
                  : 'bg-hover text-secondary hover:bg-[rgba(255,255,255,0.08)] border border-subtle'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              My Comments
              {myComments.length > 0 && (
                <span className="bg-[rgba(255,255,255,0.1)] px-2 py-0.5 rounded-full text-xs">{myComments.length}</span>
              )}
            </button>
            <button
              onClick={() => setCommentsTab('friends')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                commentsTab === 'friends'
                  ? 'bg-brand/20 text-brand border border-brand/30'
                  : 'bg-hover text-secondary hover:bg-[rgba(255,255,255,0.08)] border border-subtle'
              }`}
            >
              <Users className="w-4 h-4" />
              Friends' Comments
              {friendComments.length > 0 && (
                <span className="bg-[rgba(255,255,255,0.1)] px-2 py-0.5 rounded-full text-xs">{friendComments.length}</span>
              )}
            </button>
          </div>
        </div>

        <div className="px-6 pb-5">
          {commentsTab === 'my' && (
            <div className="space-y-3 mt-3">
              {myComments.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-10 h-10 text-muted mx-auto mb-3" />
                  <p className="text-muted text-sm">No comments yet. Add notes to your shows to remember the details!</p>
                </div>
              ) : (
                <>
                  {paginatedMyComments.map((comment, i) => (
                    <div key={`${comment.show?.id}-${comment.songName || 'show'}-${i}`} className="bg-surface border border-subtle rounded-xl p-4 hover:bg-[rgba(255,255,255,0.04)] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-muted mb-1.5">
                            <span className={`px-2 py-0.5 rounded-full ${comment.type === 'show' ? 'bg-brand/20 text-brand' : 'bg-amber/20 text-amber'}`}>
                              {comment.type === 'show' ? 'Show Note' : 'Song Note'}
                            </span>
                            <span>{formatShowDate(comment.date)}</span>
                          </div>
                          <p className="text-primary text-sm leading-relaxed">{comment.text}</p>
                          <div className="mt-2 text-xs text-secondary">
                            <span className="font-medium text-primary">{comment.show?.artist}</span>
                            {comment.songName && <span> &middot; {comment.songName}</span>}
                            <span> &middot; {comment.show?.venue}</span>
                          </div>
                        </div>
                        {onViewShow && comment.show?.id && (
                          <button
                            onClick={() => onViewShow(comment.show)}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-hover hover:bg-[rgba(255,255,255,0.1)] text-secondary hover:text-primary rounded-lg text-xs font-medium transition-colors"
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
                      className="w-full py-3 text-sm text-secondary hover:text-primary transition-colors"
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
              {uniqueCommenters.length > 1 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted">Filter by friend:</span>
                  <select
                    value={filterFriend}
                    onChange={(e) => { setFilterFriend(e.target.value); setFriendCommentsPage(1); }}
                    className="bg-hover border border-subtle rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand/50"
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
                  <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-muted text-sm">Loading friend comments...</p>
                </div>
              ) : filteredFriendComments.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-muted mx-auto mb-3" />
                  <p className="text-muted text-sm">
                    {filterFriend
                      ? `No comments from ${filterFriend} yet.`
                      : "No friend comments yet. Share shows with friends to see their thoughts!"}
                  </p>
                </div>
              ) : (
                <>
                  {paginatedFriendComments.map((comment) => (
                    <div key={comment.id} className="bg-surface border border-subtle rounded-xl p-4 hover:bg-[rgba(255,255,255,0.04)] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-muted mb-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-brand/20 text-brand">
                              {comment.authorName || 'Friend'}
                            </span>
                            <span>{formatTimestamp(comment.createdAt)}</span>
                          </div>
                          <p className="text-primary text-sm leading-relaxed">{comment.text}</p>
                          {comment.showData && (
                            <div className="mt-2 text-xs text-secondary">
                              <span className="font-medium text-primary">{comment.showData.artist}</span>
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
                      className="w-full py-3 text-sm text-secondary hover:text-primary transition-colors"
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

      {/* Email Preferences */}
      <div className="bg-hover border border-subtle rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
          <MailX className="w-5 h-5 text-brand" />
          Email Preferences
        </h3>
        <div className="flex items-start gap-3">
          <label className="flex items-start gap-3 cursor-pointer group flex-1">
            <input
              type="checkbox"
              checked={emailOptOut}
              onChange={handleEmailOptOutToggle}
              disabled={emailOptOutLoading}
              className="mt-1 w-4 h-4 rounded border-active bg-hover text-brand focus:ring-brand/50 focus:ring-offset-0 cursor-pointer"
            />
            <div>
              <span className="text-primary text-sm font-medium group-hover:text-brand transition-colors">
                Unsubscribe from all emails
              </span>
              <p className="text-secondary text-xs mt-0.5">
                Stop receiving invite notifications, tag alerts, and other emails from MySetlists. Essential account emails (password resets) will still be sent.
              </p>
            </div>
          </label>
        </div>
        {emailOptOutLoading && (
          <p className="text-muted text-xs mt-2">Saving...</p>
        )}
      </div>

      {/* Delete Account */}
      <div className="bg-hover border border-red-500/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-500" />
          Delete Account
        </h3>
        <p className="text-secondary text-sm mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl font-medium transition-colors text-sm"
        >
          <Trash2 className="w-4 h-4" />
          Delete My Account
        </button>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-subtle rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-primary mb-2">Delete your account?</h3>
            <p className="text-secondary text-sm mb-4">
              This will permanently delete your account, all your shows, friend connections, tags, and any other data. This cannot be undone.
            </p>
            <p className="text-secondary text-sm mb-4">
              Type your email address <strong className="text-primary">{user?.email}</strong> to confirm:
            </p>
            <input
              type="email"
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              placeholder="Enter your email to confirm"
              className="w-full px-4 py-3 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 text-primary placeholder-muted mb-4"
              disabled={deleteLoading}
            />
            {deleteError && (
              <p className="text-red-500 text-sm mb-4">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deleteConfirmEmail}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmEmail('');
                  setDeleteError('');
                }}
                disabled={deleteLoading}
                className="px-4 py-3 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, subtext, color }) {
  const colorClasses = {
    emerald: 'from-brand to-brand',
    teal: 'from-amber to-amber',
    amber: 'from-brand to-brand',
    cyan: 'from-amber to-amber',
    purple: 'from-amber to-brand',
  };

  return (
    <div className="bg-hover border border-subtle rounded-2xl p-4 hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] hover:scale-[1.02] transition-all duration-200 cursor-default">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-primary">{value}</div>
      {subtext && <div className="text-sm text-muted">{subtext}</div>}
      <div className="text-sm text-secondary">{label}</div>
    </div>
  );
}
