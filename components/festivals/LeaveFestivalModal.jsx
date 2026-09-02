// components/festivals/LeaveFestivalModal.jsx
//
// Confirm dialog for leaving a Festival. Replaces the old
// DeleteFestivalModal: festivals are shared now, so a user can only remove
// *their own* attendance — the canonical festival stays for everyone else,
// including when the person leaving is the one who created it. Nothing a
// client does deletes a canonical festival; that's an admin operation.
//
// Says plainly that the shows are kept, because that's the thing people
// are actually afraid of. Mirrors components/shows/DeleteShowModal.jsx's
// confirm pattern, built on the shared Modal primitive.

'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

export default function LeaveFestivalModal({ festival, isOpen, onClose, onConfirm }) {
  const [isLeaving, setIsLeaving] = useState(false);

  if (!isOpen || !festival) return null;

  const handleLeave = async () => {
    setIsLeaving(true);
    try {
      await onConfirm(festival.id);
      onClose();
    } catch {
      setIsLeaving(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Leave this festival?" size="sm">
      <p className="text-secondary text-sm mb-4 leading-relaxed">
        This removes <span className="font-semibold text-primary">{festival.name}</span> from your
        festivals and takes your notes for it with it.{' '}
        <span className="font-semibold text-primary">Every show you had attached is kept</span> — they
        go back to being ordinary shows in your history.
      </p>
      <p className="text-secondary text-sm mb-4 leading-relaxed">
        {festival.isCreator
          ? 'You created this festival, but leaving doesn’t remove it for anyone else who’s added it.'
          : 'Nobody else’s copy of this festival is affected.'}
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} disabled={isLeaving} full>
          Cancel
        </Button>
        <Button
          variant="danger"
          icon={LogOut}
          onClick={handleLeave}
          loading={isLeaving}
          disabled={isLeaving}
          full
        >
          {isLeaving ? 'Leaving…' : 'Leave festival'}
        </Button>
      </div>
    </Modal>
  );
}
