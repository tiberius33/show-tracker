'use client';

import React from 'react';
import Card from './Card';
import Skeleton from './Skeleton';
import SkeletonCard from './SkeletonCard';

// Mirrors the real /shows layout's chrome (header, stat cards, tabs, filter
// bar) in addition to the show list itself. The real page only swaps this
// skeleton out once Firestore data resolves — if this skeleton didn't
// reserve space for that chrome, everything below it would jump down the
// moment real content replaced it, a large layout shift right after the
// page's first meaningful paint.
function ShowsListSkeleton() {
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-6 mb-7 border-b border-subtle">
        <div className="min-w-0">
          <Skeleton className="h-3 w-16 mb-3" />
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} padding="sm">
            <Skeleton className="h-6 w-10 mb-2" />
            <Skeleton className="h-3 w-14" />
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-6 border-b border-subtle mb-6 pb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>

      <Card padding="sm" className="mb-6 shadow-theme-sm">
        <Skeleton className="h-10 w-full rounded-xl" />
      </Card>

      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export default ShowsListSkeleton;
