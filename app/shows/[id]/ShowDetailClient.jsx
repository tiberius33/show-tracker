'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { parseDate } from '@/lib/utils';
import SetlistView from '@/components/shows/SetlistView';
import ShowHero from '@/components/shows/ShowHero';
import { RatingStars, Avatar, Button } from '@/components/ui';
import { ArrowLeft, UserPlus } from 'lucide-react';

// "MON · OCT 31 · 1994"
function formatShowDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d || d.getFullYear() < 1900) return dateStr || '';
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
  const ORDER = ['Set I', 'Set II', 'Set III', 'Encore', 'Encore II'];
  const keys = [
    ...ORDER.filter(k => groups[k]),
    ...Object.keys(groups).filter(k => !ORDER.includes(k)),
  ];
  return keys.map(label => ({
    label,
    tracks: (groups[label] || []).map(s => ({
      title: s.song || s.title || s.name || '',
      duration: s.duration || '',
      debut: !!(s.tags?.includes('debut') || s.debut),
      bustout: !!(s.tags?.includes('bustout') || s.bustout),
      bustoutNote: s.bustoutNote || '',
    })),
  }));
}

// Small ALL-CAPS label used above each sidebar section
function SidebarLabel({ children }) {
  return (
    <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-muted mb-3">
      {children}
    </p>
  );
}

// Individual sidebar card (white/surface card with border)
function SidebarCard({ children, className = '' }) {
  return (
    <div className={`bg-surface border border-subtle rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

export default function ShowDetailClient({ id }) {
  const router = useRouter();
  const { shows, user, friends, updateShowRating, setTagFriendsShow } = useApp();

  const show = useMemo(() => shows.find(s => s.id === id), [shows, id]);

  if (!show) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg text-primary mb-4">Show not found.</p>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push('/shows')}>
          Back to shows
        </Button>
      </div>
    );
  }

  const sets = buildSets(show.setlist);
  const totalSongs = show.setlist?.length || 0;
  const debuts = (show.setlist || []).filter(s => s.tags?.includes('debut') || s.debut).length;
  const bustouts = (show.setlist || []).filter(
    s => s.tags?.includes('bustout') || s.bustout,
  );

  // Friends tagged at this show
  const taggedFriendIds = new Set(show.taggedFriends || []);
  const taggedFriends = friends.filter(f => taggedFriendIds.has(f.friendUid));

  // Hero date + optional special label
  const specialLabel = (() => {
    const notes = (show.notes || '').toLowerCase();
    if (notes.includes('halloween')) return 'HALLOWEEN';
    if (show.night) return `NIGHT ${show.night}`;
    return null;
  })();
  const dateFull = [formatShowDate(show.date), specialLabel].filter(Boolean).join(' · ');

  return (
    <div className="max-w-5xl mx-auto">

      {/* Back link */}
      <button
        onClick={() => router.push('/shows')}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All shows
      </button>

      {/* ── Hero ─────────────────────────────────────────────────────────────
          ShowHero already has -mb-20 built in, so the content card below
          will overlap the hero by 80px (5rem). DO NOT add another wrapper
          with -mb-20. The content div below needs relative z-10 to sit on
          top of the gradient. */}
      <ShowHero
        artist={show.artist}
        venue={show.venue}
        city={show.city}
        dateFull={dateFull}
        rating={show.rating}
        badges={[]}
        height={280}
      />

      {/* ── Body ─────────────────────────────────────────────────────────────
          relative z-10 lifts it above the hero gradient.
          No outer card border — left column is bare page, only sidebar
          sections are individually boxed. */}
      <div className="relative z-10 pt-2">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10 items-start">

          {/* ── LEFT: Setlist + Notes ──────────────────────────────────────── */}
          <section>
            <h2 className="text-[22px] font-extrabold text-primary tracking-tight mb-5">
              Setlist
            </h2>

            {sets.length > 0
              ? <SetlistView sets={sets} />
              : (
                <p className="text-muted text-sm py-10 text-center">
                  No setlist recorded yet.
                </p>
              )
            }

            {show.notes && (
              <div className="mt-10">
                <h2 className="text-[22px] font-extrabold text-primary tracking-tight mb-4">
                  Notes
                </h2>
                <div className="bg-surface border border-subtle rounded-xl p-5 text-[15px] text-secondary leading-relaxed">
                  {show.notes}
                </div>
              </div>
            )}
          </section>

          {/* ── RIGHT: Sidebar cards ───────────────────────────────────────── */}
          <aside className="space-y-3 lg:sticky lg:top-6">

            {/* Your Rating */}
            <SidebarCard>
              <SidebarLabel>Your Rating</SidebarLabel>
              <RatingStars
                value={show.rating || 0}
                onChange={r => updateShowRating(show.id, r)}
                size={26}
              />
              {show.rating > 0 && (
                <p className="text-secondary text-sm mt-2">
                  {show.rating} / 5
                  {show.comment && (
                    <span className="italic"> — &ldquo;{show.comment}&rdquo;</span>
                  )}
                </p>
              )}
            </SidebarCard>

            {/* Show Stats */}
            {totalSongs > 0 && (
              <SidebarCard>
                <SidebarLabel>Show Stats</SidebarLabel>
                <dl className="space-y-2.5">
                  <StatRow label="Songs" value={totalSongs} />
                  {debuts > 0 && (
                    <StatRow label="Debuts" value={`${debuts} songs`} tone="brand" />
                  )}
                  {bustouts.length > 0 && (
                    <StatRow
                      label="Bust-outs"
                      value={`${bustouts[0].song || bustouts[0].title}${bustouts.length > 1 ? ` (+${bustouts.length - 1})` : ''}`}
                      tone="amber"
                    />
                  )}
                </dl>
              </SidebarCard>
            )}

            {/* Friends who were there */}
            {taggedFriends.length > 0 && (
              <SidebarCard>
                <SidebarLabel>Friends Who Were There</SidebarLabel>
                <ul className="space-y-3">
                  {taggedFriends.map(f => (
                    <li key={f.friendUid} className="flex items-center gap-3">
                      <Avatar name={f.friendName || ''} size="sm" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-primary leading-snug">
                          {f.friendName || 'Friend'}
                        </div>
                        {f.friendEmail && (
                          <div className="text-[11px] text-muted truncate">
                            {f.friendEmail}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </SidebarCard>
            )}

            {/* Tag friends CTA */}
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatRow({ label, value, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[13px] text-secondary shrink-0">{label}</dt>
      <dd className={`text-[13px] font-bold text-right ${
        tone === 'brand' ? 'text-brand' :
        tone === 'amber' ? 'text-amber' :
        'text-primary'
      }`}>
        {value}
      </dd>
    </div>
  );
}
