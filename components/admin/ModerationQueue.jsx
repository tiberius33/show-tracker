// components/admin/ModerationQueue.jsx
//
// The Moderation tab in AdminView — the human half of App Store Guideline
// 1.2. Everything else in the feature (the filter, the report affordance,
// blocking, auto-hide at three reports) exists to get a decision to this
// screen; this is where the decision gets made.
//
// OLDEST FIRST, AND THAT IS THE POINT. The Community Guidelines commit to
// reviewing a report within 24 hours. Sorting newest-first — the default
// almost everywhere else in this app — buries the report closest to
// breaching that commitment under every report filed since. Each row
// shows its age against the 24-hour clock for the same reason.
//
// Kept out of AdminView.jsx, which is already 3,400 lines, and rendered
// from its tab instead.

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, Check, Flag, ShieldOff, Trash2, Clock } from 'lucide-react';
import { Card, Button, Badge, Spinner, EmptyState } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import {
  subscribeOpenReports, resolveReport,
  REPORT_REASON_LABELS, REPORTABLE_TYPES, AUTO_HIDE_THRESHOLD,
} from '@/lib/moderation';

const SLA_HOURS = 24;

function ageHours(createdAt) {
  const ms = createdAt?.toMillis?.();
  if (!ms) return 0;
  return (Date.now() - ms) / 3_600_000;
}

function AgeBadge({ createdAt }) {
  const hours = ageHours(createdAt);
  if (hours >= SLA_HOURS) {
    return <Badge tone="red" size="sm"><Clock size={10} /> {Math.floor(hours)}h — past SLA</Badge>;
  }
  if (hours >= SLA_HOURS / 2) {
    return <Badge tone="amber" size="sm"><Clock size={10} /> {Math.floor(hours)}h</Badge>;
  }
  return <Badge tone="neutral" size="sm">{hours < 1 ? 'just now' : `${Math.floor(hours)}h`}</Badge>;
}

function ReportRow({ report, onResolve, busy }) {
  const typeLabel = REPORTABLE_TYPES[report.contentType]?.label || report.contentType;
  const reasonLabel = REPORT_REASON_LABELS[report.reason] || report.reason;

  return (
    <li className="py-4 border-b border-subtle last:border-0">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="navy" size="sm">{typeLabel}</Badge>
          <Badge tone="red" size="sm">{reasonLabel}</Badge>
          <AgeBadge createdAt={report.createdAt} />
          {report.hidden && <Badge tone="amber" size="sm">Auto-hidden</Badge>}
        </div>
        <code className="text-[11px] text-muted font-mono break-all">{report.contentPath}</code>
      </div>

      {/* The snapshot is why the queue still works after auto-hide: the
          content document may no longer exist, so this copy is the only
          thing left to judge it by. */}
      <blockquote className="text-sm text-primary bg-hover rounded-xl px-3.5 py-3 whitespace-pre-wrap break-words">
        {report.contentSnapshot || <span className="text-muted italic">(no text — media with no caption)</span>}
      </blockquote>

      {report.details && (
        <p className="text-sm text-secondary mt-2">
          <span className="font-semibold">Reporter said:</span> {report.details}
        </p>
      )}

      <p className="text-xs text-muted mt-2 font-mono break-all">
        author {report.reportedUserId || 'unknown'} · reporter {report.reporterId}
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        <Button
          size="sm"
          variant="secondary"
          icon={Check}
          disabled={busy}
          onClick={() => onResolve(report, 'dismiss')}
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          variant="outline"
          icon={Trash2}
          disabled={busy}
          onClick={() => onResolve(report, 'delete')}
        >
          Delete content
        </Button>
        <Button
          size="sm"
          variant="danger"
          icon={ShieldOff}
          disabled={busy || !report.reportedUserId}
          onClick={() => onResolve(report, 'ban')}
        >
          Delete + ban
        </Button>
      </div>
    </li>
  );
}

export default function ModerationQueue() {
  const { isAdmin, setToast } = useApp();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeOpenReports((list, err) => {
      setReports(list);
      setLoading(false);
      setLoadError(!!err);
    });
    return unsubscribe;
  }, [isAdmin]);

  const overdue = useMemo(
    () => reports.filter((r) => ageHours(r.createdAt) >= SLA_HOURS).length,
    [reports],
  );

  const handleResolve = async (report, action) => {
    const prompts = {
      dismiss: 'Dismiss this report? If the content was auto-hidden it goes back up.',
      delete: 'Delete this content permanently? This cannot be undone.',
      ban: 'Delete this content and ban its author? They keep their account and their existing posts, but cannot post again.',
    };
    if (!window.confirm(prompts[action])) return;

    setBusyId(report.id);
    try {
      const result = await resolveReport(report.id, action);
      setToast?.(
        action === 'dismiss'
          ? (result.restored ? 'Dismissed — the content is visible again.' : 'Dismissed.')
          : action === 'ban'
            ? 'Content deleted and the author banned.'
            : 'Content deleted.',
      );
    } catch (err) {
      setToast?.({ message: err.message || 'That action failed. Please try again.', type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <Card padding="md">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Flag size={18} className="text-brand" />
          Open reports
          {reports.length > 0 && <span className="text-muted font-normal text-sm">({reports.length})</span>}
        </h3>
        {overdue > 0 && (
          <Badge tone="red">
            <AlertTriangle size={11} /> {overdue} past the 24-hour SLA
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted mb-4">
        Oldest first — the report closest to the 24-hour commitment is at the top. Content
        with {AUTO_HIDE_THRESHOLD} or more reports is already hidden from everyone and stays
        hidden until it is dismissed here.
      </p>

      {loading ? (
        <div className="py-10"><Spinner size="md" label="Loading reports…" /></div>
      ) : loadError ? (
        <p className="text-sm text-danger py-8 text-center">
          Couldn’t load the queue. Check that the admin account is signed in and the
          Firestore rules are deployed.
        </p>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Check}
          tone="brand"
          title="Nothing to review"
          body="No open reports. New ones arrive here and by email the moment they’re filed."
        />
      ) : (
        <ul className="list-none p-0 m-0">
          {reports.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              onResolve={handleResolve}
              busy={busyId === report.id}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
