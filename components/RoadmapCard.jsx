'use client';

import React from 'react';
import { ChevronUp, RefreshCw } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { ROADMAP_CATEGORIES } from '@/lib/constants';
import Tip from '@/components/ui/Tip';

function RoadmapCard({ item, hasVoted, isTopThree, onVote, voting, isLoggedIn }) {
  return (
    <div className={`bg-white/5 backdrop-blur-xl rounded-2xl border ${isTopThree ? 'border-amber-500/40' : 'border-white/10'} p-4 relative transition-all hover:bg-white/[0.07]`}>
      {isTopThree && (
        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30 whitespace-nowrap">
          Most Requested
        </span>
      )}
      <div className={isTopThree ? 'pr-28' : ''}>
        <p className="font-semibold text-white text-sm leading-snug mb-1">{item.title}</p>
        {item.description && item.description !== item.title && (
          <p className="text-white/50 text-xs leading-relaxed mb-2 line-clamp-3">{item.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {item.category && ROADMAP_CATEGORIES[item.category] && (
            <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white/40 rounded-full">
              {ROADMAP_CATEGORIES[item.category]}
            </span>
          )}
          {(item.publishedAt || item.createdAt) && (
            <span className="text-[10px] text-white/30">
              {item.status === 'shipped' ? 'Shipped ' : 'Added '}{timeAgo(item.publishedAt || item.createdAt)}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3">
        <Tip text={hasVoted ? 'Remove your vote' : (isLoggedIn ? 'Vote for this feature' : 'Sign in to vote')}>
          <button
            onClick={() => onVote(item)}
            disabled={voting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
              hasVoted
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-white/10 text-white/60 hover:bg-white/20 border border-white/10 hover:border-white/20'
            }`}
          >
            {voting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ChevronUp className={`w-4 h-4 ${hasVoted ? 'text-emerald-400' : ''}`} />
            )}
            <span>{item.voteCount || 0}</span>
          </button>
        </Tip>
      </div>
    </div>
  );
}

export default RoadmapCard;
