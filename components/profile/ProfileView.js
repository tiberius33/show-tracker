'use client';
import { useState, useEffect } from 'react';
import { User, Mail, Calendar, Music, MapPin, Star, Trophy, Edit2, Save, X, Camera, Trash2, MailX, LogOut } from 'lucide-react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile, signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { apiUrl } from '@/lib/api';
import NotificationSettings from '@/components/notifications/NotificationSettings';

export default function ProfileView({ user, shows, userRank, onProfileUpdate }) {
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

      // Sign out and redirect
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-hover border border-subtle rounded-2xl p-6">
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

          {/* Profile Info */}
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
    <div className="bg-hover border border-subtle rounded-2xl p-4">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-primary">{value}</div>
      {subtext && <div className="text-sm text-muted">{subtext}</div>}
      <div className="text-sm text-secondary">{label}</div>
    </div>
  );
}
