// Horizontal rule with optional centered label ("OR", "Set II", etc.).

import React from 'react';

export default function Divider({ label, className = '' }) {
  if (!label) {
    return <hr className={`border-t border-subtle ${className}`} />;
  }
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1 border-t border-subtle" />
      <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted">{label}</span>
      <div className="flex-1 border-t border-subtle" />
    </div>
  );
}
