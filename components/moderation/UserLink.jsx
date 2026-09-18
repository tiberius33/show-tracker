// components/moderation/UserLink.jsx
//
// Makes a name (or an avatar, or both) open that person's profile sheet.
//
// One component so a surface adds it with a single wrap rather than
// wiring sheet state in six places — the same arrangement ReportButton
// uses for its modal, and for the same reason: the alternative is five
// copies of the same useState and one surface that quietly forgets.
//
// Renders plain, non-interactive markup when there is nobody to open —
// signed out, in guest mode, or the current user's own name. A control
// that opens a sheet offering to block yourself is worse than no control.

'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import UserProfileSheet from './UserProfileSheet';

export default function UserLink({
  uid,
  name,
  children,
  className = '',
  as: Tag = 'span',
}) {
  const { user, guestMode } = useApp();
  const [open, setOpen] = useState(false);

  const interactive = !!user && !guestMode && !!uid && uid !== user.uid;

  if (!interactive) {
    return <Tag className={className}>{children ?? name}</Tag>;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // These sit inside rows that are themselves tappable on some
          // surfaces (an activity row opens the show). Opening the person
          // must not also navigate.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`View ${name || 'this person'}’s profile`}
        className={`text-left hover:underline focus-visible:underline ${className}`}
      >
        {children ?? name}
      </button>

      <UserProfileSheet
        open={open}
        onClose={() => setOpen(false)}
        uid={uid}
        fallbackName={name}
      />
    </>
  );
}
