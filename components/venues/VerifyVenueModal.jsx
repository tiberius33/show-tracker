'use client';

import React, { useState } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import { Upload, X, FileText } from 'lucide-react';
import { submitVerificationApplication } from '@/lib/venues';

export default function VerifyVenueModal({ open, onClose, venueKey, venueName, venueCity, currentUser }) {
  const [fullName, setFullName] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState('');
  const [files, setFiles] = useState([]);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = fullName.trim() && email.trim() && agreed && files.length > 0 && !submitting;

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files || []).slice(0, 5);
    setFiles(selected);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !currentUser) return;
    setSubmitting(true);
    setError('');
    try {
      await submitVerificationApplication({
        venueKey,
        venueName,
        venueCity,
        applicantUid: currentUser.uid,
        applicantName: fullName.trim(),
        applicantEmail: email.trim(),
        applicantPhone: phone.trim(),
        proofFiles: files,
        onProgress: setProgress,
      });
      setDone(true);
    } catch (err) {
      console.error('Failed to submit venue verification:', err);
      setError('Something went wrong submitting your application. Please try again.');
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    setDone(false);
    setFiles([]);
    setAgreed(false);
    setError('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={done ? 'Application Submitted' : `Verify ${venueName}`} size="md">
      {done ? (
        <div className="text-center py-6">
          <p className="text-primary font-medium mb-2">Thanks — we've got it!</p>
          <p className="text-secondary text-sm mb-6">Our team will review your documents and email you at {email} once a decision is made.</p>
          <Button variant="primary" onClick={handleClose}>Close</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-secondary text-sm">
            Verify that you own or manage this venue to get a blue checkmark, manage venue info, upload official photos, and post announcements.
          </p>
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@venue.com" />
          <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />

          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Proof of ownership/management <span className="text-danger">*</span>
            </label>
            <p className="text-xs text-muted mb-2">Business license, tax ID, utility bill, or an email from your official venue domain.</p>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-subtle rounded-xl p-4 cursor-pointer hover:border-brand/50 transition-colors">
              <Upload size={18} className="text-muted" />
              <span className="text-sm text-secondary">Choose files (up to 5)</span>
              <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleFiles} />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-xs text-secondary bg-hover rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1.5 truncate"><FileText size={14} />{f.name}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-muted hover:text-danger">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-secondary cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
            <span>I confirm I am authorized to represent this venue and the information provided is accurate.</span>
          </label>

          {error && <p className="text-danger text-sm">{error}</p>}
          {submitting && (
            <div className="w-full h-1.5 bg-hover rounded-full overflow-hidden">
              <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" full onClick={handleClose}>Cancel</Button>
            <Button variant="primary" full onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
              {submitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
