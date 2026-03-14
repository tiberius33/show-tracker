'use client';

import InviteView from '@/components/InviteView';
import { useApp } from '@/context/AppContext';

export default function InvitePage() {
  const { user, guestMode, sendInvite } = useApp();

  if (guestMode) return null;

  return (
    <InviteView
      currentUserUid={user?.uid}
      currentUser={user}
      onSendInvite={sendInvite}
    />
  );
}
