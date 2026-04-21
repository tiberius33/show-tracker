// components/search/SearchBox.jsx
//
// Tall branded search box for /search. Larger than the sidebar SearchField —
// takes up page width and focuses itself on mount.

'use client';
import React, { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export default function SearchBox({
  value,
  onChange,
  placeholder = 'Search shows, artists, venues…',
  resultCount,
  autoFocus = true,
}) {
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const active = !!value;
  return (
    <div
      className={[
        'bg-surface border-2 rounded-2xl px-6 py-4 flex gap-3.5 items-center mb-5 transition-all',
        active ? 'border-brand shadow-[0_0_0_4px_rgba(75,200,106,0.15)]' : 'border-subtle',
      ].join(' ')}
    >
      <Search size={22} strokeWidth={2.4} className={active ? 'text-brand' : 'text-muted'} />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="flex-1 border-0 outline-none font-sans text-[18px] font-semibold text-primary bg-transparent placeholder:text-muted placeholder:font-medium"
      />
      {typeof resultCount === 'number' && (
        <span className="text-muted text-[13px] whitespace-nowrap">{resultCount} results</span>
      )}
    </div>
  );
}
