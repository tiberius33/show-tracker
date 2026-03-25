'use client';

import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar, Music, RefreshCw, Clock } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { artistColor } from '@/lib/utils';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, cachedAt } = JSON.parse(raw);
    if (Date.now() - cachedAt < CACHE_TTL_MS) return data;
    localStorage.removeItem(key);
  } catch { /* ignore */ }
  return null;
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch { /* ignore */ }
}

function formatTourDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function formatSetlistFmDate(dateStr) {
  if (!dateStr) return '';
  const [day, month, year] = dateStr.split('-');
  try {
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

export default function TourInfoModal({ artistName, mbid, onClose }) {
  const [tourData, setTourData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('current');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchTourData = async (force = false) => {
    if (!mbid) {
      setError('No MusicBrainz ID available for this artist.');
      setLoading(false);
      return;
    }

    const cacheKey = `tour_info_${mbid}`;
    if (!force) {
      const cached = getCached(cacheKey);
      if (cached) {
        setTourData(cached);
        setLastUpdated(cached.fetchedAt);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl('/.netlify/functions/get-artist-tours')}?mbid=${encodeURIComponent(mbid)}`);
      if (!res.ok) throw new Error('Failed to fetch tour data');
      const data = await res.json();
      setTourData(data);
      setLastUpdated(data.fetchedAt);
      setCache(cacheKey, data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTourData();
  }, [mbid]);

  const currentTour = tourData?.tours?.find(t => {
    if (!t.endDate) return false;
    return new Date(t.endDate) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // within last 30 days
  });

  const recentTours = tourData?.tours?.slice(0, 5) || [];
  const allTours = tourData?.tours || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div className="bg-surface border border-subtle rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
          <div>
            <h3 className="text-lg font-bold" style={{ color: artistColor(artistName) }}>{artistName}</h3>
            <p className="text-xs text-muted">Tour Information from setlist.fm</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTourData(true)}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-hover text-muted hover:text-primary transition-colors"
              title="Refresh tour data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-hover text-muted hover:text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-subtle bg-hover">
          {['current', 'recent', 'all'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-brand/20 text-brand' : 'text-secondary hover:text-primary hover:bg-[rgba(255,255,255,0.06)]'
              }`}
            >
              {t === 'current' ? 'Current Tour' : t === 'recent' ? 'Recent Tours' : 'All-Time Stats'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-3" />
              <p className="text-muted text-sm">Loading tour data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-danger text-sm">{error}</p>
            </div>
          ) : (
            <>
              {tab === 'current' && (
                <div>
                  {currentTour ? (
                    <TourCard tour={currentTour} isCurrent />
                  ) : (
                    <div className="text-center py-8">
                      <Music className="w-10 h-10 text-muted mx-auto mb-3" />
                      <p className="text-muted text-sm">No active tour detected</p>
                      <p className="text-muted text-xs mt-1">Check &quot;Recent Tours&quot; for the latest activity</p>
                    </div>
                  )}
                </div>
              )}

              {tab === 'recent' && (
                <div className="space-y-4">
                  {recentTours.length === 0 ? (
                    <p className="text-muted text-center py-8">No recent tours found</p>
                  ) : (
                    recentTours.map((tour, i) => <TourCard key={i} tour={tour} />)
                  )}
                </div>
              )}

              {tab === 'all' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-hover border border-subtle rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{tourData?.totalShows || 0}</div>
                      <div className="text-xs text-muted">Shows Tracked</div>
                    </div>
                    <div className="bg-hover border border-subtle rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{allTours.length}</div>
                      <div className="text-xs text-muted">Tours Found</div>
                    </div>
                  </div>
                  {allTours.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-secondary">All Tours</h4>
                      {allTours.map((tour, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-hover rounded-lg text-sm">
                          <span className="text-primary font-medium truncate flex-1">{tour.name}</span>
                          <div className="flex items-center gap-3 text-muted text-xs flex-shrink-0">
                            <span>{tour.showCount} shows</span>
                            {tour.startDate && <span>{formatTourDate(tour.startDate)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {lastUpdated && (
          <div className="px-6 py-2 border-t border-subtle flex items-center gap-2 text-xs text-muted">
            <Clock className="w-3 h-3" />
            <span>Last updated: {formatTourDate(lastUpdated)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TourCard({ tour, isCurrent = false }) {
  return (
    <div className={`bg-hover border rounded-xl p-4 ${isCurrent ? 'border-brand/30' : 'border-subtle'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h4 className="font-semibold text-primary">{tour.name}</h4>
          <div className="flex items-center gap-3 mt-1 text-xs text-secondary">
            {tour.startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatTourDate(tour.startDate)} — {tour.endDate ? formatTourDate(tour.endDate) : 'ongoing'}
              </span>
            )}
          </div>
        </div>
        {isCurrent && (
          <span className="px-2 py-1 rounded-full text-xs font-bold bg-brand/20 text-brand">Active</span>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm text-secondary">
        <span>{tour.showCount} shows</span>
        <span>~{tour.avgSongCount} songs/show</span>
      </div>
      {tour.shows && tour.shows.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {tour.shows.slice(0, 5).map((show, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{show.venue}{show.city ? `, ${show.city}` : ''}</span>
              <span className="flex-shrink-0">{formatSetlistFmDate(show.date)}</span>
            </div>
          ))}
          {tour.shows.length > 5 && (
            <p className="text-xs text-muted pl-5">+{tour.shows.length - 5} more</p>
          )}
        </div>
      )}
    </div>
  );
}
