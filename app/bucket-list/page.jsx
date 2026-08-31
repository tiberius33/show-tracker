'use client';

import { Bookmark } from 'lucide-react';
import BucketListView from '@/components/bucketlist/BucketListView';
import { PageHeader, EmptyState, Button } from '@/components/ui';
import { useApp } from '@/context/AppContext';

export default function BucketListPage() {
  const { user, guestMode, openAuthModal } = useApp();

  // Guests are allowed elsewhere in the app, but a bucket list is per-account
  // Firestore data, so it's sign-in only — same rule as Wishlist.
  if (guestMode || !user) {
    return (
      <>
        <PageHeader eyebrow="Plan Ahead" title="Bucket List" />
        <EmptyState
          icon={Bookmark}
          tone="brand"
          title="Sign in to build a bucket list"
          body="Your bucket list is saved to your account, so it's here every time you come back. Create a free account to get started."
          action={<Button onClick={() => openAuthModal('signup')}>Create account</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Plan Ahead"
        title="Bucket List"
        subtitle="Shows you want to catch — sort by date, mark them off when you go, share with friends."
      />
      <BucketListView />
    </>
  );
}
