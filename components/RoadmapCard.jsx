'use client';

import React from 'react';
import { ChevronUp } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { ROADMAP_CATEGORIES } from '@/lib/constants';
import Tip from '@/components/ui/Tip';
import { Card, Button } from '@/components/ui';

function RoadmapCard({ item, hasVoted, isTopThree, onVote, voting, isLoggedIn }) {
  return (
    <Card padding="none" className={`p-4 relative ${isTopThree ? 'border-brand/40' : ''}`}>
      {isTopThree && (
        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 bg-brand-subtle text-brand rounded-full border border-brand/30 whitespace-nowrap">
          Most Requested
        </span>
      )}
      <div className={isTopThree ? 'pr-28' : ''}>
        <p className="font-semibold text-primary text-sm leading-snug mb-1">{item.title}</p>
        {item.description && item.description !== item.title && (
          <p className="text-secondary text-xs leading-relaxed mb-2 line-clamp-3">{item.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {item.category && ROADMAP_CATEGORIES[item.category] && (
            <span className="text-[10px] px-2 py-0.5 bg-hover text-muted rounded-full">
              {ROADMAP_CATEGORIES[item.category]}
            </span>
          )}
          {(item.publishedAt || item.createdAt) && (
            <span className="text-[10px] text-muted">
              {item.status === 'shipped' ? 'Shipped ' : 'Added '}{timeAgo(item.publishedAt || item.createdAt)}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3">
        <Tip text={hasVoted ? 'Remove your vote' : (isLoggedIn ? 'Vote for this feature' : 'Sign in to vote')}>
          <Button
            size="sm"
            variant="ghost"
            loading={voting}
            onClick={() => onVote(item)}
            disabled={voting}
            className={hasVoted
              ? 'bg-brand-subtle text-brand border border-brand/40'
              : 'text-secondary border border-subtle hover:border-active'}
          >
            {!voting && <ChevronUp className={`w-4 h-4 ${hasVoted ? 'text-brand' : ''}`} />}
            <span>{item.voteCount || 0}</span>
          </Button>
        </Tip>
      </div>
    </Card>
  );
}

export default RoadmapCard;
