// components/festivals/FestivalListView.jsx
//
// All of the user's explicitly-created festivals — name, date range, show
// count per festival, and a create action. See context/AppContext.jsx for
// the Festival CRUD (createFestival etc.) and lib/festivalGrouping.js for
// per-festival stats used on the detail view.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Tent, Plus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, PageHeader, EmptyState, Button } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import FestivalFormModal from './FestivalFormModal';

export default function FestivalListView() {
  const { festivals, shows, createFestival } = useApp();
  const [showCreate, setShowCreate] = useState(false);

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

      {sorted.length === 0 ? (
        <EmptyState
          icon={Tent}
          tone="brand"
          title="No festivals yet"
          body="Create a festival and attach the shows you caught there — multiple artists, one event, all grouped together."
          action={<Button icon={Plus} onClick={() => setShowCreate(true)}>New festival</Button>}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map(festival => {
            const count = showCountByFestival.get(festival.id) || 0;
            return (
              <Link
                key={festival.id}
                href={`/festivals/${festival.id}`}
                className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <Card padding="md" className="hover:bg-hover transition-colors">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-primary truncate">{festival.name}</div>
                    <div className="text-sm text-secondary mt-0.5 truncate">
                      {formatDate(festival.startDate)}
                      {festival.endDate !== festival.startDate ? ` – ${formatDate(festival.endDate)}` : ''}
                      {festival.location ? ` · ${festival.location}` : ''}
                      {' · '}{count} show{count !== 1 ? 's' : ''}
                    </div>
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
        onSubmit={createFestival}
      />
    </div>
  );
}
