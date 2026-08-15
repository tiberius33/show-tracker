'use client';

import { Heart } from 'lucide-react';
import WishlistView from '@/components/WishlistView';
import { PageHeader, EmptyState, Button } from '@/components/ui';
import { useApp } from '@/context/AppContext';

export default function WishlistPage() {
  const { user, guestMode, openAuthModal } = useApp();

  // Guests are allowed elsewhere in the app, but Wishlist is sign-in only.
  // (A fully signed-out, non-guest visitor never reaches this component —
  // AppProviderWrapper shows the landing/sign-in page before any route renders.)
  if (guestMode || !user) {
    return (
      <>
        <PageHeader eyebrow="Discover" title="Wishlist" />
        <EmptyState
          icon={Heart}
          tone="brand"
          title="Sign in to build a wishlist"
          body="Your wishlist is saved to your account, so it's here every time you come back. Create a free account to get started."
          action={<Button onClick={() => openAuthModal('signup')}>Create account</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Discover"
        title="Wishlist"
        subtitle="Pick an artist, see what you've caught live, and check off the songs you're still chasing."
      />
      <WishlistView />
    </>
  );
}
