'use client';

import React from 'react';

function SkeletonCard() {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-3 h-3 rounded-full bg-white/10 mt-2 flex-shrink-0" />
        <div className="flex-1">
          <div className="h-5 w-40 bg-white/10 rounded-lg mb-2" />
          <div className="flex gap-4">
            <div className="h-4 w-24 bg-white/10 rounded-lg" />
            <div className="h-4 w-32 bg-white/10 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SkeletonCard;
