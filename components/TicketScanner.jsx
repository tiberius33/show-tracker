'use client';

import React, { useState } from 'react';
import { Camera, X, RefreshCw, Search, Check, Download, Plus, ChevronDown } from 'lucide-react';
import { resizeImageForUpload } from '@/lib/utils';

function TicketScanner({ onImport, importedIds, existingShows }) {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [extractedShows, setExtractedShows] = useState([]);
  const [expandedSetlist, setExpandedSetlist] = useState(null);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    const imageFiles = selected.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setError('Please select image files (JPG, PNG, etc.)');
      return;
    }
    setFiles(prev => [...prev, ...imageFiles]);
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviews(prev => [...prev, { name: file.name, url: ev.target.result }]);
      };
      reader.readAsDataURL(file);
    });
    setError('');
  };

  const removeImage = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const analyzeTickets = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    setError('');
    setExtractedShows([]);

    try {
      const images = [];
      for (const file of files) {
        const { base64, mediaType } = await resizeImageForUpload(file);
        images.push({ base64, mediaType });
      }

      const response = await fetch('/.netlify/functions/analyze-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Server returned invalid response (status ${response.status}). Images may be too large — try fewer or smaller images.`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze tickets');
      }

      const shows = Array.isArray(data.shows) ? data.shows : [];
      if (shows.length === 0) {
        setError('No shows detected in the ticket images. Try different or clearer images.');
        setAnalyzing(false);
        return;
      }

      const initial = shows.map(s => ({
        ...s,
        setlistResults: [],
        searching: true,
        imported: false,
        noResults: false,
      }));
      setExtractedShows(initial);
      setAnalyzing(false);

      // Search setlist.fm for each extracted show
      for (let i = 0; i < shows.length; i++) {
        const show = shows[i];
        if (!show.artist) {
          setExtractedShows(prev => prev.map((s, idx) => idx === i ? { ...s, searching: false, noResults: true } : s));
          continue;
        }

        try {
          const artistParams = new URLSearchParams({ artistName: show.artist });
          const artistRes = await fetch(`/.netlify/functions/search-artists?${artistParams.toString()}`);
          let artistMbid = null;

          if (artistRes.ok) {
            const artistData = await artistRes.json();
            if (artistData.artist && artistData.artist.length > 0) {
              const exactMatch = artistData.artist.find(a => a.name.toLowerCase() === show.artist.toLowerCase());
              artistMbid = (exactMatch || artistData.artist[0]).mbid;
            }
          }

          const params = new URLSearchParams();
          if (artistMbid) {
            params.set('artistMbid', artistMbid);
          } else {
            params.set('artistName', show.artist);
          }
          if (show.date) {
            const yearMatch = show.date.match(/(\d{4})/);
            if (yearMatch) params.set('year', yearMatch[1]);
          }

          const setlistRes = await fetch(`/.netlify/functions/search-setlists?${params.toString()}`);

          if (setlistRes.ok) {
            const setlistData = await setlistRes.json();
            const results = setlistData.setlist || [];
            setExtractedShows(prev => prev.map((s, idx) =>
              idx === i ? { ...s, setlistResults: results.slice(0, 10), searching: false, noResults: results.length === 0 } : s
            ));
          } else {
            setExtractedShows(prev => prev.map((s, idx) =>
              idx === i ? { ...s, searching: false, noResults: true } : s
            ));
          }

          if (i < shows.length - 1) await new Promise(r => setTimeout(r, 400));
        } catch {
          setExtractedShows(prev => prev.map((s, idx) =>
            idx === i ? { ...s, searching: false, noResults: true } : s
          ));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to analyze tickets. Please try again.');
      setAnalyzing(false);
    }
  };

  const importSetlist = (showIdx, setlist) => {
    const songs = [];
    let setIndex = 0;
    if (setlist.sets && setlist.sets.set) {
      setlist.sets.set.forEach(set => {
        if (set.song) {
          set.song.forEach(song => {
            songs.push({
              id: Date.now().toString() + Math.random(),
              name: song.name,
              cover: song.cover ? `${song.cover.name} cover` : null,
              setBreak: setIndex > 0 && set.song.indexOf(song) === 0
                ? (set.encore ? `Encore${setIndex > 1 ? ` ${setIndex}` : ''}` : `Set ${setIndex + 1}`)
                : (setIndex === 0 && set.song.indexOf(song) === 0 ? 'Main Set' : null)
            });
          });
        }
        setIndex++;
      });
    }

    onImport({
      artist: setlist.artist.name,
      venue: setlist.venue.name,
      city: setlist.venue.city.name,
      country: setlist.venue.city.country.name,
      date: setlist.eventDate,
      setlist: songs,
      setlistfmId: setlist.id,
      tour: setlist.tour ? setlist.tour.name : null
    });

    setExtractedShows(prev => prev.map((s, idx) =>
      idx === showIdx ? { ...s, imported: true } : s
    ));
  };

  const importManually = (showIdx) => {
    const show = extractedShows[showIdx];
    onImport({
      artist: show.artist || '',
      venue: show.venue || '',
      city: show.city || '',
      date: show.date || '',
      setlist: [],
    });
    setExtractedShows(prev => prev.map((s, idx) =>
      idx === showIdx ? { ...s, imported: true } : s
    ));
  };

  const isAlreadyImported = (setlistId) => importedIds.has(setlistId);

  const formatSetlistDate = (dateStr) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toLocaleDateString();
    }
    return dateStr;
  };

  const reset = () => {
    setFiles([]);
    setPreviews([]);
    setExtractedShows([]);
    setError('');
    setExpandedSetlist(null);
  };

  return (
    <div>
      {/* Upload Area */}
      {extractedShows.length === 0 && (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6">
          <div className="flex flex-col items-center justify-center py-8">
            <Camera className="w-12 h-12 text-white/20 mb-4" />
            <p className="text-white/60 mb-4 text-center">
              Upload photos of your concert ticket stubs, wristbands, or digital tickets
            </p>
            <label className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white rounded-xl font-medium cursor-pointer transition-all shadow-lg shadow-violet-500/25">
              <Camera className="w-4 h-4" />
              {files.length > 0 ? 'Add More Images' : 'Select Images'}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {/* Image Previews */}
          {previews.length > 0 && (
            <div className="mt-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {previews.map((preview, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={preview.url}
                      alt={preview.name}
                      className="w-full h-32 object-cover rounded-xl border border-white/10"
                    />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white/80 text-xs px-2 py-1 rounded-b-xl truncate">
                      {preview.name}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={analyzeTickets}
                  disabled={analyzing}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing {files.length} ticket{files.length !== 1 ? 's' : ''}...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Analyze {files.length} Ticket{files.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
                <button
                  onClick={reset}
                  disabled={analyzing}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white/70 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {extractedShows.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Found {extractedShows.length} show{extractedShows.length !== 1 ? 's' : ''} from tickets
            </h2>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-xl text-sm font-medium transition-colors"
            >
              <Camera className="w-4 h-4" />
              Scan More
            </button>
          </div>

          {extractedShows.map((show, showIdx) => (
            <div key={showIdx} className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              {/* Extracted show header */}
              <div className="p-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{show.artist || 'Unknown Artist'}</div>
                    <div className="text-sm text-white/60 mt-1">
                      {show.venue || 'Unknown Venue'}
                      {show.city && <span> &middot; {show.city}</span>}
                    </div>
                    {show.date && (
                      <div className="text-sm text-white/40 mt-1">
                        {(() => { try { return new Date(show.date).toLocaleDateString(); } catch { return show.date; } })()}
                      </div>
                    )}
                  </div>
                  {show.imported && (
                    <span className="flex items-center gap-1 text-sm text-emerald-400">
                      <Check className="w-4 h-4" />
                      Imported
                    </span>
                  )}
                </div>
              </div>

              {/* Setlist search results */}
              <div className="p-4">
                {show.searching && (
                  <div className="flex items-center gap-3 text-white/50 text-sm py-4">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Searching setlist.fm for matching shows...
                  </div>
                )}

                {!show.searching && show.noResults && !show.imported && (
                  <div className="text-center py-4">
                    <p className="text-white/40 text-sm mb-3">No setlists found on setlist.fm</p>
                    <button
                      onClick={() => importManually(showIdx)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-all mx-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Add Without Setlist
                    </button>
                  </div>
                )}

                {!show.searching && show.setlistResults.length > 0 && !show.imported && (
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Select matching setlist:</p>
                    {show.setlistResults.map((setlist) => {
                      const songCount = setlist.sets?.set?.reduce((acc, s) => acc + (s.song?.length || 0), 0) || 0;
                      const isExpanded = expandedSetlist === `${showIdx}-${setlist.id}`;
                      const alreadyAdded = isAlreadyImported(setlist.id);

                      return (
                        <div key={setlist.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                          <div className="p-3 hover:bg-white/5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white">{setlist.artist.name}</div>
                                <div className="text-xs text-white/60 mt-0.5">
                                  {setlist.venue.name} &middot; {setlist.venue.city.name}
                                </div>
                                <div className="text-xs text-white/40 mt-0.5">
                                  {formatSetlistDate(setlist.eventDate)}
                                  {setlist.tour && <span className="text-emerald-400 ml-2">{setlist.tour.name}</span>}
                                </div>
                                {songCount > 0 && (
                                  <button
                                    onClick={() => setExpandedSetlist(isExpanded ? null : `${showIdx}-${setlist.id}`)}
                                    className="flex items-center gap-1 text-xs text-white/50 hover:text-white/70 mt-1 transition-colors"
                                  >
                                    <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    {songCount} songs
                                  </button>
                                )}
                              </div>
                              <button
                                onClick={() => !alreadyAdded && importSetlist(showIdx, setlist)}
                                disabled={alreadyAdded}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  alreadyAdded
                                    ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                                    : 'bg-white/10 hover:bg-white/20 text-white'
                                }`}
                              >
                                {alreadyAdded ? <><Check className="w-3 h-3" /> Added</> : <><Download className="w-3 h-3" /> Add</>}
                              </button>
                            </div>
                          </div>

                          {isExpanded && setlist.sets?.set && (
                            <div className="border-t border-white/10 bg-white/5 p-3">
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {setlist.sets.set.map((set, setIdx) => (
                                  <div key={setIdx}>
                                    {set.name && (
                                      <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mt-1 mb-1">{set.name}</div>
                                    )}
                                    {set.encore && !set.name && (
                                      <div className="text-xs font-semibold text-amber-400 uppercase tracking-wide mt-1 mb-1">Encore</div>
                                    )}
                                    {set.song?.map((song, songIdx) => (
                                      <div key={songIdx} className="flex items-center gap-2 py-0.5 text-xs text-white/70">
                                        <span className="text-white/30 w-5 text-right">{songIdx + 1}.</span>
                                        <span>{song.name}</span>
                                        {song.cover && <span className="text-white/40">({song.cover.name} cover)</span>}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TicketScanner;
