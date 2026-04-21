// components/stats/TopList.jsx
//
// Ranked list with rank # + avatar + name + meta + bar + count. Used for Top
// Artists / Top Venues / Top Songs on /stats. Pass items[]; max derived from
// first item unless overridden.
//
//   <TopList items={[
//     { name: 'Phish', meta: '12 shows · 3 tours', count: 12 },
//     { name: 'Billy Strings', meta: '8 shows · 2 tours', count: 8 },
//   ]} />

import React from 'react';
import Avatar from '../ui/Avatar';

export default function TopList({ items = [], max, className = '' }) {
  const cap = max ?? (items[0]?.count || 1);
  return (
    <ul className={`list-none p-0 m-0 ${className}`}>
      {items.map((it, i) => (
        <li
          key={it.id || it.name}
          className="grid grid-cols-[24px_48px_1fr_auto] items-center gap-3.5 py-3 border-b border-subtle last:border-0"
        >
          <span className={`font-mono text-xs font-extrabold ${i === 0 ? 'text-amber' : 'text-muted'}`}>
            #{i + 1}
          </span>
          <Avatar name={it.name} size="md" className="rounded-lg" />
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-primary truncate">{it.name}</div>
            {it.meta && <div className="text-[11px] text-secondary mt-0.5 truncate">{it.meta}</div>}
            <div className="w-[120px] h-1.5 bg-hover rounded-full mt-1.5">
              <div
                className="h-full bg-brand rounded-full"
                style={{ width: `${Math.min(100, (it.count / cap) * 100)}%` }}
              />
            </div>
          </div>
          <div className="font-mono font-extrabold text-[16px] text-primary">{it.count}</div>
        </li>
      ))}
    </ul>
  );
}
