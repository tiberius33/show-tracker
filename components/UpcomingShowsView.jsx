'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Ticket, AlertTriangle, Music } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { artistColor } from '@/lib/utils';
import { TICKET_CACHE_TTL } from '@/lib/constants';
import UpcomingShows from '@/components/UpcomingShows';

function UpcomingShowsView({ shows, onCountLoaded }) {
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [sortBy, setSortBy] = useState('count'); // 'count' | 'alpha'
  const [artistDots, setArtistDots] = useState({}); // { [artistName]: true } when cached events exist

  // Derive unique artists + seen-count from shows prop
  const artistData = useMemo(() => {
    const map = {};
    shows.forEach(s => {
      if (s.artist) map[s.artist] = (map[s.artist] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [shows]);

  const sortedArtists = useMemo(() => {
    const copy = [...artistData];
    if (sortBy === 'alpha') {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      copy.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }
    return copy;
  }, [artistData, sortBy]);

  // On mount, cache-only check — reads Firestore ticketCache docs, no API calls
  useEffect(() => {
    if (artistData.length === 0) return;
    let cancelled = false;

    async function checkCache() {
      const dots = {};
      let totalEvents = 0;

      await Promise.all(
        artistData.map(async ({ name }) => {
          try {
            const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const snap = await getDoc(doc(db, 'ticketCache', `tm_${slug}`));
            if (snap.exists()) {
              const cached = snap.data();
              const cachedAt = cached.cachedAt?.toMillis?.() || 0;
              if (Date.now() - cachedAt < TICKET_CACHE_TTL) {
                const events = cached.data || cached.events || [];
                if (events.length > 0) {
                  dots[name] = true;
                  totalEvents += events.length;
                }
              }
            }
          } catch (_) {
            // silently ignore cache read errors
          }
        })
      );

      if (!cancelled) {
        setArtistDots(dots);
        if (onCountLoaded) onCountLoaded(totalEvents);
      }
    }

    checkCache();
    return () => { cancelled = true; };
  }, [artistData]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Band detail view ---
  if (selectedArtist !== null) {
    return (
      <div>
        <button
          onClick={() => setSelectedArtist(null)}
          className="flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-6 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">All Artists</span>
        </button>

        <h2
          className="text-2xl font-bold mb-6"
          style={{ color: artistColor(selectedArtist) }}
        >
          {selectedArtist}
        </h2>

        <UpcomingShows artistName={selectedArtist} />
      </div>
    );
  }

  // --- Band list view ---
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-brand/20 to-amber/20 rounded-xl flex items-center justify-center border border-brand/20">
          <Ticket className="w-5 h-5 text-brand" />
        </div>
        <h1 className="text-2xl font-bold text-primary">Upcoming Shows</h1>
        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-subtle text-brand border border-brand/20">
          Beta
        </span>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 mb-6 bg-brand-subtle border border-brand/20 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
        <p className="text-sm text-brand/80">
          Upcoming Shows is in beta. Show dates and availability are pulled from third-party sources and may not always be accurate. We're actively improving this feature!
        </p>
      </div>

      {/* Empty state */}
      {artistData.length === 0 && (
        <div className="text-center py-16">
          <Music className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-secondary mb-4">Add some shows first to see upcoming tours</p>
        </div>
      )}

      {/* Sort toggle + list */}
      {artistData.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-muted text-sm">Sort by:</span>
            {[
              { key: 'count', label: 'Most Seen' },
              { key: 'alpha', label: 'A\u2013Z' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  sortBy === key
                    ? 'bg-brand-subtle text-brand border-brand/30'
                    : 'bg-hover text-secondary border-subtle hover:text-primary hover:bg-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-hover border border-subtle rounded-2xl overflow-hidden">
            {sortedArtists.map(({ name, count }, idx) => (
              <button
                key={name}
                onClick={() => setSelectedArtist(name)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-hover transition-colors text-left group ${
                  idx !== 0 ? 'border-t border-subtle' : ''
                }`}
              >
                {/* Indicator dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  artistDots[name] ? 'bg-brand' : 'bg-transparent'
                }`} />

                <span className="flex-1 text-primary font-medium group-hover:text-primary transition-colors">
                  {name}
                </span>

                <span className="text-muted text-sm">
                  {count === 1 ? '1 show' : `${count} shows`}
                </span>

                <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default UpcomingShowsView;
