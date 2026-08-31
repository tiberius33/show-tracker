'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, FileText, Flag, ArrowLeft } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageHeader, Button, Card, Tabs } from '@/components/ui';
import {
  subscribeVenueVerificationApplications, approveVerificationApplication, rejectVerificationApplication,
  subscribeVenueReports, resolveVenueReport,
} from '@/lib/venues';

const REJECTION_REASONS = [
  'Documents did not prove ownership/management',
  'Documents were unreadable or incomplete',
  'Venue information could not be confirmed',
  'Suspected fraudulent application',
];

function ApplicationCard({ app, onApprove, onReject }) {
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [busy, setBusy] = useState(false);

  return (
    <Card variant="elevated" padding="lg" className="mb-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold text-primary">{app.venueName}</h3>
          <p className="text-sm text-secondary">{app.venueCity}</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-hover text-secondary capitalize">{app.status}</span>
      </div>

      <div className="text-sm text-secondary space-y-1 mb-3">
        <p><strong className="text-primary">{app.applicantName}</strong> — {app.applicantEmail}</p>
        {app.applicantPhone && <p>{app.applicantPhone}</p>}
      </div>

      {app.proofDocuments?.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted uppercase mb-2">Submitted Documents</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {app.proofDocuments.map((doc, i) => (
              <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-hover border border-subtle">
                {doc.url.match(/\.pdf($|\?)/i) ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted gap-1">
                    <FileText size={20} />
                    <span className="text-[10px] px-1 truncate w-full text-center">{doc.name}</span>
                  </div>
                ) : (
                  <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" />
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {app.status === 'pending' && (
        <>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reviewer notes (optional)"
            rows={2}
            className="w-full mb-3 px-3 py-2 bg-hover border border-subtle rounded-lg text-sm text-primary placeholder-muted resize-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary" size="sm" icon={CheckCircle}
              loading={busy}
              onClick={async () => { setBusy(true); await onApprove(app, notes); setBusy(false); }}
            >
              Approve
            </Button>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="text-sm bg-hover border border-subtle rounded-lg px-2 py-1.5 text-secondary">
              {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <Button
              variant="danger" size="sm" icon={XCircle}
              loading={busy}
              onClick={async () => { setBusy(true); await onReject(app, reason, notes); setBusy(false); }}
            >
              Reject
            </Button>
          </div>
        </>
      )}
      {app.rejectionReason && <p className="text-sm text-danger mt-2">Rejected: {app.rejectionReason}</p>}
    </Card>
  );
}

function ReportCard({ report, onResolve }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card variant="elevated" padding="lg" className="mb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-primary flex items-center gap-1.5"><Flag size={14} className="text-danger" /> {report.venueName}</h3>
          <p className="text-sm text-secondary mt-1 capitalize">{report.reason.replace(/_/g, ' ')}</p>
          {report.comment && <p className="text-sm text-secondary mt-1">"{report.comment}"</p>}
          <p className="text-xs text-muted mt-1">Reported by {report.reporterName}</p>
        </div>
        <Button variant="ghost" size="sm" loading={busy} onClick={async () => { setBusy(true); await onResolve(report.id); setBusy(false); }}>
          Mark Resolved
        </Button>
      </div>
    </Card>
  );
}

export default function AdminVenueVerificationsPage() {
  const router = useRouter();
  const { isAdmin } = useApp();
  const [tab, setTab] = useState('applications');
  const [applications, setApplications] = useState([]);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub1 = subscribeVenueVerificationApplications(setApplications);
    const unsub2 = subscribeVenueReports(setReports);
    return () => { unsub1(); unsub2(); };
  }, [isAdmin]);

  if (!isAdmin) return null;

  const pending = applications.filter((a) => a.status === 'pending');
  const reviewed = applications.filter((a) => a.status !== 'pending');

  return (
    <div>
      <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push('/admin/')} className="mb-4">Back to Admin</Button>
      <PageHeader eyebrow="Admin" title="Venue Verifications" subtitle={`${pending.length} pending applications · ${reports.length} open reports`} />

      <Tabs
        tabs={[
          { id: 'applications', label: 'Applications', count: pending.length },
          { id: 'reports', label: 'Reports', count: reports.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mt-6">
        {tab === 'applications' ? (
          <>
            {pending.length === 0 && reviewed.length === 0 && <p className="text-secondary text-sm">No applications yet.</p>}
            {pending.map((app) => (
              <ApplicationCard key={app.id} app={app} onApprove={approveVerificationApplication} onReject={rejectVerificationApplication} />
            ))}
            {reviewed.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-muted uppercase mt-8 mb-3">Reviewed</h3>
                {reviewed.map((app) => (
                  <ApplicationCard key={app.id} app={app} onApprove={approveVerificationApplication} onReject={rejectVerificationApplication} />
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {reports.length === 0 && <p className="text-secondary text-sm">No open reports.</p>}
            {reports.map((r) => <ReportCard key={r.id} report={r} onResolve={resolveVenueReport} />)}
          </>
        )}
      </div>
    </div>
  );
}
