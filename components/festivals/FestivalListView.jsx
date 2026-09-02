// components/festivals/FestivalListView.jsx
//
// All of the user's festivals — name, date range, show count per festival,
// and a create action. Each row is the user's own attendance record joined
// to the shared canonical festival it points at; see context/AppContext.jsx
// for both shapes and the Festival CRUD (createFestival / joinFestival /
// leaveFestival), and lib/festivalGrouping.js for the per-festival stats
// used on the detail view.
//
// Creating goes through FestivalFormModal, which offers an existing
// festival before it creates a duplicate — joining lands the user on the
// same page creating would have.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tent, Plus, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, PageHeader, EmptyState, Button, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { festivalHref } from '@/lib/festivalGrouping';
import FestivalFormModal from './FestivalFormModal';

export default function FestivalListView() {
  const router = useRouter();
  const { festivals, festivalsLoading, shows, createFestival, joinFestival } = useApp();
  const [showCreate, setShowCreate] = useState(false);

  // Creating drops the user straight onto the new festival's page, which is
  // where shows get attached (both from their own history and from a
  // setlist.fm lineup search) — otherwise a brand-new, empty festival is a
  // dead end in the list.
  const handleCreate = async (data) => {
    const created = await createFestival(data);
    if (created?.id) router.push(festivalHref(created.id));
    return created;
  };

  // Joining an existing festival lands in exactly the same place creating
  // one would — the festival's own page, where shows get attached.
  const handleJoin = async (canonical) => {
    const joined = await joinFestival(canonical);
    if (joined?.id) router.push(festivalHref(joined.id));
    return joined;
  };

  const sorted = useMemo(
    () => (festivals || []).slice().sort((a, b) => (a.startDate < b.startDate ? 1 : -1)),
    [festivals]
  );

  const showCountByFestival = useMemo(() => {
    const map = new Map();
    (shows || []).forEach(s => {
      if (!s.festivalId) return;
      map.set(s.festivalId, (map.get(s.festivalId) || 0) + 1);
    });
    return map;
  }, [shows]);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Festivals"
        title="Your festivals"
        actions={<Button icon={Plus} onClick={() => setShowCreate(true)}>New festival</Button>}
      />

      {festivalsLoading && sorted.length === 0 ? (
        <Card padding="lg"><Spinner size="md" label="Loading your festivals…" /></Card>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Tent}
          tone="brand"
          title="No festivals yet"
          body="Create a festival and attach the shows you caught there — multiple artists, one event, all grouped together. If someone's already added the one you went to, you can join theirs instead."
          action={<Button icon={Plus} onClick={() => setShowCreate(true)}>New festival</Button>}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map(festival => {
            const count = showCountByFestival.get(festival.id) || 0;
            return (
              <Link
                key={festival.id}
                href={festivalHref(festival.id)}
                className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <Card padding="md" className="hover:bg-hover transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-primary truncate">{festival.name}</div>
                      <div className="text-sm text-secondary mt-0.5 truncate">
                        {formatDate(festival.startDate)}
                        {festival.endDate !== festival.startDate ? ` – ${formatDate(festival.endDate)}` : ''}
                        {festival.location ? ` · ${festival.location}` : ''}
                        {' · '}{count} show{count !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <FestivalFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        onJoin={handleJoin}
      />
    </div>
  );
}
