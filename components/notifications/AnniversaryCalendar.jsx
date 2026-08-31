// components/notifications/AnniversaryCalendar.jsx
//
// Upcoming anniversaries — "X years ago you saw [artist] at [venue]" dates
// still to come, soonest first. See lib/anniversaries.js for the math.
// The actual reminder notifications on the day itself are sent server-side
// (netlify/functions/anniversary-notifications.js); this is just the
// client-facing preview list.

'use client';

import { useMemo } from 'react';
import { PartyPopper } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { buildUpcomingAnniversaries } from '@/lib/anniversaries';
import { Card, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function AnniversaryCalendar({ limit = 8 }) {
  const { shows, setSelectedShow, navigateTo } = useApp();

  const upcoming = useMemo(() => buildUpcomingAnniversaries(shows || []).slice(0, limit), [shows, limit]);

  const goToShow = (show) => {
    setSelectedShow(show);
    navigateTo('shows');
  };

  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
        <PartyPopper className="w-4 h-4 text-brand" />
        Upcoming anniversaries
      </h3>

      {upcoming.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="No upcoming anniversaries"
          body="Once your shows are more than a year old, they'll show up here as their anniversary approaches."
        />
      ) : (
        <ul className="list-none p-0 m-0 divide-y divide-subtle">
          {upcoming.map(({ show, occurrence, yearsAgo }) => (
            <li key={show.id}>
              <button
                type="button"
                onClick={() => goToShow(show)}
                className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-hover transition-colors -mx-2 px-2 rounded-lg"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-primary truncate">{show.artist}</div>
                  <div className="text-xs text-secondary mt-0.5 truncate">
                    {show.venue}{show.city ? `, ${show.city}` : ''}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold text-brand">{formatDate(occurrence)}</div>
                  <div className="text-xs text-muted">{yearsAgo} year{yearsAgo !== 1 ? 's' : ''}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
