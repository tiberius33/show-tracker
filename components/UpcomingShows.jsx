'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { logEvent } from 'firebase/analytics';
import { db, analytics } from '@/lib/firebase';
import { mergeTicketEvents, formatTicketDate } from '@/lib/utils';
import { TICKET_CACHE_TTL } from '@/lib/constants';

function UpcomingShows({ artistName }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [hasNoShows, setHasNoShows] = useState(false);

  useEffect(() => {
    if (!artistName) return;
    let cancelled = false;

    const slug = artistName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const tmCacheKey = `tm_${slug}`;
    const sgCacheKey = `sg_${slug}`;

    // Ticketmaster fetch — supports Attraction ID caching for exact artist matching.
    // On first call the Netlify function resolves and returns the Attraction ID;
    // subsequent calls pass it directly, skipping the TM attractions lookup entirely.
    async function fetchTmWithCache(cacheKey) {
      let cachedAttractionId = null;
      try {
        const cacheDoc = await getDoc(doc(db, 'ticketCache', cacheKey));
        if (cacheDoc.exists()) {
          const cached = cacheDoc.data();
          // Preserve the attraction ID even when the event cache has expired
          cachedAttractionId = cached.tmAttractionId || null;
          const cachedAt = cached.cachedAt && cached.cachedAt.toMillis ? cached.cachedAt.toMillis() : 0;
          if (Date.now() - cachedAt < TICKET_CACHE_TTL) {
            return cached.data || [];
          }
        }
      } catch (_) { /* cache miss — continue */ }

      try {
        let url = `/.netlify/functions/ticketmaster-events?artistName=${encodeURIComponent(artistName)}`;
        // Pass the cached attraction ID so the function skips the attractions lookup
        if (cachedAttractionId) url += `&attractionId=${encodeURIComponent(cachedAttractionId)}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const json = await res.json();
        const evts = json.events || [];
        const returnedAttractionId = json.attractionId || cachedAttractionId || null;
        try {
          const cacheData = { data: evts, cachedAt: serverTimestamp() };
          if (returnedAttractionId) cacheData.tmAttractionId = returnedAttractionId;
          await setDoc(doc(db, 'ticketCache', cacheKey), cacheData);
        } catch (_) { /* cache write failed — non-fatal */ }
        return evts;
      } catch (_) {
        return [];
      }
    }

    // SeatGeek fetch — simple cache wrapper (server-side exact filter handles matching)
    async function fetchSgWithCache(cacheKey) {
      try {
        const cacheDoc = await getDoc(doc(db, 'ticketCache', cacheKey));
        if (cacheDoc.exists()) {
          const cached = cacheDoc.data();
          const cachedAt = cached.cachedAt && cached.cachedAt.toMillis ? cached.cachedAt.toMillis() : 0;
          if (Date.now() - cachedAt < TICKET_CACHE_TTL) {
            return cached.data || [];
          }
        }
      } catch (_) { /* cache miss — continue */ }

      try {
        const res = await fetch(`/.netlify/functions/seatgeek-events?artistName=${encodeURIComponent(artistName)}`);
        if (!res.ok) return [];
        const json = await res.json();
        const evts = json.events || [];
        try {
          await setDoc(doc(db, 'ticketCache', cacheKey), { data: evts, cachedAt: serverTimestamp() });
        } catch (_) { /* cache write failed — non-fatal */ }
        return evts;
      } catch (_) {
        return [];
      }
    }

    async function load() {
      setLoading(true);
      const [tmEvents, sgEvents] = await Promise.all([
        fetchTmWithCache(tmCacheKey),
        fetchSgWithCache(sgCacheKey)
      ]);
      if (cancelled) return;
      const merged = mergeTicketEvents(tmEvents, sgEvents);
      setEvents(merged);
      setHasNoShows(merged.length === 0);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [artistName]);

  function handleTicketClick(platform) {
    try {
      logEvent(analytics, `ticket_click_${platform}`, { artist: artistName });
    } catch (_) {}
  }

  if (loading) {
    return (
      <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-white/40" />
          <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Upcoming Shows</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (hasNoShows) {
    const bandsintownUrl = `https://www.bandsintown.com/a/${encodeURIComponent(artistName)}?came_from=461&app_id=mysetlists`;
    return (
      <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-white/40" />
          <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Upcoming Shows</span>
        </div>
        <p className="text-sm text-white/40 mb-3">No upcoming shows found for {artistName}.</p>
        <a
          href={bandsintownUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Follow on Bandsintown for updates
        </a>
      </div>
    );
  }

  const hasBothPlatforms = events.some(e => e.tmUrl) && events.some(e => e.sgUrl);
  const tmSearchUrl = `https://www.ticketmaster.com/search?q=${encodeURIComponent(artistName)}`;
  const sgSearchUrl = `https://seatgeek.com/${encodeURIComponent(artistName.toLowerCase().replace(/\s+/g, '-'))}-tickets`;

  return (
    <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Upcoming Shows</span>
      </div>

      <div className="space-y-0">
        {events.map((event) => {
          const priceLabel = event.minPrice
            ? event.maxPrice && event.maxPrice !== event.minPrice
              ? `$${Math.round(event.minPrice)} \u2013 $${Math.round(event.maxPrice)}`
              : `From $${Math.round(event.minPrice)}`
            : null;

          const locationParts = [event.venue, [event.city, event.state].filter(Boolean).join(', ')].filter(Boolean);

          return (
            <div key={event.id} className="py-3 border-b border-white/5 last:border-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white/80">{formatTicketDate(event.date)}</span>
                    {locationParts.length > 0 && (
                      <>
                        <span className="text-white/20">&middot;</span>
                        <span className="text-sm text-white/60 truncate">{locationParts.join(' \u00b7 ')}</span>
                      </>
                    )}
                  </div>
                  {priceLabel && (
                    <div className="text-xs text-white/40 mt-0.5">{priceLabel}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {event.tmUrl && (
                    <a
                      href={event.tmUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleTicketClick('ticketmaster')}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-colors whitespace-nowrap"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {hasBothPlatforms ? 'Official' : 'Official Tickets'}
                    </a>
                  )}
                  {event.sgUrl && (
                    <a
                      href={event.sgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleTicketClick('seatgeek')}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 transition-colors whitespace-nowrap"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {hasBothPlatforms ? 'Resale' : 'Resale Tickets'}
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
        <span className="text-xs text-white/30">See all on:</span>
        <a
          href={tmSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400/60 hover:text-blue-400 transition-colors"
        >
          Ticketmaster ↗
        </a>
        <span className="text-white/20">&middot;</span>
        <a
          href={sgSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors"
        >
          SeatGeek ↗
        </a>
      </div>
    </div>
  );
}

export default UpcomingShows;
