'use client';

import React from 'react';
import SkeletonCard from './SkeletonCard';

function ShowsListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default ShowsListSkeleton;
