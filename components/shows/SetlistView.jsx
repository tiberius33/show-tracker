// components/shows/SetlistView.jsx
//
// Setlist renderer. Takes sets[] where each set has a label + tracks[]. Tracks
// can be flagged `debut` or `bustout` to render a pill alongside the title.
//
// Example:
//   <SetlistView sets={[
//     { label: 'Set I', tracks: [
//       { title: 'Frankenstein', duration: '8:14' },
//       { title: 'Foam', duration: '9:03', bustout: true, bustoutNote: '47 shows' },
//     ]},
//     { label: 'Encore', tracks: [{ title: 'Tweezer Reprise', duration: '6:55' }] },
//   ]} />

import React from 'react';

export default function SetlistView({ sets = [] }) {
  return (
    <div>
      {sets.map((set, si) => (
        <section key={si} className="mb-2">
          <div className="flex items-center gap-3 mt-6 mb-3 first:mt-0">
            <hr className="flex-1 border-t border-subtle m-0" />
            <span className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-muted">
              {set.label}
            </span>
            <hr className="flex-1 border-t border-subtle m-0" />
          </div>
          <ol className="list-none p-0 m-0">
            {set.tracks.map((t, ti) => (
              <li
                key={ti}
                className="grid grid-cols-[28px_1fr_auto] gap-3 items-center px-2.5 py-2 rounded-lg hover:bg-hover cursor-pointer transition-colors"
              >
                <span className="font-mono text-xs text-muted font-bold text-right">
                  {String(ti + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] font-medium text-primary">
                  {t.title}
                  {t.debut && (
                    <span className="ml-2 inline-block text-[9px] font-extrabold tracking-[0.1em] uppercase text-[#2a8a47] bg-brand-subtle px-1.5 py-0.5 rounded">
                      debut
                    </span>
                  )}
                  {t.bustout && (
                    <span className="ml-2 inline-block text-[9px] font-extrabold tracking-[0.1em] uppercase text-[#a0680f] bg-amber-subtle px-1.5 py-0.5 rounded">
                      bust-out{t.bustoutNote ? ` · ${t.bustoutNote}` : ''}
                    </span>
                  )}
                </span>
                {t.duration && (
                  <span className="font-mono text-[11px] text-muted font-semibold">
                    {t.duration}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
