'use client';

import React, { useState } from 'react';
import { Modal, Button, Textarea } from '@/components/ui';
import { reportVenue } from '@/lib/venues';

const REASONS = [
  { value: 'unverified_claiming_official', label: 'Claiming to be official but not verified' },
  { value: 'duplicate', label: 'Duplicate venue entry' },
  { value: 'wrong_info', label: 'Inaccurate venue information' },
  { value: 'other', label: 'Something else' },
];

export default function ReportVenueModal({ open, onClose, venueKey, venueName, currentUser }) {
  const [reason, setReason] = useState(REASONS[0].value);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      await reportVenue({
        venueKey,
        venueName,
        reporterUid: currentUser.uid,
        reporterName: currentUser.displayName || 'Anonymous',
        reason,
        comment,
      });
      setDone(true);
    } catch (err) {
      console.error('Failed to report venue:', err);
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    setDone(false);
    setComment('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Report this Venue" size="sm">
      {done ? (
        <div className="text-center py-6">
          <p className="text-primary font-medium mb-2">Report submitted</p>
          <p className="text-secondary text-sm mb-6">Thanks for helping keep venue data accurate. Our team will review it.</p>
          <Button variant="primary" onClick={handleClose}>Close</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Reason</label>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                  <input type="radio" name="report-reason" checked={reason === r.value} onChange={() => setReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          <Textarea
            label="Additional details (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="Anything else we should know?"
            rows={3}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" full onClick={handleClose}>Cancel</Button>
            <Button variant="primary" full onClick={handleSubmit} loading={submitting} disabled={submitting || !currentUser}>
              Submit Report
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
