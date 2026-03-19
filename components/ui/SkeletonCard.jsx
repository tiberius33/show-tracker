'use client';

import React from 'react';

function SkeletonCard() {
  return (
    <div className="bg-highlight backdrop-blur-xl border border-subtle rounded-2xl p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-3 h-3 rounded-full bg-highlight mt-2 flex-shrink-0" />
        <div className="flex-1">
          <div className="h-5 w-40 bg-highlight rounded-lg mb-2" />
          <div className="flex gap-4">
            <div className="h-4 w-24 bg-highlight rounded-lg" />
            <div className="h-4 w-32 bg-highlight rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SkeletonCard;
