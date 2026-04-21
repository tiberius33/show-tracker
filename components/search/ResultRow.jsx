// components/search/ResultRow.jsx
//
// Generic row for a search result group (shows/artists/songs/venues).
// Thumbnail + name + meta + optional trailing element.

import React from 'react';
import Link from 'next/link';

export default function ResultRow({
  href,
  thumbnail,    // React node OR string to use as seed for generated gradient
  name,
  meta,
  trailing,
}) {
  const Wrap = href ? Link : 'div';
  return (
    <Wrap
      {...(href ? { href } : {})}
      className="grid grid-cols-[48px_1fr_auto] gap-3.5 items-center px-4 py-3 rounded-xl cursor-pointer transition-colors hover:bg-surface"
    >
      {typeof thumbnail === 'string' || !thumbnail ? (
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-light to-amber" />
      ) : thumbnail}
      <div className="min-w-0">
        <div className="text-[15px] font-bold text-primary truncate">{name}</div>
        {meta && <div className="text-[12px] text-secondary mt-0.5 truncate">{meta}</div>}
      </div>
      {trailing && <div>{trailing}</div>}
    </Wrap>
  );
}

export function ResultGroup({ title, children }) {
  return (
    <section className="mb-7">
      <h3 className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-muted m-0 mb-2.5">
        {title}
      </h3>
      {children}
    </section>
  );
}
