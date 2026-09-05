// components/moderation/ReportModal.jsx
//
// The report dialog behind every flag icon in the app. Built from the
// existing Modal / Button / Badge / Textarea primitives so it looks like
// the rest of the app rather than like a compliance bolt-on.
//
// Two things happen on submit, and the order matters: the report is sent,
// and then the item is hidden locally for the reporter straight away (see
// `onReported` — the caller drops it from its own list). Someone who has
// just reported a comment should not have to keep looking at it while an
// admin gets to the queue.

'use client';

import React, { useState } from 'react';
import { Flag, ShieldOff } from 'lucide-react';
import { Modal, Button, Badge, Textarea } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { REPORT_REASONS, REPORTABLE_TYPES, submitReport } from '@/lib/moderation';

export default function ReportModal({
  open,
  onClose,
  contentType,
  contentId,
  contentSnapshot,
  reportedUserId,
  reportedUserName,
  onReported,
}) {
  const { user, setToast, blockUser } = useApp();

  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const selected = REPORT_REASONS.find((r) => r.id === reason);
  const detailsRequired = !!selected?.requiresDetails;
  const typeLabel = REPORTABLE_TYPES[contentType]?.label || 'Content';

  const reset = () => {
    setReason('');
    setDetails('');
    setAlsoBlock(false);
    setError('');
  };

  const handleClose = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sending) return;

    if (!reason) {
      setError('Pick a reason so we know what to look at.');
      return;
    }
    if (detailsRequired && !details.trim()) {
      setError('Tell us briefly what’s wrong — a report with no reason can’t be actioned.');
      return;
    }

    setSending(true);
    setError('');
    try {
      await submitReport({
        contentType,
        contentId,
        contentSnapshot,
        reportedUserId,
        reason,
        details: details.trim(),
      });

      // Blocking is a separate write on the reporter's own document, so a
      // failure there must not read as "your report didn't send".
      if (alsoBlock && reportedUserId) {
        try {
          await blockUser(reportedUserId);
        } catch (err) {
          console.error('[moderation] Block alongside report failed:', err);
        }
      }

      onReported?.();
      setToast?.('Thanks — we’ll review this within 24 hours.');
      reset();
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't send that report. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Report this"
      subtitle={`${typeLabel}${reportedUserName ? ` by ${reportedUserName}` : ''}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-start gap-2.5 bg-hover rounded-xl p-3.5">
          <Flag size={16} className="text-brand flex-shrink-0 mt-0.5" />
          <p className="text-sm text-secondary">
            Reports are reviewed within 24 hours. Anything that breaks the{' '}
            <a href="/terms" className="text-brand underline">Community Guidelines</a>{' '}
            is removed and repeat offenders lose their account.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-[13px] font-semibold text-secondary mb-2">
            What’s wrong with it?
          </legend>
          {REPORT_REASONS.map((option) => (
            <label
              key={option.id}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                reason === option.id
                  ? 'border-brand bg-brand-subtle'
                  : 'border-subtle hover:border-active'
              }`}
            >
              <input
                type="radio"
                name="report-reason"
                value={option.id}
                checked={reason === option.id}
                onChange={() => { setReason(option.id); setError(''); }}
                disabled={sending}
                className="accent-brand"
              />
              <span className="text-[15px] text-primary flex-1">{option.label}</span>
              {option.requiresDetails && reason === option.id && (
                <Badge tone="amber" size="sm">Details needed</Badge>
              )}
            </label>
          ))}
        </fieldset>

        <Textarea
          label={detailsRequired ? 'What happened?' : 'Anything else we should know? (optional)'}
          rows={3}
          value={details}
          onChange={(e) => { setDetails(e.target.value); setError(''); }}
          disabled={sending}
          placeholder={detailsRequired ? 'Tell us what’s wrong with this.' : ''}
        />

        {reportedUserId && reportedUserId !== user.uid && (
          <label className="flex items-start gap-3 px-3.5 py-3 rounded-xl border border-subtle cursor-pointer hover:border-active transition-colors">
            <input
              type="checkbox"
              checked={alsoBlock}
              onChange={(e) => setAlsoBlock(e.target.checked)}
              disabled={sending}
              className="accent-brand mt-0.5"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[15px] text-primary font-medium">
                <ShieldOff size={14} /> Also block {reportedUserName || 'this person'}
              </span>
              <span className="block text-xs text-muted mt-0.5">
                You won’t see their comments, photos, meetups or activity, and you’ll be
                removed from each other’s friends. You can undo this in Profile → Blocked
                accounts.
              </span>
            </span>
          </label>
        )}

        {/* Inline, in the form-error style the rest of the app uses —
            never a native alert(), which is unreadable on iOS and looks
            like a browser failure rather than a considered response. */}
        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" icon={Flag} loading={sending}>
            Send report
          </Button>
        </div>
      </form>
    </Modal>
  );
}
