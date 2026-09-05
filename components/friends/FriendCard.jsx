// components/friends/FriendCard.jsx
//
// Card for the /friends grid. Centered avatar, name, handle, two numeric
// stats ("Together" / "Their shows") and two action buttons — three when
// `onBlock` is supplied.
//
// Block is here as well as on the report modal because the friends grid
// is where someone goes when they have decided they want a person out of
// their app, and Guideline 1.2 expects blocking to be reachable without
// first finding something of theirs to report.

import React from 'react';
import { ShieldOff } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';

export default function FriendCard({
  name,
  handle,
  avatarSrc,
  sharedShows,
  theirShows,
  theirShowsLabel = 'Their shows',
  onMessage,
  onView,
  onBlock,
}) {
  return (
    <div className="bg-surface border border-subtle rounded-2xl p-6 text-center">
      <Avatar src={avatarSrc} name={name} size="xl" className="mx-auto mb-3.5" />
      <div className="text-[16px] font-extrabold">{name}</div>
      {handle && <div className="text-[12px] text-muted mt-0.5 mb-3.5">@{handle.replace(/^@/, '')}</div>}
      <div className="flex gap-5 justify-center text-[11px] mb-4">
        <div>
          <strong className="block text-[16px] font-extrabold">{sharedShows ?? 0}</strong>
          <span className="text-muted">Together</span>
        </div>
        <div>
          <strong className="block text-[16px] font-extrabold">{theirShows ?? 0}</strong>
          <span className="text-muted">{theirShowsLabel}</span>
        </div>
      </div>
      <div className="flex gap-1.5 justify-center">
        <Button size="sm" variant="secondary" onClick={onMessage}>Message</Button>
        <Button size="sm" variant="ghost" onClick={onView}>View</Button>
        {onBlock && (
          <Button
            size="sm"
            variant="ghost"
            icon={ShieldOff}
            onClick={onBlock}
            className="text-muted hover:text-danger"
            aria-label={`Block ${name}`}
          />
        )}
      </div>
    </div>
  );
}
