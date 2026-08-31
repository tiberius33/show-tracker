'use client';

// A single meetup's page, at /meetups/?id=<meetupId> — same static
// query-param routing approach as /tours/ and /festivals/.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { subscribeMeetup, meetupIdFor } from '@/lib/meetups';
import MeetupDetailView from '@/components/meetups/MeetupDetailView';
import { Button, PageHeader, EmptyState, Spinner } from '@/components/ui';

export default function MeetupPage() {
  const { user, guestMode, openAuthModal } = useApp();
  const searchParams = useSearchParams();
  const meetupId = searchParams.get('id') || '';

  const [meetup, setMeetup] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    if (!meetupId) {
      setMeetup(null);
      return;
    }
    setMeetup(undefined);
    // subscribeMeetup takes a concertKey and derives the doc id itself, but
    // we already have the doc id from the URL — meetupIdFor is idempotent
    // on an already-sanitized id, so passing it straight through resolves
    // to the same document.
    return subscribeMeetup(meetupId, setMeetup);
  }, [meetupId]);

  if (guestMode || !user) {
    return (
      <>
        <PageHeader eyebrow="Meetups" title="Meetup" />
        <EmptyState
          icon={Users}
          tone="brand"
          title="Sign in to see this meetup"
          body="Create a free account to see who's going and join the discussion."
          action={<Button onClick={() => openAuthModal('signup')}>Create account</Button>}
        />
      </>
    );
  }

  if (meetup === undefined) {
    return <div className="py-12"><Spinner size="md" label="Loading meetup…" /></div>;
  }

  if (!meetup) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Users className="w-10 h-10 text-muted mb-4" />
        <p className="text-lg text-primary">Meetup not found.</p>
      </div>
    );
  }

  return <MeetupDetailView meetup={meetup} />;
}
