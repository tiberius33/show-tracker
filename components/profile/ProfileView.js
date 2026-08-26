'use client';
import { useState, useEffect, useMemo } from 'react';
import { User, Mail, Calendar, Music, MapPin, Star, Trophy, Edit2, Save, X, Camera, Trash2, MailX, LogOut, MessageSquare, Eye, Heart, Info, Sparkles } from 'lucide-react';
import { Button, Card, Badge, Input, Modal } from '@/components/ui';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile, signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { apiUrl } from '@/lib/api';
import { artistColor } from '@/lib/utils';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import TourInfoModal from '@/components/TourInfoModal';
import ArtistAIChat from '@/components/ArtistAIChat';

export default function ProfileView({ user, shows, userRank, onProfileUpdate, onViewShow, friends = [], favoriteArtists = [], onToggleFavoriteArtist }) {
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
  const [myCommentsPage, setMyCommentsPage] = useState(1);
  const [tourInfoArtist, setTourInfoArtist] = useState(null);
  const [aiChatArtist, setAiChatArtist] = useState(null);
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

  // Compute stats per favorite artist
  const favoriteArtistStats = useMemo(() => {
    return favoriteArtists.map(fav => {
      const artistShows = shows.filter(s => s.artist === fav.name);
      const lastShow = artistShows.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
      return {
        ...fav,
        showCount: artistShows.length,
        lastSeen: lastShow?.date || null,
        lastVenue: lastShow?.venue || null,
      };
    });
  }, [favoriteArtists, shows]);

  const paginatedMyComments = myComments.slice(0, myCommentsPage * COMMENTS_PER_PAGE);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card padding="md">
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
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                />
                <Input
                  type="url"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="Photo URL (optional)"
                />
                {error && <p className="text-danger text-sm">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    icon={Save}
                    onClick={handleSave}
                    disabled={saving}
                    loading={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="ghost"
                    icon={X}
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-primary">
                    {user?.displayName || 'Anonymous'}
                  </h2>
                  <Button variant="ghost" size="sm" icon={Edit2} onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
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
      </Card>

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
        <Card padding="md">
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
        </Card>
      )}

      {/* Favorite Artists */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/30 to-red-500/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-primary">Favorite Artists</h3>
                <Badge tone="beta" size="sm" uppercase>Beta</Badge>
              </div>
              <p className="text-xs text-muted">Tap the heart on any artist to add them here</p>
            </div>
          </div>
        </div>
        <div className="px-6 pb-5">
          {favoriteArtistStats.length === 0 ? (
            <div className="text-center py-6">
              <Heart className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-muted text-sm">No favorite artists yet.</p>
              <p className="text-muted text-xs mt-1">Heart an artist in Stats or any show modal to add them.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {favoriteArtistStats.map(artist => (
                <Card key={artist.name} padding="none" className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: artistColor(artist.name) }} />
                    <div className="min-w-0">
                      <span className="font-medium text-primary text-sm">{artist.name}</span>
                      <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                        <span>{artist.showCount} show{artist.showCount !== 1 ? 's' : ''}</span>
                        {artist.lastSeen && <span>Last: {formatShowDate(artist.lastSeen)}</span>}
                        {artist.lastVenue && <span className="truncate hidden sm:inline">{artist.lastVenue}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Sparkles}
                      onClick={() => setAiChatArtist(artist)}
                      className="bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20"
                    >
                      Ask AI
                    </Button>
                    {artist.mbid && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Info}
                        onClick={() => setTourInfoArtist(artist)}
                      >
                        Tour Info
                      </Button>
                    )}
                    {onToggleFavoriteArtist && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Heart}
                        onClick={() => onToggleFavoriteArtist(artist.name)}
                        className="text-red-500"
                        title="Remove from favorites"
                      />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* My Comments Section */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-amber flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary">My Comments</h3>
            {myComments.length > 0 && (
              <span className="bg-brand-subtle text-brand px-2 py-0.5 rounded-full text-xs">{myComments.length}</span>
            )}
          </div>
        </div>

        <div className="px-6 pb-5">
          <div className="space-y-3 mt-3">
            {myComments.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 text-muted mx-auto mb-3" />
                <p className="text-muted text-sm">No comments yet. Add notes to your shows to remember the details!</p>
              </div>
            ) : (
              <>
                {paginatedMyComments.map((comment, i) => (
                  <Card key={`${comment.show?.id}-${comment.songName || 'show'}-${i}`} padding="none" className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted mb-1.5">
                          <Badge tone={comment.type === 'show' ? 'navy' : 'amber'} size="sm">
                            {comment.type === 'show' ? 'Show Note' : 'Song Note'}
                          </Badge>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() => onViewShow(comment.show)}
                        >
                          View Show
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
                {myComments.length > paginatedMyComments.length && (
                  <Button
                    variant="ghost"
                    full
                    onClick={() => setMyCommentsPage(p => p + 1)}
                  >
                    Show more ({myComments.length - paginatedMyComments.length} remaining)
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <NotificationSettings userId={user?.uid} />

      {/* Email Preferences */}
      <Card padding="md">
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
      </Card>

      {/* Delete Account */}
      <Card padding="md" className="border-danger/20">
        <h3 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-danger" />
          Delete Account
        </h3>
        <p className="text-secondary text-sm mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <Button
          variant="danger"
          icon={Trash2}
          onClick={() => setShowDeleteModal(true)}
        >
          Delete My Account
        </Button>
      </Card>

      {/* Delete Account Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmEmail('');
          setDeleteError('');
        }}
        title="Delete your account?"
        size="sm"
      >
        <p className="text-secondary text-sm mb-4">
          This will permanently delete your account, all your shows, friend connections, tags, and any other data. This cannot be undone.
        </p>
        <p className="text-secondary text-sm mb-4">
          Type your email address <strong className="text-primary">{user?.email}</strong> to confirm:
        </p>
        <Input
          type="email"
          value={deleteConfirmEmail}
          onChange={(e) => setDeleteConfirmEmail(e.target.value)}
          placeholder="Enter your email to confirm"
          disabled={deleteLoading}
          className="mb-4"
        />
        {deleteError && (
          <p className="text-danger text-sm mb-4">{deleteError}</p>
        )}
        <div className="flex gap-3">
          <Button
            variant="danger"
            icon={Trash2}
            full
            onClick={handleDeleteAccount}
            disabled={deleteLoading || !deleteConfirmEmail}
            loading={deleteLoading}
          >
            {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setShowDeleteModal(false);
              setDeleteConfirmEmail('');
              setDeleteError('');
            }}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
        </div>
      </Modal>

      {/* Tour Info Modal */}
      {tourInfoArtist && (
        <TourInfoModal
          artistName={tourInfoArtist.name}
          mbid={tourInfoArtist.mbid}
          onClose={() => setTourInfoArtist(null)}
        />
      )}

      {/* Artist AI Chat Modal */}
      {aiChatArtist && (
        <ArtistAIChat
          artistName={aiChatArtist.name}
          mbid={aiChatArtist.mbid}
          userShows={shows.filter(s => s.artist === aiChatArtist.name)}
          onClose={() => setAiChatArtist(null)}
        />
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
    <Card padding="sm" className="cursor-default">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-primary">{value}</div>
      {subtext && <div className="text-sm text-muted">{subtext}</div>}
      <div className="text-sm text-secondary">{label}</div>
    </Card>
  );
}
