// components/festivals/FestivalLineupModal.jsx
//
// "Search for the festival itself" — looks the festival up on setlist.fm by
// name (+ the festival's own date window), shows every band that played it
// as a bulk-selectable list, and adds every checked one to the user's shows
// *and* to this festival in a single action.
//
// setlist.fm has no festival entity, so the lookup goes through the
// festival's venue — see netlify/functions/search-festival-lineup.js for
// exactly what's queried and why. When it comes back empty (a festival
// setlist.fm doesn't cover well, or a name that resolves to no venue) this
// says so and points back at AttachShowsModal's "pick from my own shows"
// flow rather than blocking anything.
//
// The write half is importShowsToFestival in context/AppContext.jsx, which
// reuses the app's existing artist+venue+date dedup so a set the user
// already logged is attached rather than duplicated.

'use client';

import { useMemo, useState } from 'react';
import { Search, Check, AlertCircle, Music } from 'lucide-react';
import { Modal, Button, Input, Spinner, Badge } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { apiUrl } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { extractSongsFromSetlist } from '@/lib/setlistParser';

export default function FestivalLineupModal({ open, onClose, festival, onImport }) {
  const { shows, festivals } = useApp();

  const [query, setQuery] = useState(festival?.name || '');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [conflicts, setConflicts] = useState(null); // [{showId, artist, date, festivalId}] | null
  const [saving, setSaving] = useState(false);

  const festivalNameFor = (festivalId) => festivals?.find(f => f.id === festivalId)?.name || 'another festival';

  // A lineup entry the user already has logged is still selectable — it just
  // gets attached to the festival instead of creating a second copy.
  const alreadyLogged = useMemo(() => {
    const byKey = new Set();
    (shows || []).forEach(s => {
      if (s.setlistfmId) byKey.add(`id:${s.setlistfmId}`);
      byKey.add(`avd:${(s.artist || '').toLowerCase().trim()}|${(s.venue || '').toLowerCase().trim()}|${s.date}`);
    });
    return byKey;
  }, [shows]);

  const isLogged = (r) =>
    alreadyLogged.has(`id:${r.setlistfmId}`) ||
    alreadyLogged.has(`avd:${r.artist.toLowerCase().trim()}|${r.venue.toLowerCase().trim()}|${r.date}`);

  const runSearch = async () => {
    const name = query.trim();
    if (!name) return;
    setSearching(true);
    setError('');
    setResults([]);
    setSelected(new Set());
    setConflicts(null);
    try {
      const params = new URLSearchParams({ name });
      if (festival?.startDate) params.set('from', festival.startDate);
      if (festival?.endDate) params.set('to', festival.endDate);
      const res = await fetch(`${apiUrl('/.netlify/functions/search-festival-lineup')}?${params}`);
      if (!res.ok) throw new Error('Search failed. Please try again.');
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = results.length > 0 && selected.size === results.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(results.map(r => r.setlistfmId)));
  };

  const handleClose = () => {
    setSelected(new Set());
    setConflicts(null);
    onClose();
  };

  const submit = async (force = false) => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      // Shape each pick the same way SearchView's setlist.fm import does, so
      // an imported festival set is indistinguishable from one added through
      // the normal search.
      const candidates = results
        .filter(r => selected.has(r.setlistfmId))
        .map(r => ({
          artist: r.artist,
          venue: r.venue,
          city: r.city,
          country: r.country,
          date: r.date,
          setlist: extractSongsFromSetlist({ sets: r.sets }),
          setlistfmId: r.setlistfmId,
          tour: r.tour || null,
        }));
      const result = await onImport(candidates, { force });
      if (result?.success === false && result.conflicts?.length) {
        setConflicts(result.conflicts);
        return;
      }
      if (result?.success !== false) handleClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Search this festival's lineup" size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 items-end">
          <Input
            icon={Search}
            label="Festival or venue name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            placeholder="e.g. Bonnaroo, or the grounds it's held at"
            containerClassName="flex-1"
          />
          <Button onClick={runSearch} loading={searching} disabled={!query.trim()}>Search</Button>
        </div>
        {festival?.startDate && (
          <p className="text-xs text-muted -mt-2">
            Searching {formatDate(festival.startDate)}
            {festival.endDate !== festival.startDate ? ` – ${formatDate(festival.endDate)}` : ''} — the
            festival&apos;s own dates.
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {conflicts && conflicts.length > 0 && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm">
            <p className="text-danger font-semibold mb-1">
              {conflicts.length} of these{conflicts.length !== 1 ? ' are' : ' is'} already in another festival:
            </p>
            <ul className="text-secondary mb-2 list-disc list-inside">
              {conflicts.map(c => (
                <li key={c.showId}>{c.artist} — {formatDate(c.date)} (currently in {festivalNameFor(c.festivalId)})</li>
              ))}
            </ul>
            <Button size="sm" variant="danger" onClick={() => submit(true)} loading={saving}>
              Move {conflicts.length !== 1 ? 'them' : 'it'} here anyway
            </Button>
          </div>
        )}

        {searching && <div className="py-8"><Spinner size="md" label="Searching setlist.fm…" /></div>}

        {!searching && searched && results.length === 0 && !error && (
          <div className="text-center py-8 px-4">
            <Music className="w-8 h-8 text-muted mx-auto mb-3" />
            <p className="text-sm text-primary font-semibold mb-1">No lineup found on setlist.fm</p>
            <p className="text-sm text-secondary">
              Not every festival is well covered there. Try the venue&apos;s name instead, or close this
              and use &ldquo;Add shows&rdquo; to pick from the shows you&apos;ve already logged.
            </p>
          </div>
        )}

        {!searching && results.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-secondary">
                {results.length} set{results.length !== 1 ? 's' : ''} found
              </p>
              <Button size="sm" variant="ghost" icon={Check} onClick={toggleAll}>
                {allSelected ? 'Clear all' : 'Select all'}
              </Button>
            </div>

            <div className="max-h-[45vh] overflow-y-auto border border-subtle rounded-xl divide-y divide-subtle">
              {results.map(r => (
                <label
                  key={r.setlistfmId}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.setlistfmId)}
                    onChange={() => toggle(r.setlistfmId)}
                    className="rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-primary truncate">{r.artist}</div>
                    <div className="text-xs text-secondary truncate">
                      {formatDate(r.date)}
                      {r.venue ? ` · ${r.venue}` : ''}
                      {r.songCount > 0 ? ` · ${r.songCount} song${r.songCount !== 1 ? 's' : ''}` : ' · no setlist'}
                    </div>
                  </div>
                  {isLogged(r) && (
                    <Badge tone="green" size="sm">Already logged</Badge>
                  )}
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2.5 mt-5">
        <Button variant="secondary" onClick={handleClose}>Cancel</Button>
        <Button onClick={() => submit(false)} disabled={selected.size === 0} loading={saving}>
          Add {selected.size} show{selected.size !== 1 ? 's' : ''}
        </Button>
      </div>
    </Modal>
  );
}
