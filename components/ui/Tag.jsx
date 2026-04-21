// components/ui/Tag.jsx
//
// Small interactive chip — for tags, filters, taxonomy. If you need a
// non-interactive status label, use <Badge> instead.
//
// Usage:
//   <Tag>Jam band</Tag>
//   <Tag selected onClick={toggle}>Setlist II</Tag>
//   <Tag onRemove={() => delete(t)}>Red Rocks</Tag>

import React from 'react';
import { X } from 'lucide-react';

export default function Tag({
  children,
  selected = false,
  onClick,
  onRemove,
  icon: Icon,
  className = '',
}) {
  const interactive = !!onClick;

  return (
    <span
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick(e))
          : undefined
      }
      className={[
        'inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-full border px-3 py-1 transition-colors',
        selected
          ? 'bg-brand-subtle border-brand text-[#2a8a47]'
          : 'bg-surface border-subtle text-secondary hover:border-active hover:text-primary',
        interactive && 'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {Icon && <Icon size={13} strokeWidth={2.2} />}
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          aria-label="Remove"
          className="ml-0.5 -mr-1 p-0.5 rounded-full hover:bg-hover"
        >
          <X size={12} strokeWidth={2.4} />
        </button>
      )}
    </span>
  );
}
