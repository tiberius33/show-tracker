// Top-of-page title block. Consistent across every route.
//
// Usage:
//   <PageHeader eyebrow="Library" title="My Shows" subtitle="87 shows" actions={<Button>Add</Button>} />

import React from 'react';

export default function PageHeader({ eyebrow, title, subtitle, actions, className = '' }) {
  return (
    <header
      className={`flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-6 mb-7 border-b border-subtle ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[12px] font-extrabold text-brand tracking-[0.1em] uppercase mb-2">
            {eyebrow}
          </div>
        )}
        {title && (
          <h1 className="text-[32px] md:text-[40px] leading-[1.05] font-extrabold tracking-[-0.025em] text-primary">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-[15px] text-secondary mt-2 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex gap-2.5 flex-wrap flex-shrink-0">{actions}</div>}
    </header>
  );
}
