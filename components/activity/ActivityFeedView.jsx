// components/activity/ActivityFeedView.jsx
//
// /activity page body. Real-time, chronological log of what friends have
// been doing — currently "added a show" and "rated a show" (the only two
// event types lib/activityFeed.js writes today). Designed to grow: a
// future comments/photos PR just adds a new `action` value here and a
// matching logActivity() call at the write site, no schema change needed.

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Activity, PlusCircle, Star, Users } from 'lucide-react';
import { Card, EmptyState, Spinner, Tabs, Avatar } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { subscribeFriendActivity } from '@/lib/activityFeed';
import { timeAgo } from '@/lib/utils';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'added_show', label: 'Shows' },
  { id: 'rated_show', label: 'Ratings' },
];

function ActivityRow({ item }) {
  const isRating = item.action === 'rated_show';
  // Only linkable when the actor's public profile was on at the time this
  // was logged — there's no route for viewing another user's private show
  // (see lib/activityFeed.js's `handle` field for why).
  const showHref = item.handle ? `/u/${item.handle}/shows/${item.showId}` : null;
  const RowTag = showHref ? Link : 'div';

  return (
    <RowTag
      {...(showHref ? { href: showHref, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex items-start gap-3 px-4 py-3.5 hover:bg-hover transition-colors border-b border-subtle last:border-0"
    >
      <Avatar name={item.userName} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-primary">
          <span className="font-semibold">{item.userName}</span>{' '}
          {isRating ? (
            <>rated <span className="font-semibold">{item.artist}</span> {item.rating}/10</>
          ) : (
            <>added <span className="font-semibold">{item.artist}</span>{item.venue ? ` at ${item.venue}` : ''}</>
          )}
        </p>
        <p className="text-xs text-muted mt-0.5">{timeAgo(item.timestamp)}</p>
      </div>
      {isRating ? (
        <Star size={16} className="text-amber flex-shrink-0 mt-1" fill="currentColor" />
      ) : (
        <PlusCircle size={16} className="text-brand flex-shrink-0 mt-1" />
      )}
    </RowTag>
  );
}

export default function ActivityFeedView() {
  const { user, friends } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const friendUids = useMemo(() => (friends || []).map((f) => f.friendUid).filter(Boolean), [friends]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = subscribeFriendActivity(friendUids, (list) => {
      setItems(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [user, friendUids]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.action === filter);
  }, [items, filter]);

  if (friendUids.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={Users}
          tone="brand"
          title="Add some friends first"
          body="Your activity feed shows what friends are up to — add friends to start seeing their shows and ratings here."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={filter} onChange={setFilter} tabs={FILTERS} />

      {loading ? (
        <div className="py-12"><Spinner size="md" label="Loading activity…" /></div>
      ) : filtered.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={Activity}
            tone="brand"
            title="Nothing here yet"
            body="When your friends add or rate a show, it'll show up here in real time."
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          {filtered.map((item) => <ActivityRow key={item.id} item={item} />)}
        </Card>
      )}
    </div>
  );
}
