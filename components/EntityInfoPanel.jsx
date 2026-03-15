'use client';

import React, { useState, useCallback } from 'react';
import { ChevronDown, ExternalLink, BookOpen } from 'lucide-react';
import { apiUrl } from '@/lib/api';

const styles = {
  artist: {
    button: 'bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25',
    panel: 'bg-amber-500/5 border border-amber-500/15',
    accent: 'text-amber-400',
    link: 'text-amber-400 hover:text-amber-300',
  },
  venue: {
    button: 'bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25',
    panel: 'bg-blue-500/5 border border-blue-500/15',
    accent: 'text-blue-400',
    link: 'text-blue-400 hover:text-blue-300',
  },
};

function EntityInfoPanel({ name, type, city }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const isArtist = type === 'artist';
  const label = isArtist ? name : `${name}${city ? `, ${city}` : ''}`;
  const s = styles[type] || styles.artist;

  const fetchInfo = useCallback(async () => {
    if (data || loading) return;
    setLoading(true);
    setError(false);
    try {
      // For venues, try "VenueName, City" first for better disambiguation
      const queryName = !isArtist && city ? `${name}, ${city}` : name;
      const params = new URLSearchParams({ name: queryName, type });
      const res = await fetch(apiUrl(`/.netlify/functions/get-entity-info?${params}`));
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();

      // If venue+city lookup returned not-found, retry with just venue name
      if (!json.found && !isArtist && city) {
        const retryParams = new URLSearchParams({ name, type });
        const retryRes = await fetch(apiUrl(`/.netlify/functions/get-entity-info?${retryParams}`));
        if (retryRes.ok) {
          const retryJson = await retryRes.json();
          setData(retryJson);
          setLoading(false);
          return;
        }
      }

      setData(json);
    } catch (e) {
      setError(true);
    }
    setLoading(false);
  }, [name, type, city, data, loading, isArtist]);

  const handleToggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && !data && !loading) {
      fetchInfo();
    }
  };

  return (
    <div className="mt-3">
      <button
        onClick={handleToggle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${s.button} text-sm font-medium transition-colors`}
      >
        <BookOpen className="w-4 h-4" />
        About {label}
        <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`mt-2 ${s.panel} rounded-2xl p-4`}>
          {/* Loading state */}
          {loading && (
            <div className="space-y-2">
              <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-2/3" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <p className="text-sm text-white/40">
              Could not load information. Please try again later.
            </p>
          )}

          {/* Not found state */}
          {data && !data.found && !loading && (
            <p className="text-sm text-white/40">
              No Wikipedia article found for {label}.
            </p>
          )}

          {/* Loaded state */}
          {data && data.found && !loading && (
            <div className="flex gap-4">
              {data.image && (
                <div className="flex-shrink-0">
                  <img
                    src={data.image}
                    alt={data.name}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover border border-white/10"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {data.description && (
                  <p className={`text-xs ${s.accent} font-medium mb-1 capitalize`}>
                    {data.description}
                  </p>
                )}
                <p className="text-sm text-white/70 leading-relaxed" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {data.summary}
                </p>
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 text-xs font-medium mt-2 ${s.link} transition-colors`}
                >
                  <ExternalLink className="w-3 h-3" />
                  Read more on Wikipedia
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EntityInfoPanel;
