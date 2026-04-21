'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Music, Star, Users, Calendar, MapPin } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ProfileView from '@/components/profile/ProfileView';
import ProfileHero from '@/components/profile/ProfileHero';
import AchievementCard from '@/components/profile/AchievementCard';
import { SectionHeader } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function ProfilePage() {
  const {
    user, guestMode, shows, userRank, myConfirmedSuggestions, friends,
    setSelectedShow, setCommentContext, favoriteArtists, toggleFavoriteArtist,
  } = useApp();
  const router = useRouter();

  if (guestMode || !user) return null;

  const stats = {
    shows: shows.length,
    artists: new Set(shows.map(s => s.artist)).size,
    venues: new Set(shows.map(s => s.venue)).size,
    friends: friends.length,
  };

  const achievements = [
    shows.length >= 1   && { icon: Music,    name: 'First show',     description: 'Tracked your first show',   tone: 'green'  },
    shows.length >= 10  && { icon: Star,      name: 'Getting into it', description: '10+ shows tracked',        tone: 'amber'  },
    shows.length >= 50  && { icon: Trophy,    name: 'Dedicated fan',  description: '50+ shows tracked',         tone: 'amber'  },
    shows.length >= 100 && { icon: Trophy,    name: 'Centurion',      description: '100+ shows tracked',        tone: 'amber'  },
    stats.artists >= 10 && { icon: Music,     name: 'Eclectic',       description: '10+ different artists',     tone: 'green'  },
    stats.venues >= 10  && { icon: MapPin,    name: 'Venue hopper',   description: '10+ different venues',      tone: 'purple' },
    friends.length >= 1 && { icon: Users,     name: 'Connected',      description: 'Made a friend on the app',  tone: 'blue'   },
    friends.length >= 5 && { icon: Users,     name: 'Social butterfly', description: '5+ friends',             tone: 'blue'   },
    favoriteArtists.length >= 1 && { icon: Star, name: 'Fan club',   description: 'Followed a favorite artist', tone: 'amber' },
  ].filter(Boolean).slice(0, 4);

  const recentShows = useMemo(() =>
    [...shows]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6),
  [shows]);

  return (
    <>
      <ProfileHero
        name={user.displayName || 'Music Fan'}
        stats={[
          { value: stats.shows,   label: 'Shows'   },
          { value: stats.artists, label: 'Artists' },
          { value: stats.venues,  label: 'Venues'  },
          { value: stats.friends, label: 'Friends' },
        ]}
      />

      {achievements.length > 0 && (
        <>
          <SectionHeader title="Achievements" className="mt-2 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {achievements.map((a) => (
              <AchievementCard
                key={a.name}
                icon={a.icon}
                name={a.name}
                description={a.description}
                tone={a.tone}
              />
            ))}
          </div>
        </>
      )}

      {recentShows.length > 0 && (
        <>
          <SectionHeader title="Recent shows" className="mb-4" />
          <div className="space-y-2 mb-8">
            {recentShows.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSelectedShow(s); router.push('/shows'); }}
                className="w-full flex items-center gap-4 bg-surface border border-subtle rounded-xl px-4 py-3 text-left hover:border-active transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-primary truncate">{s.artist}</div>
                  <div className="text-sm text-secondary truncate">
                    {s.venue}{s.city ? ` · ${s.city}` : ''}
                  </div>
                </div>
                <div className="text-sm text-muted whitespace-nowrap">{formatDate(s.date)}</div>
                {s.rating && (
                  <div className="text-amber font-bold text-sm">★ {s.rating}</div>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Profile settings" className="mb-4" />
      <ProfileView
        user={user}
        shows={shows}
        userRank={userRank}
        onProfileUpdate={() => {}}
        onViewShow={(show, commentData) => {
          setSelectedShow(show);
          if (commentData) setCommentContext(commentData);
          router.push('/shows');
        }}
        confirmedSuggestions={myConfirmedSuggestions}
        friends={friends}
        favoriteArtists={favoriteArtists}
        onToggleFavoriteArtist={toggleFavoriteArtist}
      />
    </>
  );
}
