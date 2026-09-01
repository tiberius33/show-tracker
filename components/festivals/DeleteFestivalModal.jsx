// components/festivals/DeleteFestivalModal.jsx
//
// Confirm dialog for deleting a Festival. Explicitly states shows are kept,
// not deleted — deleting a festival only removes the grouping, never any
// show in it. Mirrors components/shows/DeleteShowModal.jsx's confirm
// pattern, built on the shared Modal primitive.

'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

export default function DeleteFestivalModal({ festival, isOpen, onClose, onConfirm }) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !festival) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(festival.id);
      onClose();
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Delete festival?" size="sm">
      <p className="text-secondary text-sm mb-4 leading-relaxed">
        This removes <span className="font-semibold text-primary">{festival.name}</span> and its
        grouping. <span className="font-semibold text-primary">Your shows are kept</span> — they
        just won’t be attached to a festival anymore.
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} disabled={isDeleting} full>
          Cancel
        </Button>
        <Button
          variant="danger"
          icon={Trash2}
          onClick={handleDelete}
          loading={isDeleting}
          disabled={isDeleting}
          full
        >
          {isDeleting ? 'Deleting…' : 'Delete Festival'}
        </Button>
      </div>
    </Modal>
  );
}
