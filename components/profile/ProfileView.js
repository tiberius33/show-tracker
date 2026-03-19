'use client';
import { useState, useEffect } from 'react';
import { User, Mail, Calendar, Music, MapPin, Star, Trophy, Edit2, Save, X, Camera } from 'lucide-react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import NotificationSettings from '@/components/notifications/NotificationSettings';

export default function ProfileView({ user, shows, userRank, onProfileUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [memberSince, setMemberSince] = useState(null);

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-highlight border border-subtle rounded-2xl p-6">
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
              className={`w-24 h-24 rounded-2xl bg-gradient-to-br from-accent-amber to-accent-teal flex items-center justify-center ${photoURL || user?.photoURL ? 'hidden' : ''}`}
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
                  className="w-full px-4 py-2 bg-highlight border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-amber/50 text-primary placeholder-muted"
                />
                <input
                  type="url"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="Photo URL (optional)"
                  className="w-full px-4 py-2 bg-highlight border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-amber/50 text-primary placeholder-muted text-sm"
                />
                {error && <p className="text-danger text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-accent-amber hover:bg-accent-amber disabled:opacity-50 text-primary rounded-xl font-medium transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-highlight hover:bg-highlight text-secondary rounded-xl font-medium transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-primary font-display">
                    {user?.displayName || 'Anonymous'}
                  </h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-highlight hover:bg-highlight text-secondary rounded-lg text-sm font-medium transition-colors"
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
        <div className="bg-highlight border border-subtle rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-primary font-display">Average Show Rating</h3>
              <p className="text-secondary text-sm">Based on {shows.filter(s => s.rating).length} rated shows</p>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-accent-amber fill-accent-amber" />
              <span className="text-3xl font-bold text-primary">{stats.avgShowRating}</span>
              <span className="text-secondary">/10</span>
            </div>
          </div>
        </div>
      )}

      {/* Notification Settings */}
      <NotificationSettings userId={user?.uid} />
    </div>
  );
}

function StatCard({ icon, label, value, subtext, color }) {
  const colorClasses = {
    emerald: 'from-accent-amber to-accent-amber',
    teal: 'from-accent-teal to-accent-teal',
    amber: 'from-accent-amber to-accent-amber',
    cyan: 'from-accent-teal to-accent-teal',
    purple: 'from-accent-teal to-accent-amber',
  };

  return (
    <div className="bg-highlight border border-subtle rounded-2xl p-4">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-primary">{value}</div>
      {subtext && <div className="text-sm text-muted">{subtext}</div>}
      <div className="text-sm text-secondary">{label}</div>
    </div>
  );
}
