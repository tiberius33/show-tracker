// components/wishlist/ArtistPicker.jsx
//
// Standalone artist search/select control, extracted from the artist
// disambiguation flow in SearchView.jsx (setlist.fm search-artists function).
// Unlike SearchView this isn't coupled to the setlist-import flow — it just
// resolves a query to { name, mbid, disambiguation, sortName } and hands it
// back via onSelect.

'use client';

import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input, Spinner } from '@/components/ui';
import { apiUrl } from '@/lib/api';

export default function ArtistPicker({ onSelect }) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState([]);

  const search = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setError('');
    setOptions([]);
    try {
      const params = new URLSearchParams({ artistName: query.trim() });
      const res = await fetch(apiUrl(`/.netlify/functions/search-artists?${params.toString()}`));
      if (!res.ok) throw new Error('Failed to search artists');
      const data = await res.json();
      if (!data.artist || data.artist.length === 0) {
        setError('No artists found. Try a different search term.');
        return;
      }
      const exactMatch = data.artist.find(a => a.name.toLowerCase() === query.trim().toLowerCase());
      if (data.artist.length === 1 || exactMatch) {
        onSelect(exactMatch || data.artist[0]);
        setQuery('');
        return;
      }
      setOptions(data.artist.slice(0, 10));
    } catch (err) {
      console.error('Artist search error:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-lg">
      <div className="flex gap-2">
        <Input
          icon={Search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search for an artist…"
          containerClassName="flex-1"
          aria-label="Search for an artist"
        />
        <button
          type="button"
          onClick={search}
          disabled={isSearching || !query.trim()}
          className="px-5 py-2.5 bg-brand text-[#2a2a4e] rounded-xl font-semibold text-sm hover:bg-[#e6c200] transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {isSearching ? <Spinner size="sm" /> : 'Search'}
        </button>
      </div>

      {error && <p className="text-sm text-danger mt-2">{error}</p>}

      {options.length > 0 && (
        <div className="mt-3 bg-surface border border-subtle rounded-2xl p-2 space-y-1 max-h-72 overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-secondary">Multiple artists found — pick one</span>
            <button
              type="button"
              onClick={() => setOptions([])}
              className="text-muted hover:text-primary p-1"
              aria-label="Dismiss results"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {options.map((artist) => (
            <button
              key={artist.mbid || artist.name}
              type="button"
              onClick={() => { onSelect(artist); setOptions([]); setQuery(''); }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-hover transition-colors"
            >
              <div className="font-medium text-primary text-sm">{artist.name}</div>
              {artist.disambiguation && (
                <div className="text-xs text-secondary mt-0.5">{artist.disambiguation}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
