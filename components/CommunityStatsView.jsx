'use client';

import React from 'react';
import { Star, Users, User, Building2, TrendingUp, Trophy, UserPlus } from 'lucide-react';
import Tip from '@/components/ui/Tip';

function CommunityStatsView({ communityStats, onAddFriend, currentUserUid, currentFriendUids }) {
  if (!communityStats) {
    return (
      <div className="text-center py-16">
        <Users className="w-12 h-12 text-muted mx-auto mb-4" />
        <p className="text-muted">Loading community stats...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-bold text-primary mb-2 font-display">Community Stats</h1>
      <p className="text-secondary mb-8">See how you compare with other show-goers</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Show-Goers */}
        <div className="bg-highlight backdrop-blur-xl rounded-2xl border border-subtle p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-accent-amber to-accent-amber rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-semibold text-primary text-lg font-display">Top Show-Goers</h2>
          </div>
          <div className="space-y-3">
            {(communityStats.topShowsAttended || []).slice(0, 5).map((user, i) => (
              <div key={user.odubleserId} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-accent-amber' : i === 1 ? 'text-secondary' : i === 2 ? 'text-accent-amber' : 'text-muted'}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-amber to-accent-amber flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="text-secondary flex-1">{user.firstName}</span>
                {onAddFriend && user.odubleserId !== currentUserUid && !(currentFriendUids || []).includes(user.odubleserId) && (
                  <Tip text="Add friend">
                    <button
                      onClick={() => onAddFriend(user.odubleserId, user.firstName, '')}
                      className="px-2 py-1 bg-accent-amber-glow text-accent-amber rounded-lg text-xs font-medium hover:bg-accent-amber/30 transition-colors"
                    >
                      <UserPlus className="w-3 h-3 inline mr-1" />
                      Add
                    </button>
                  </Tip>
                )}
                <span className="bg-accent-amber-glow text-accent-amber px-3 py-1 rounded-full text-sm font-semibold">
                  {user.count} shows
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Raters */}
        <div className="bg-highlight backdrop-blur-xl rounded-2xl border border-subtle p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-danger to-danger rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-semibold text-primary text-lg font-display">Top Raters</h2>
          </div>
          <div className="space-y-3">
            {(communityStats.topSongsRated || []).slice(0, 5).map((user, i) => (
              <div key={user.odubleserId} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-accent-teal' : i === 1 ? 'text-secondary' : i === 2 ? 'text-accent-teal' : 'text-muted'}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-danger to-danger flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="text-secondary flex-1">{user.firstName}</span>
                {onAddFriend && user.odubleserId !== currentUserUid && !(currentFriendUids || []).includes(user.odubleserId) && (
                  <Tip text="Add friend">
                    <button
                      onClick={() => onAddFriend(user.odubleserId, user.firstName, '')}
                      className="px-2 py-1 bg-accent-amber-glow text-accent-amber rounded-lg text-xs font-medium hover:bg-accent-amber/30 transition-colors"
                    >
                      <UserPlus className="w-3 h-3 inline mr-1" />
                      Add
                    </button>
                  </Tip>
                )}
                <span className="bg-accent-teal-glow text-accent-teal px-3 py-1 rounded-full text-sm font-semibold">
                  {user.count} ratings
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Rated Songs */}
        <div className="bg-highlight backdrop-blur-xl rounded-2xl border border-subtle p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-accent-teal to-accent-teal rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-semibold text-primary text-lg font-display">Top Rated Songs</h2>
          </div>
          <div className="space-y-3">
            {(communityStats.topSongsByRating || []).slice(0, 5).map((song, i) => (
              <div key={song.songName} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-accent-teal' : i === 1 ? 'text-secondary' : i === 2 ? 'text-accent-teal' : 'text-muted'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-secondary truncate">{song.songName}</div>
                  <div className="text-muted text-xs truncate">{song.artists?.join(', ')}</div>
                </div>
                <div className="text-right">
                  <span className="bg-accent-teal-glow text-accent-teal px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                    {song.avgRating}/10
                  </span>
                  <div className="text-muted text-xs mt-1">{song.ratingCount} ratings</div>
                </div>
              </div>
            ))}
            {(!communityStats.topSongsByRating || communityStats.topSongsByRating.length === 0) && (
              <p className="text-muted text-sm">Not enough ratings yet. Songs need at least 2 ratings to appear.</p>
            )}
          </div>
        </div>

        {/* Top Venues */}
        <div className="bg-highlight backdrop-blur-xl rounded-2xl border border-subtle p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-accent-teal to-accent-teal rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-semibold text-primary text-lg font-display">Top Venues</h2>
          </div>
          <div className="space-y-3">
            {(communityStats.topVenues || []).slice(0, 5).map((venue, i) => (
              <div key={venue.venueName} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-6 ${i === 0 ? 'text-accent-teal' : i === 1 ? 'text-secondary' : i === 2 ? 'text-accent-teal/60' : 'text-muted'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-secondary truncate">{venue.venueName}</div>
                  <div className="text-muted text-xs">{venue.artistCount} artists</div>
                </div>
                <span className="bg-accent-teal-glow text-accent-teal px-3 py-1 rounded-full text-sm font-semibold">
                  {venue.showCount} shows
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-highlight backdrop-blur-xl rounded-2xl border border-subtle p-6 text-center">
          <div className="text-4xl font-bold bg-gradient-to-r from-accent-amber to-accent-teal bg-clip-text text-transparent">
            {communityStats.totalUsers || 0}
          </div>
          <div className="text-sm text-secondary mt-1">Total Users</div>
        </div>
        <div className="bg-highlight backdrop-blur-xl rounded-2xl border border-subtle p-6 text-center">
          <div className="text-4xl font-bold bg-gradient-to-r from-accent-teal to-accent-teal bg-clip-text text-transparent">
            {communityStats.totalShows || 0}
          </div>
          <div className="text-sm text-secondary mt-1">Total Shows</div>
        </div>
        <div className="bg-highlight backdrop-blur-xl rounded-2xl border border-subtle p-6 text-center">
          <div className="text-4xl font-bold bg-gradient-to-r from-accent-amber to-accent-amber bg-clip-text text-transparent">
            {communityStats.totalSongs || 0}
          </div>
          <div className="text-sm text-secondary mt-1">Total Songs</div>
        </div>
      </div>
    </div>
  );
}

export default CommunityStatsView;
