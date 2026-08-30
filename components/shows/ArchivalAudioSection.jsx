// components/shows/ArchivalAudioSection.jsx
//
// "Listen to this night" — surfaces verified archival recordings of this
// specific show from Relisten (which aggregates the Internet Archive's Live
// Music Archive and phish.in). Renders nothing at all when no recording
// exists, which is the common case — most shows have nothing, and this must
// not look like a missing feature on nine out of ten show pages.
//
// v1 is link-out only, never an in-app player and never proxied through our
// own domain — we're pointing at someone else's recording, not rehosting
// it. Opens via the Capacitor Browser plugin on iOS so the app's own webview
// isn't navigated away from, same pattern as PlaylistCreatorModal's
// Spotify-auth link-out.

'use client';

import React from 'react';
import { Headphones, ExternalLink, Star, Mic } from 'lucide-react';
import useArchivalAudio from '@/hooks/useArchivalAudio';
import { useApp } from '@/context/AppContext';

async function openExternal(url) {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    }
  } catch {
    // @capacitor/core not available — we're on web
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function RecordingRow({ recording, selected, onSelect }) {
  const sourceLabel = recording.isSoundboard ? 'Soundboard' : (recording.label || 'Recording');
  const attribution = [
    recording.taper ? `Taper: ${recording.taper}` : null,
    recording.transferrer ? `Transfer: ${recording.transferrer}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left flex items-start justify-between gap-3 px-4 py-3 rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
        selected ? 'border-brand bg-brand-subtle' : 'border-subtle bg-surface hover:border-active hover:bg-hover'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-primary">{sourceLabel}</span>
          {recording.avgRating != null && (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-amber">
              <Star className="w-3 h-3 fill-current" /> {recording.avgRating}
              {recording.numReviews > 0 && <span className="text-muted font-normal">({recording.numReviews})</span>}
            </span>
          )}
        </div>
        {attribution && <p className="text-xs text-secondary mt-1">{attribution}</p>}
        {recording.lineage && <p className="text-[11px] text-muted mt-0.5 truncate">{recording.lineage}</p>}
      </div>
      <ExternalLink className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" />
    </button>
  );
}

export default function ArchivalAudioSection({ show }) {
  const { updateArchivalAudioPick } = useApp();
  const { loading, found, recordings } = useArchivalAudio(show?.artist, show?.date);

  if (loading || !found || recordings.length === 0) return null;

  const selectedId = show.archivalAudioPick || recordings[0].id;
  const selected = recordings.find(r => r.id === selectedId) || recordings[0];

  return (
    <div className="mt-4 border border-subtle rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-base">
        <Headphones className="w-4 h-4 text-brand" />
        <span className="text-sm font-bold text-primary">Listen to This Night</span>
        <span className="text-[11px] font-semibold text-muted bg-hover px-1.5 py-0.5 rounded-md">
          {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-3 space-y-2 bg-surface">
        {recordings.map(recording => (
          <RecordingRow
            key={recording.id}
            recording={recording}
            selected={recording.id === selectedId}
            onSelect={() => updateArchivalAudioPick(show.id, recording.id)}
          />
        ))}
      </div>

      <div className="px-4 py-3 bg-base border-t border-subtle">
        <button
          type="button"
          onClick={() => selected.url && openExternal(selected.url)}
          disabled={!selected.url}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-brand text-sidebar font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Mic className="w-4 h-4" />
          {selected.linkLabel || 'Listen'}
        </button>
        <p className="text-[11px] text-muted mt-2 text-center">
          Recordings are hosted by Relisten and its sources, not by MySetlists. Opens in a new tab.
        </p>
      </div>
    </div>
  );
}
