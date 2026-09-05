// components/moderation/ReportButton.jsx
//
// The flag affordance itself, plus the modal it opens. One component so a
// call site adds reporting with a single line in its existing control row
// rather than wiring up modal state five times over — the surfaces that
// need this (comments, media, meetup messages, profiles) all already have
// a row of small icon buttons to sit in.
//
// Renders nothing at all when there is nobody to report to (signed out or
// in guest mode) or when the content is the current user's own. Reporting
// your own comment is not a thing, and an affordance that does nothing is
// worse than no affordance.

'use client';

import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ReportModal from './ReportModal';

export default function ReportButton({
  contentType,
  contentId,
  contentSnapshot,
  reportedUserId,
  reportedUserName,
  onReported,
  label = 'Report',
  showLabel = true,
  className = '',
  size = 13,
}) {
  const { user, guestMode } = useApp();
  const [open, setOpen] = useState(false);

  if (!user || guestMode) return null;
  if (reportedUserId && reportedUserId === user.uid) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className={`flex items-center gap-1 text-xs font-medium text-muted hover:text-danger transition-colors ${className}`}
      >
        <Flag size={size} />
        {showLabel && label}
      </button>

      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        contentType={contentType}
        contentId={contentId}
        contentSnapshot={contentSnapshot}
        reportedUserId={reportedUserId}
        reportedUserName={reportedUserName}
        onReported={onReported}
      />
    </>
  );
}
