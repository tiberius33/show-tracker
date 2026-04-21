// components/ui/Skeleton.jsx
// Shimmering placeholder. Use whenever data is loading & layout is predictable.

import React from 'react';

export default function Skeleton({ className = '', style }) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`bg-hover rounded-md animate-pulse ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, lastShort = true, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          style={{ width: lastShort && i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-surface border border-subtle rounded-2xl p-5 ${className}`}>
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-3.5 w-1/2 mb-4" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}
