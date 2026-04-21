'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { parseDate } from '@/lib/utils';
import SetlistView from '@/components/shows/SetlistView';
import ShowHero from '@/components/shows/ShowHero';
import { RatingStars, Avatar, Button, SectionHeader } from '@/components/ui';
import { ArrowLeft, UserPlus } from 'lucide-react';

// "MON · OCT 31 · 1994"
function formatShowDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d || d.getFullYear() < 1900) return dateStr;
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()} · ${d.getFullYear()}`;
}

// Flat setlist array → SetlistView sets[]
function buildSets(setlist = []) {
  if (!setlist.length) return [];
  const groups = {};
  setlist.forEach(song => {
    const key = song.set || 'Set I';
    if (!groups[key]) groups[key] = [];
    groups[key].push(song);
  });
  const order = ['Set I', 'Set II', 'Set III', 'Encore', 'Encore II'];
  const keys = [
    ...order.filter(k => groups[k]),
    ...Object.keys(groups).filter(k => !order.includes(k)),
  ];
  return keys.map(label => ({
    label,
    tracks: (groups[label] || []).map(s => ({
      title: s.song || s.title || s.name || '',
      duration: s.duration || '',
      debut: s.tags?.includes('debut') || s.debut || false,
      bustout: s.tags?.includes('bustout') || s.bustout || false,
      bustoutNote: s.bustoutNote || '',
    })),
  }));
}

export default function ShowDetailClient({ id }) {
  const router = useRouter();
  const { shows, user, friends, updateShowRating, setTagFriendsShow } = useApp();

  const show = useMemo(() => shows.find(s => s.id === id), [shows, id]);

  if (!show) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted">
        <p className="text-lg mb-4">Show not found.</p>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push('/shows')}>
          Back to shows
        </Button>
      </div>
    );
  }

  const sets = buildSets(show.setlist);
  const totalSongs = show.setlist?.length || 0;
  const debuts = (show.setlist || []).filter(s => s.tags?.includes('debut') || s.debut).length;
  const bustouts = (show.setlist || []).filter(s => s.tags?.includes('bustout') || s.bustout);
  const taggedFriendIds = show.taggedFriends || [];
  const taggedFriends = friends.filter(f => taggedFriendIds.includes(f.friendUid));

  const specialLabel = (() => {
    const notes = (show.notes || '').toLowerCase();
    if (notes.includes('halloween')) return 'HALLOWEEN';
    if (show.night) return `NIGHT ${show.night}`;
    return null;
  })();

  const dateFull = [formatShowDate(show.date), specialLabel].filter(Boolean).join(' · ');

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back nav */}
      <button
        onClick={() => router.push('/shows')}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All shows
      </button>

      {/* Hero — overlapped by card below */}
      <div className="-mb-20">
        <ShowHero
          artist={show.artist}
          venue={show.venue}
          city={show.city}
          dateFull={dateFull}
          rating={show.rating}
          badges={[]}
          height={300}
        />
      </div>

      {/* Content card */}
      <div className="relative z-10 bg-surface border border-subtle rounded-3xl p-6 md:p-10 shadow-theme-lg">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">

          {/* LEFT — Setlist + Notes */}
          <div>
            <SectionHeader title="Setlist" className="mb-4" />
            {sets.length > 0
              ? <SetlistView sets={sets} />
              : <p className="text-muted text-sm py-8 text-center">No setlist recorded yet.</p>
            }

            {show.notes && (
              <div className="mt-10">
                <SectionHeader title="Notes" className="mb-3" />
                <div className="bg-base border border-subtle rounded-xl p-5 text-[15px] text-secondary leading-relaxed">
                  {show.notes}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Rating + Stats + Friends */}
          <aside className="space-y-4">

            {/* Your Rating */}
            <div className="bg-base border border-subtle rounded-2xl p-5">
              <div className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-muted mb-3">
                Your Rating
              </div>
              <RatingStars
                value={show.rating || 0}
                onChange={r => updateShowRating(show.id, r)}
                size="lg"
              />
              {show.rating > 0 && (
                <p className="text-secondary text-sm mt-2">{show.rating} / 5</p>
              )}
              {show.comment && (
                <p className="text-secondary text-sm mt-1 italic">&ldquo;{show.comment}&rdquo;</p>
              )}
            </div>

            {/* Show Stats */}
            {totalSongs > 0 && (
              <div className="bg-base border border-subtle rounded-2xl p-5">
                <div className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-muted mb-4">
                  Show Stats
                </div>
                <dl className="space-y-3">
                  {[
                    { label: 'Songs', value: totalSongs },
                    debuts > 0 ? { label: 'Debuts', value: `${debuts} songs`, tone: 'brand' } : null,
                    bustouts.length > 0 ? {
                      label: 'Bust-outs',
                      value: `${bustouts[0].song || bustouts[0].title}${bustouts.length > 1 ? ` +${bustouts.length - 1}` : ''}`,
                      tone: 'amber',
                    } : null,
                  ].filter(Boolean).map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <dt className="text-[13px] text-secondary">{row.label}</dt>
                      <dd className={`text-[13px] font-bold ${
                        row.tone === 'brand' ? 'text-brand' :
                        row.tone === 'amber' ? 'text-amber' :
                        'text-primary'
                      }`}>
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Friends who were there */}
            {taggedFriends.length > 0 && (
              <div className="bg-base border border-subtle rounded-2xl p-5">
                <div className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-muted mb-4">
                  Friends Who Were There
                </div>
                <ul className="space-y-3">
                  {taggedFriends.map(f => (
                    <li key={f.friendUid} className="flex items-center gap-3">
                      <Avatar name={f.friendName} size="sm" />
                      <div className="text-[13px] font-semibold text-primary">{f.friendName}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tag friends */}
            {user && (
              <Button
                variant="secondary"
                icon={UserPlus}
                className="w-full"
                onClick={() => setTagFriendsShow(show)}
              >
                Tag friends
              </Button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
