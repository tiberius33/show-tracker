'use client';

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import VerificationBadge from './VerificationBadge';
import VerifyVenueModal from './VerifyVenueModal';

// Non-verified venues show a "Verify this Venue" CTA; verified ones show
// the badge + label instead. Used on the venue detail page header.
export default function VerifyVenueButton({ venue, venueKey, venueName, venueCity, currentUser }) {
  const [open, setOpen] = useState(false);

  if (venue?.isVerified) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-500">
        <VerificationBadge size={18} />
        Verified Venue
      </span>
    );
  }

  if (!currentUser) return null;

  return (
    <>
      <Button variant="secondary" icon={ShieldCheck} onClick={() => setOpen(true)}>
        Verify this Venue
      </Button>
      <VerifyVenueModal
        open={open}
        onClose={() => setOpen(false)}
        venueKey={venueKey}
        venueName={venueName}
        venueCity={venueCity}
        currentUser={currentUser}
      />
    </>
  );
}
