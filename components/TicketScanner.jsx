'use client';

import React, { useState } from 'react';
import { Camera, X, RefreshCw, Search, Check, Download, Plus, ChevronDown } from 'lucide-react';
import { resizeImageForUpload } from '@/lib/utils';
import { apiUrl } from '@/lib/api';
import { isNativePlatform } from '@/lib/native-auth';

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

  // Native camera: use @capacitor/camera for a better experience on iOS
  const handleNativeCamera = async () => {
    try {
      const { Camera: CapCamera, CameraResultType, CameraSource } = await import('@capacitor/camera');

      // Explicitly request permissions first — on some iOS versions getPhoto()
      // silently fails without this step, and the permission prompt never appears
      const perms = await CapCamera.requestPermissions({ permissions: ['camera', 'photos'] });
      if (perms.camera === 'denied') {
        setError('Camera access denied. Go to Settings → MySetlists → Camera to enable it.');
        return;
      }

      const photo = await CapCamera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        correctOrientation: true,
        width: 1600,
        height: 1600,
        presentationStyle: 'fullScreen',
      });

      // Read the photo from its URI and convert to a File for the analysis flow
      const photoUrl = photo.webPath || photo.dataUrl;
      if (photoUrl) {
        const res = await fetch(photoUrl);
        const blob = await res.blob();
        const file = new File([blob], `ticket-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
        setFiles(prev => [...prev, file]);
        const previewUrl = URL.createObjectURL(blob);
        setPreviews(prev => [...prev, { name: file.name, url: previewUrl }]);
        setError('');
      }
    } catch (err) {
      // Ignore user cancellation
      const msg = err?.message || '';
      if (msg.includes('cancel') || msg.includes('User cancelled') || msg.includes('dismissed')) {
        return;
      }
      console.error('Camera error:', err);
      setError(`Camera error: ${msg || 'Unknown error'}. Please try again.`);
    }
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

      const response = await fetch(apiUrl('/.netlify/functions/analyze-tickets'), {
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
          const artistRes = await fetch(apiUrl(`/.netlify/functions/search-artists?${artistParams.toString()}`));
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

          const setlistRes = await fetch(apiUrl(`/.netlify/functions/search-setlists?${params.toString()}`));

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
        <div className="bg-hover backdrop-blur-xl rounded-2xl border border-subtle p-6 mb-6">
          <div className="flex flex-col items-center justify-center py-8">
            <Camera className="w-12 h-12 text-muted mb-4" />
            <p className="text-secondary mb-4 text-center">
              Upload photos of your concert ticket stubs or digital tickets
            </p>
            {isNativePlatform() ? (
              <button
                onClick={handleNativeCamera}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber to-amber hover:from-amber hover:to-amber text-primary rounded-xl font-medium cursor-pointer transition-all shadow-lg shadow-amber/20"
              >
                <Camera className="w-4 h-4" />
                {files.length > 0 ? 'Add More Photos' : 'Take Photo or Choose'}
              </button>
            ) : (
              <label className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber to-amber hover:from-amber hover:to-amber text-primary rounded-xl font-medium cursor-pointer transition-all shadow-lg shadow-amber/20">
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
            )}
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
                      className="w-full h-32 object-cover rounded-xl border border-subtle"
                    />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 bg-sidebar/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-primary" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-sidebar/50 text-secondary text-xs px-2 py-1 rounded-b-xl truncate">
                      {preview.name}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={analyzeTickets}
                  disabled={analyzing}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-brand/20"
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
                  className="px-4 py-3 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors disabled:opacity-50"
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
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {extractedShows.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">
              Found {extractedShows.length} show{extractedShows.length !== 1 ? 's' : ''} from tickets
            </h2>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-3 py-2 bg-hover hover:bg-hover text-secondary rounded-xl text-sm font-medium transition-colors"
            >
              <Camera className="w-4 h-4" />
              Scan More
            </button>
          </div>

          {extractedShows.map((show, showIdx) => (
            <div key={showIdx} className="bg-hover backdrop-blur-xl rounded-2xl border border-subtle overflow-hidden">
              {/* Extracted show header */}
              <div className="p-4 border-b border-subtle bg-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-primary">{show.artist || 'Unknown Artist'}</div>
                    <div className="text-sm text-secondary mt-1">
                      {show.venue || 'Unknown Venue'}
                      {show.city && <span> &middot; {show.city}</span>}
                    </div>
                    {show.date && (
                      <div className="text-sm text-muted mt-1">
                        {(() => { try { return new Date(show.date).toLocaleDateString(); } catch { return show.date; } })()}
                      </div>
                    )}
                  </div>
                  {show.imported && (
                    <span className="flex items-center gap-1 text-sm text-brand">
                      <Check className="w-4 h-4" />
                      Imported
                    </span>
                  )}
                </div>
              </div>

              {/* Setlist search results */}
              <div className="p-4">
                {show.searching && (
                  <div className="flex items-center gap-3 text-secondary text-sm py-4">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Searching setlist.fm for matching shows...
                  </div>
                )}

                {!show.searching && show.noResults && !show.imported && (
                  <div className="text-center py-4">
                    <p className="text-muted text-sm mb-3">No setlists found on setlist.fm</p>
                    <button
                      onClick={() => importManually(showIdx)}
                      className="flex items-center gap-2 px-4 py-2 bg-hover hover:bg-hover text-primary rounded-xl text-sm font-medium transition-all mx-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Add Without Setlist
                    </button>
                  </div>
                )}

                {!show.searching && show.setlistResults.length > 0 && !show.imported && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted uppercase tracking-wide mb-2">Select matching setlist:</p>
                    {show.setlistResults.map((setlist) => {
                      const songCount = setlist.sets?.set?.reduce((acc, s) => acc + (s.song?.length || 0), 0) || 0;
                      const isExpanded = expandedSetlist === `${showIdx}-${setlist.id}`;
                      const alreadyAdded = isAlreadyImported(setlist.id);

                      return (
                        <div key={setlist.id} className="bg-hover border border-subtle rounded-xl overflow-hidden">
                          <div className="p-3 hover:bg-hover">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-primary">{setlist.artist.name}</div>
                                <div className="text-xs text-secondary mt-0.5">
                                  {setlist.venue.name} &middot; {setlist.venue.city.name}
                                </div>
                                <div className="text-xs text-muted mt-0.5">
                                  {formatSetlistDate(setlist.eventDate)}
                                  {setlist.tour && <span className="text-brand ml-2">{setlist.tour.name}</span>}
                                </div>
                                {songCount > 0 && (
                                  <button
                                    onClick={() => setExpandedSetlist(isExpanded ? null : `${showIdx}-${setlist.id}`)}
                                    className="flex items-center gap-1 text-xs text-secondary hover:text-primary mt-1 transition-colors"
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
                                    ? 'bg-brand-subtle text-brand cursor-default'
                                    : 'bg-hover hover:bg-hover text-primary'
                                }`}
                              >
                                {alreadyAdded ? <><Check className="w-3 h-3" /> Added</> : <><Download className="w-3 h-3" /> Add</>}
                              </button>
                            </div>
                          </div>

                          {isExpanded && setlist.sets?.set && (
                            <div className="border-t border-subtle bg-hover p-3">
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {setlist.sets.set.map((set, setIdx) => (
                                  <div key={setIdx}>
                                    {set.name && (
                                      <div className="text-xs font-semibold text-brand uppercase tracking-wide mt-1 mb-1">{set.name}</div>
                                    )}
                                    {set.encore && !set.name && (
                                      <div className="text-xs font-semibold text-brand uppercase tracking-wide mt-1 mb-1">Encore</div>
                                    )}
                                    {set.song?.map((song, songIdx) => (
                                      <div key={songIdx} className="flex items-center gap-2 py-0.5 text-xs text-secondary">
                                        <span className="text-muted w-5 text-right">{songIdx + 1}.</span>
                                        <span>{song.name}</span>
                                        {song.cover && <span className="text-muted">({song.cover.name} cover)</span>}
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
