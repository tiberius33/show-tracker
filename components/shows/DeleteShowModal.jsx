'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function DeleteShowModal({ show, isOpen, onClose, onConfirm }) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !show) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(show.id);
      onClose();
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[9999]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-800 border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-3">Delete Show?</h2>

        <p className="text-gray-300 text-sm mb-4">
          Are you sure you want to remove this show from your collection? This cannot be undone.
        </p>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6 space-y-0.5">
          {show.date && (
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              {formatDate(show.date)}
            </div>
          )}
          <div className="text-base font-bold text-white">{show.artist}</div>
          <div className="text-sm text-gray-300">{show.venue}</div>
          {show.city && <div className="text-xs text-gray-500">{show.city}</div>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Show
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
