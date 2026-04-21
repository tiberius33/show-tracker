// components/shows/SideCard.jsx
//
// Inset card used in /shows/[id] sidebar — stats, notes, friends. Uppercase
// eyebrow heading. Pairs with <SideStat> row for key-value lists.

import React from 'react';

export function SideCard({ title, children, className = '' }) {
  return (
    <section className={`bg-base rounded-2xl p-5 mb-3 ${className}`}>
      {title && (
        <h4 className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-muted m-0 mb-3.5">
          {title}
        </h4>
      )}
      {children}
    </section>
  );
}

export function SideStat({ k, v, tone = 'default' }) {
  const vCls = tone === 'brand' ? 'text-brand' : 'text-primary';
  return (
    <div className="flex justify-between py-2 text-[13px] border-b border-subtle last:border-0">
      <span className="text-secondary">{k}</span>
      <span className={`font-bold ${vCls}`}>{v}</span>
    </div>
  );
}

export default SideCard;
