'use client';

import { ScrollText } from 'lucide-react';
import SetlistPhotoDirectory from '@/components/photos/SetlistPhotoDirectory';
import { PageHeader, EmptyState, Button } from '@/components/ui';
import { useApp } from '@/context/AppContext';

export default function SetlistPhotosPage() {
  const { user, guestMode, openAuthModal } = useApp();

  // Reading showPhotos requires Firestore auth — guests have no Firebase
  // auth user, same sign-in-only rule as Bucket List, Activity, and
  // Notifications.
  if (guestMode || !user) {
    return (
      <>
        <PageHeader eyebrow="Discover" title="Setlist Photos" />
        <EmptyState
          icon={ScrollText}
          tone="brand"
          title="Sign in to browse setlist photos"
          body="Create a free account to search setlist photos shared by the community, from any show."
          action={<Button onClick={() => openAuthModal('signup')}>Create account</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Discover"
        title="Setlist Photos"
        subtitle="Photos of written setlists shared by the community — search by artist, venue, or date."
      />
      <SetlistPhotoDirectory />
    </>
  );
}
