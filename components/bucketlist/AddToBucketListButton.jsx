// components/bucketlist/AddToBucketListButton.jsx
//
// Reusable "Add to Bucket List" affordance for anywhere a future show is
// shown (UpcomingShows event cards, search results). Tracks its own
// added/pending state per event locally — the caller doesn't need to know
// about lib/bucketList.js.

'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, BookMarked } from 'lucide-react';
import { Button } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { addToBucketList, removeFromBucketList, bucketListItemKey } from '@/lib/bucketList';

export default function AddToBucketListButton({ item, size = 'sm' }) {
  const { user, setToast } = useApp();
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);

  const key = bucketListItemKey(item);

  useEffect(() => { setAdded(false); }, [key]);

  if (!user) return null;

  const handleClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      if (added) {
        await removeFromBucketList(user.uid, key);
        setAdded(false);
      } else {
        await addToBucketList(user.uid, item);
        setAdded(true);
        setToast?.('Added to your bucket list.');
      }
    } catch (err) {
      setToast?.("Couldn't update your bucket list. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      size={size}
      variant={added ? 'secondary' : 'ghost'}
      icon={added ? BookMarked : Bookmark}
      loading={pending}
      onClick={handleClick}
      className={added ? 'text-brand' : ''}
    >
      {added ? 'In Bucket List' : 'Add to Bucket List'}
    </Button>
  );
}
