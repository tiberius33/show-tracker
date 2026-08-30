'use client';

import Link from 'next/link';
import { Layers, PartyPopper } from 'lucide-react';
import { PageHeader, SectionHeader, Card, EmptyState, Badge } from '@/components/ui';
import StatsSubNav from '@/components/stats/StatsSubNav';
import useRunIndex from '@/hooks/useRunIndex';
import { formatDate } from '@/lib/utils';

export default function StatsRunsPage() {
  const runIndex = useRunIndex();
  const runs = Object.values(runIndex); // already sorted newest-first by buildRunIndex

  return (
    <>
      <PageHeader eyebrow="Stats" title="Runs" />

      <StatsSubNav active="runs" />

      {runs.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No runs yet"
          body="Log 2+ consecutive nights at the same venue by the same artist and they'll show up here as a run."
        />
      ) : (
        <Card padding="none">
          <ul className="list-none p-0 m-0 divide-y divide-subtle">
            {runs.map(run => (
              <li key={run.key}>
                <Link
                  href={`/runs/?run=${encodeURIComponent(run.key)}`}
                  className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary flex items-center gap-2 flex-wrap">
                      {run.artistName} — {run.nightCount} nights
                      {run.noRepeat === true && (
                        <Badge tone="amber" size="sm">
                          <PartyPopper className="w-3 h-3" /> no repeats
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-secondary mt-0.5 truncate">
                      {run.venueName} · {formatDate(run.dateRange.start)} – {formatDate(run.dateRange.end)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
