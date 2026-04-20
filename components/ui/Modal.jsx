// Accessible modal with backdrop, escape-to-close, scroll-lock.
// Named size presets: sm / md / lg / xl / full.
//
// Usage:
//   <Modal open={isOpen} onClose={close} title="Add a show" size="lg">
//     <div>content</div>
//     <Modal.Footer><Button>Save</Button></Modal.Footer>
//   </Modal>

'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZES = {
  sm:   'max-w-md',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  xl:   'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)]',
};

export default function Modal({ open, onClose, title, subtitle, children, size = 'md', showClose = true, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-end md:items-center justify-center p-0 md:p-4 bg-sidebar/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={[
          'bg-surface w-full shadow-theme-xl flex flex-col max-h-[92vh]',
          'rounded-t-2xl md:rounded-2xl',
          SIZES[size],
        ].join(' ')}
      >
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-4 p-5 md:p-6 border-b border-subtle">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id="modal-title" className="text-xl md:text-2xl font-bold tracking-[-0.015em] text-primary">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-sm text-secondary mt-1">{subtitle}</p>}
            </div>
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="flex-shrink-0 p-2 -m-2 rounded-lg text-muted hover:text-primary hover:bg-hover transition-colors"
              >
                <X size={22} strokeWidth={2.2} />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 md:p-6">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2.5 p-5 md:p-6 border-t border-subtle bg-base/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

Modal.Footer = function ModalFooter({ children }) {
  return <>{children}</>;
};
