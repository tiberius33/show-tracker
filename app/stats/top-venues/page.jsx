'use client';

import { useMemo } from 'react';
import { PageHeader, SectionHeader, Tag } from '@/components/ui';
import TopList from '@/components/stats/TopList';
import StatsSubNav from '@/components/stats/StatsSubNav';
import { useStatsPeriod } from '@/lib/useStatsPeriod';

export default function TopVenuesPage() {
  const { period, setPeriod, periodShows, periodLabels } = useStatsPeriod();

  const topVenues = useMemo(() => {
    const map = {};
    periodShows.forEach(s => {
      const key = s.venue + (s.city ? `, ${s.city}` : '');
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count, meta: `${count} show${count !== 1 ? 's' : ''}` }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [periodShows]);

  return (
    <>
      <PageHeader eyebrow="Stats" title="Top Venues" />

      <StatsSubNav active="top-venues" />

      <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-none">
        {periodLabels.map((p) => (
          <Tag
            key={p}
            selected={p === period}
            onClick={() => setPeriod(p)}
            className="flex-shrink-0"
          >
            {p === 'all-time' ? 'All-time' : p}
          </Tag>
        ))}
      </div>

      {topVenues.length > 0 ? (
        <section className="bg-surface border border-subtle rounded-2xl p-7 md:p-8">
          <SectionHeader title="Top venues" />
          <TopList items={topVenues} />
        </section>
      ) : (
        <p className="text-center text-muted py-8 font-medium">No shows tracked yet</p>
      )}
    </>
  );
}
