// "Where to Stream This Show" section for the SetlistEditor modal.
// Shows artist-appropriate streaming platforms with deep links where possible.

import React, { useState } from 'react';
import { ExternalLink, ChevronDown } from 'lucide-react';
import { getStreamingPlatforms } from '@/lib/streamingPlatforms';

const PLATFORM_COLORS = {
  'nugs.net':    { bg: 'hover:bg-[#1a3a2a]', accent: 'group-hover:text-brand' },
  'playdead.co': { bg: 'hover:bg-[#2a1f1f]', accent: 'group-hover:text-[#e05555]' },
  'relisten.net':{ bg: 'hover:bg-[#1a2a3a]', accent: 'group-hover:text-[#60a5fa]' },
  'archive.org': { bg: 'hover:bg-[#2a2a1a]', accent: 'group-hover:text-amber' },
};

export default function StreamingLinks({ show }) {
  const [collapsed, setCollapsed] = useState(false);

  const platforms = getStreamingPlatforms(show?.artist, show?.date, show?.venue);

  if (!platforms.length) return null;

  return (
    <div className="mt-4 border border-subtle rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-base hover:bg-hover transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🎧</span>
          <span className="text-sm font-bold text-primary">Where to Stream This Show</span>
          <span className="text-[11px] font-semibold text-muted bg-hover px-1.5 py-0.5 rounded-md">
            {platforms.length}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {!collapsed && (
        <div className="divide-y divide-subtle">
          {platforms.map((platform) => {
            const colors = PLATFORM_COLORS[platform.name] || {};
            return (
              <a
                key={platform.name}
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center justify-between px-4 py-3 bg-surface transition-colors ${colors.bg || 'hover:bg-hover'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl w-7 text-center flex-shrink-0">{platform.icon}</span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-primary">{platform.label}</div>
                    {platform.description && (
                      <div className="text-[11px] text-muted mt-0.5">{platform.description}</div>
                    )}
                  </div>
                </div>
                <ExternalLink
                  size={14}
                  className={`text-muted flex-shrink-0 ml-3 transition-colors ${colors.accent || 'group-hover:text-brand'}`}
                />
              </a>
            );
          })}
        </div>
      )}

      {!collapsed && (
        <div className="px-4 py-2.5 bg-base border-t border-subtle">
          <p className="text-[11px] text-muted">
            Availability may vary. Links open in new tab.
          </p>
        </div>
      )}
    </div>
  );
}
