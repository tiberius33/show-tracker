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
import Link from 'next/link';

// Props:
//   sets           – array of { label, tracks[] }
//   showPlayCounts – boolean, display "Seen Nx" pill next to each song
//   playCounts     – { [songTitle]: count } map
//   onSongClick    – (title) => void, called when song title is clicked
//   getSongHref    – (title) => string | null, when provided the song title
//                    (and its "Seen Nx" pill) render as a link to that href
//                    instead of calling onSongClick — used to link straight
//                    to a song's own page rather than opening a modal.
export default function SetlistView({ sets = [], showPlayCounts = false, playCounts = {}, onSongClick, getSongHref }) {
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
              <React.Fragment key={ti}>
                <li className="grid grid-cols-[28px_1fr_auto] gap-3 items-center px-2.5 py-2 rounded-lg hover:bg-hover cursor-pointer transition-colors">
                  <span className="font-mono text-xs text-muted font-bold text-right">
                    {String(ti + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[15px] font-medium text-primary leading-snug">
                    {getSongHref?.(t.title) ? (
                      <Link
                        href={getSongHref(t.title)}
                        className="hover:text-brand hover:underline transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
                      >
                        {t.title}
                      </Link>
                    ) : (
                      <button
                        onClick={() => onSongClick?.(t.title)}
                        className="hover:text-brand hover:underline transition-colors text-left"
                      >
                        {t.title}
                      </button>
                    )}
                    {t.cover && (
                      <span className="ml-2 inline-block text-[9px] font-extrabold tracking-[0.1em] uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                        {t.cover} cover
                      </span>
                    )}
                    {t.debut && (
                      <span className="ml-2 inline-block text-[9px] font-extrabold tracking-[0.1em] uppercase text-brand bg-brand-subtle px-1.5 py-0.5 rounded">
                        debut
                      </span>
                    )}
                    {t.bustout && (
                      <span className="ml-2 inline-block text-[9px] font-extrabold tracking-[0.1em] uppercase text-[#a0680f] bg-amber-subtle px-1.5 py-0.5 rounded">
                        bust-out{t.bustoutNote ? ` · ${t.bustoutNote}` : ''}
                      </span>
                    )}
                    {t.manual && (
                      <span className="ml-2 inline-block text-[9px] font-extrabold tracking-[0.1em] uppercase text-secondary bg-hover px-1.5 py-0.5 rounded">
                        added by you
                      </span>
                    )}
                    {showPlayCounts && playCounts[t.title] > 0 && (
                      getSongHref?.(t.title) ? (
                        <Link
                          href={getSongHref(t.title)}
                          className="ml-2 inline-block text-[10px] font-bold text-success hover:text-success/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
                        >
                          Seen {playCounts[t.title]}×
                        </Link>
                      ) : (
                        <button
                          onClick={() => onSongClick?.(t.title)}
                          className="ml-2 inline-block text-[10px] font-bold text-success hover:text-success/80 transition-colors"
                        >
                          Seen {playCounts[t.title]}×
                        </button>
                      )
                    )}
                  </span>
                  {t.duration && (
                    <span className="font-mono text-[11px] text-muted font-semibold">
                      {t.duration}
                    </span>
                  )}
                </li>
                {t.tape && (
                  <li className="grid grid-cols-[28px_1fr] gap-3 px-2.5 py-0.5 pointer-events-none">
                    <span />
                    <span className="text-[11px] text-muted font-medium tracking-wide">&gt; segue</span>
                  </li>
                )}
              </React.Fragment>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
