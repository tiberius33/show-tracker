'use client';

import InviteView from '@/components/InviteView';
import { PageHeader } from '@/components/ui';
import { useApp } from '@/context/AppContext';

export default function InvitePage() {
  const { user, guestMode, sendInvite } = useApp();

  if (guestMode) return null;

  return (
    <>
      <PageHeader
        eyebrow="Invite"
        title="Invite Friends"
        subtitle="Share mysetlists.net with your concert-going friends."
      />
      <InviteView
        currentUserUid={user?.uid}
        currentUser={user}
        onSendInvite={sendInvite}
      />
    </>
  );
}
