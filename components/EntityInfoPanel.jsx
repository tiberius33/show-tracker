'use client';

import React, { useState, useCallback } from 'react';
import { ChevronDown, ExternalLink, BookOpen, Globe, Music } from 'lucide-react';
import { apiUrl } from '@/lib/api';

const styles = {
  artist: {
    button: 'bg-brand-subtle border border-brand/30 text-brand hover:bg-brand/25',
    panel: 'bg-brand/5 border border-brand/15',
    accent: 'text-brand',
    link: 'text-brand hover:text-brand',
  },
  venue: {
    button: 'bg-amber/15 border border-amber/30 text-amber hover:bg-amber/25',
    panel: 'bg-amber/5 border border-amber/15',
    accent: 'text-amber',
    link: 'text-amber hover:text-amber',
  },
};

function getLinkLabel(u) {
  if (u.type === 'official homepage') return 'Website';
  if (u.url.includes('bandcamp')) return 'Bandcamp';
  if (u.url.includes('instagram')) return 'Instagram';
  if (u.url.includes('twitter') || u.url.includes('x.com')) return 'X';
  if (u.url.includes('facebook')) return 'Facebook';
  if (u.url.includes('spotify')) return 'Spotify';
  if (u.url.includes('youtube')) return 'YouTube';
  if (u.url.includes('soundcloud')) return 'SoundCloud';
  return u.type;
}

const LINK_TYPES_TO_SHOW = [
  'official homepage', 'social network', 'bandcamp', 'streaming',
  'youtube', 'soundcloud',
];

function EntityInfoPanel({ name, type, city }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [enrichData, setEnrichData] = useState(null);
  const [enrichLoading, setEnrichLoading] = useState(false);

  const isArtist = type === 'artist';
  const label = isArtist ? name : `${name}${city ? `, ${city}` : ''}`;
  const s = styles[type] || styles.artist;

  const fetchInfo = useCallback(async () => {
    if (data || loading) return;
    setLoading(true);
    setError(false);

    // Build Wikipedia fetch
    const wikiPromise = (async () => {
      const queryName = !isArtist && city ? `${name}, ${city}` : name;
      const params = new URLSearchParams({ name: queryName, type });
      const res = await fetch(apiUrl(`/.netlify/functions/get-entity-info?${params}`));
      if (!res.ok) throw new Error('fetch failed');
      let json = await res.json();

      if (!json.found && !isArtist && city) {
        const retryParams = new URLSearchParams({ name, type });
        const retryRes = await fetch(apiUrl(`/.netlify/functions/get-entity-info?${retryParams}`));
        if (retryRes.ok) json = await retryRes.json();
      }
      return json;
    })();

    // Fetch enrichment data in parallel (artists only)
    const enrichPromise = isArtist ? (async () => {
      setEnrichLoading(true);
      try {
        const params = new URLSearchParams({ name });
        const res = await fetch(apiUrl(`/.netlify/functions/enrich-artist?${params}`));
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      } finally {
        setEnrichLoading(false);
      }
    })() : Promise.resolve(null);

    try {
      const [wikiResult, enrichResult] = await Promise.all([wikiPromise, enrichPromise]);
      setData(wikiResult);
      if (enrichResult?.found) setEnrichData(enrichResult);
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

  const displayImage = data?.image || enrichData?.image;
  const filteredUrls = (enrichData?.urls || [])
    .filter(u => LINK_TYPES_TO_SHOW.some(t => u.type.includes(t) || u.url.includes(t)))
    .slice(0, 5);

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
              <div className="h-4 bg-hover rounded animate-pulse w-3/4" />
              <div className="h-4 bg-hover rounded animate-pulse w-full" />
              <div className="h-4 bg-hover rounded animate-pulse w-2/3" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <p className="text-sm text-muted">
              Could not load information. Please try again later.
            </p>
          )}

          {/* Not found state (neither Wikipedia nor enrichment found anything) */}
          {data && !data.found && !enrichData && !loading && !enrichLoading && (
            <p className="text-sm text-muted">
              No information found for {label}.
            </p>
          )}

          {/* Loaded state */}
          {!loading && (data?.found || enrichData) && (
            <div>
              <div className="flex gap-4">
                {displayImage && (
                  <div className="flex-shrink-0">
                    <img
                      src={displayImage}
                      alt={data?.name || name}
                      className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover border border-subtle"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {data?.description && (
                    <p className={`text-xs ${s.accent} font-medium mb-1 capitalize`}>
                      {data.description}
                    </p>
                  )}
                  {data?.summary ? (
                    <p className="text-sm text-secondary leading-relaxed" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {data.summary}
                    </p>
                  ) : enrichData?.profile ? (
                    <p className="text-sm text-secondary leading-relaxed" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {enrichData.profile}
                    </p>
                  ) : null}
                  {data?.url && (
                    <a
                      href={data.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 text-xs font-medium mt-2 ${s.link} transition-colors`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Read more on Wikipedia
                    </a>
                  )}
                </div>
              </div>

              {/* --- Artist enrichment sections --- */}
              {isArtist && enrichLoading && !enrichData && (
                <div className="mt-3 h-3 bg-hover rounded animate-pulse w-1/2" />
              )}

              {isArtist && enrichData && (
                <div className="mt-3 space-y-3">
                  {/* Genres */}
                  {enrichData.genres?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {enrichData.genres.slice(0, 8).map(genre => (
                        <span key={genre} className="text-xs font-medium bg-brand-subtle text-brand px-2.5 py-0.5 rounded-full">
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Country + active years */}
                  {(enrichData.country || enrichData.activeYears?.begin) && (
                    <p className="text-xs text-muted flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {enrichData.country && <span>{enrichData.country}</span>}
                      {enrichData.country && enrichData.activeYears?.begin && <span>&middot;</span>}
                      {enrichData.activeYears?.begin && (
                        <span>
                          {enrichData.activeYears.begin}&ndash;{enrichData.activeYears.ended ? enrichData.activeYears.end : 'present'}
                        </span>
                      )}
                    </p>
                  )}

                  {/* Band members */}
                  {enrichData.members?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-1">Members</p>
                      <div className="flex flex-wrap gap-1.5">
                        {enrichData.members.map(m => (
                          <span key={m.name} className={`text-xs px-2 py-0.5 rounded-full ${
                            m.active ? 'bg-hover text-secondary' : 'bg-hover text-muted line-through'
                          }`}>
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* External links */}
                  {filteredUrls.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {filteredUrls.map(u => (
                        <a
                          key={u.url}
                          href={u.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 text-xs ${s.link} transition-colors`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {getLinkLabel(u)}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Source attribution */}
                  {enrichData.sources && (
                    <p className="text-[10px] text-muted">
                      Data from{' '}
                      {enrichData.sources.musicbrainz && (
                        <a href={`https://musicbrainz.org/artist/${enrichData.mbid}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-secondary">MusicBrainz</a>
                      )}
                      {enrichData.sources.musicbrainz && enrichData.sources.discogs && ' & '}
                      {enrichData.sources.discogs && (
                        <a href={`https://www.discogs.com/artist/${enrichData.discogsId}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-secondary">Discogs</a>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EntityInfoPanel;
