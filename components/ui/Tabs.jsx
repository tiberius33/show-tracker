// components/ui/Tabs.jsx
//
// Underline-style tab bar. Controlled.
//
// Usage:
//   <Tabs value={tab} onChange={setTab} tabs={[
//     { id: 'shows', label: 'Shows', count: 87 },
//     { id: 'wishlist', label: 'Wishlist', count: 12 },
//     { id: 'upcoming', label: 'Upcoming' },
//   ]} />

import React from 'react';

export default function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div
      role="tablist"
      className={`flex gap-1 border-b border-subtle overflow-x-auto scrollbar-hide ${className}`}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(t.id)}
            className={[
              'relative flex items-center gap-2 px-4 py-3 text-[14px] font-semibold whitespace-nowrap transition-colors',
              active ? 'text-primary' : 'text-muted hover:text-secondary',
            ].join(' ')}
          >
            {t.icon && <t.icon size={15} strokeWidth={2.2} />}
            <span>{t.label}</span>
            {typeof t.count === 'number' && (
              <span
                className={[
                  'text-[11px] font-bold px-1.5 py-0.5 rounded-md',
                  active ? 'bg-brand-subtle text-[#2a8a47]' : 'bg-hover text-muted',
                ].join(' ')}
              >
                {t.count}
              </span>
            )}
            {active && (
              <span className="absolute inset-x-3 -bottom-px h-0.5 bg-brand rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
