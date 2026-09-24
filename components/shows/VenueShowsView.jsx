// components/shows/VenueShowsView.jsx
//
// "All shows at this venue" — the signed-in user's own shows at one venue,
// reached from /shows/?venueKey=<key> (see app/shows/page.jsx). Not a
// second implementation of venue matching: `venueKey` is whatever
// lib/venues.js's venueKeyFor(venue, city) produces, the same key the rest
// of the app (VenueDetailClient, EntityInfoPanel's caller) already uses, so
// CSV-imported and manually-entered shows resolve exactly as well as
// setlist.fm-sourced ones — there is nothing venue-specific about how a
// show got its `venue`/`city` fields.

'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/ui';
import EntityInfoPanel from '@/components/EntityInfoPanel';
import ShowCard from '@/components/shows/ShowCard';
import { venueKeyFor } from '@/lib/venues';
import { showHref } from '@/lib/showRouting';

export default function VenueShowsView({
  venueKey,
  shows,
  friends = [],
  runInfoByShowId,
  tourHrefFor,
  festivalById,
  onBackToMyShows,
}) {
  const router = useRouter();

  const venueShows = useMemo(
    () => shows.filter(s => venueKeyFor(s.venue, s.city) === venueKey),
    [shows, venueKey]
  );

  // The venue's own display name/city aren't stored anywhere keyed by
  // venueKey — they live on the shows themselves, so the first match is the
  // label. Every match carries the same key by construction, so any of them
  // would do.
  const venueName = venueShows[0]?.venue || 'Venue';
  const venueCity = venueShows[0]?.city || '';

  return (
    <div className="max-w-5xl mx-auto">
      {/* Hidden below md: — MobileHeader already provides the back control
          via lib/navRoutes.js's detailParams entry for /shows, the same
          pattern ShowDetailView uses for its own back button. Goes through
          onBackToMyShows (which also clears the filter state) rather than a
          bare route push, so this "My Shows" really means the full,
          unfiltered list — the same thing the hamburger's My Shows link
          promises. */}
      <button
        onClick={() => (onBackToMyShows ? onBackToMyShows() : router.push('/shows/'))}
        className="hidden md:flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-5 transition-colors py-2 -my-2"
      >
        <ArrowLeft className="w-4 h-4" />
        My Shows
      </button>

      <PageHeader
        eyebrow="Venue"
        title={`Your shows at ${venueName}`}
        subtitle={`${venueShows.length} show${venueShows.length !== 1 ? 's' : ''}`}
      />

      <div className="mb-6">
        <EntityInfoPanel name={venueName} type="venue" city={venueCity} />
      </div>

      {venueShows.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No shows here yet"
          body="You haven't logged a show at this venue — or it hasn't finished loading. Head back to My Shows to add one."
        />
      ) : (
        <div className="space-y-3">
          {venueShows.map(show => (
            <ShowCard
              key={show.id}
              show={show}
              friends={friends}
              onClick={() => router.push(showHref(show.id))}
              runInfo={runInfoByShowId?.get(show.id) || null}
              tourHref={tourHrefFor?.(show) || null}
              festival={show.festivalId ? festivalById?.get(show.festivalId) || null : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
