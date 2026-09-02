// components/festivals/FestivalFormModal.jsx
//
// Create/edit modal for a Festival — name (required), start/end date
// (required, end >= start validated client-side), location + notes
// (optional). Reuses the same Modal/Input/Textarea/Button primitives as
// other form modals in the app (see components/VenueRatingModal.jsx).

'use client';

import { useEffect, useState } from 'react';
import { Modal, Button, Input, Textarea } from '@/components/ui';

export default function FestivalFormModal({ open, onClose, onSubmit, festival = null }) {
  const isEdit = !!festival;
  const [name, setName] = useState(festival?.name || '');
  const [startDate, setStartDate] = useState(festival?.startDate || '');
  const [endDate, setEndDate] = useState(festival?.endDate || '');
  const [location, setLocation] = useState(festival?.location || '');
  const [notes, setNotes] = useState(festival?.notes || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // This component stays mounted between openings (Modal returns null when
  // closed), so without this the create form would still be holding the
  // previous festival's values the second time it's opened — and the edit
  // form wouldn't pick up a festival edited elsewhere.
  useEffect(() => {
    if (!open) return;
    setName(festival?.name || '');
    setStartDate(festival?.startDate || '');
    setEndDate(festival?.endDate || '');
    setLocation(festival?.location || '');
    setNotes(festival?.notes || '');
    setError('');
  }, [open, festival]);

  const handleSubmit = async () => {
    if (!name.trim()) return setError('Give your festival a name.');
    if (!startDate || !endDate) return setError('Start and end dates are required.');
    if (endDate < startDate) return setError('End date can’t be before the start date.');
    setError('');
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), startDate, endDate, location, notes });
      onClose();
    } catch {
      // AppContext already surfaces a toast on failure — keep the modal
      // open so the user can retry without re-typing everything.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit festival' : 'New festival'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>{isEdit ? 'Save changes' : 'Create festival'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bonnaroo 2023"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="End date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Input
          label="Location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Manchester, TN"
        />
        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything you want to remember about this one"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
