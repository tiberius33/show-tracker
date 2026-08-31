'use client';

import React from 'react';
import { BadgeCheck } from 'lucide-react';

// Blue checkmark shown next to a verified venue's name — venue detail
// header, search results, show detail, stats rows, etc. Deliberately
// tiny/inline so it drops into existing text without layout shifts.
export default function VerificationBadge({ size = 16, className = '', title = 'Verified venue' }) {
  return (
    <BadgeCheck
      size={size}
      className={`inline-block text-blue-500 flex-shrink-0 ${className}`}
      fill="currentColor"
      stroke="white"
      strokeWidth={2}
      aria-label={title}
      title={title}
    />
  );
}
