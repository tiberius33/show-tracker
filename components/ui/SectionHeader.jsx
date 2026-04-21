// components/ui/SectionHeader.jsx
//
// Title + optional right-side action for subsections within a page.
//
//   <SectionHeader title="Recently added" action={<a>See all →</a>} />

import React from 'react';

export default function SectionHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex items-end justify-between gap-4 mb-4 ${className}`}>
      <div className="min-w-0">
        {title && (
          <h2 className="text-[20px] md:text-[22px] font-bold tracking-[-0.015em] text-primary">
            {title}
          </h2>
        )}
        {subtitle && <p className="text-[13px] text-secondary mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
