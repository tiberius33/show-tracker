'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Check, AlertTriangle, ExternalLink, Music, ChevronDown, Loader2 } from 'lucide-react';
import {
  generateCodeVerifier, generateCodeChallenge, buildSpotifyAuthUrl,
  storeCodeVerifier, getCodeVerifier, storePlaylistContext,
  exchangeCodeForTokens, getAccessToken,
  getSpotifyUser, searchSpotifyTrack, createSpotifyPlaylist, addTracksToPlaylist,
  clearSpotifySession,
} from '@/lib/spotify';
import {
  getPlayableSongs, buildSearchQuery, buildAppleMusicSearchQuery,
  findBestMatch, buildPlaylistName, buildPlaylistDescription, delay,
} from '@/lib/playlistCreator';

// States: select | authenticating | searching | creating | results | error
const SPOTIFY_GREEN = '#1DB954';

function PlaylistCreatorModal({ show, onClose }) {
  const [step, setStep] = useState('select');
  const [platform, setPlatform] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, matches: [] });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [unmatchedOpen, setUnmatchedOpen] = useState(false);
  const callbackListenerRef = useRef(null);

  const songs = getPlayableSongs(show.setlist);
  const playlistName = buildPlaylistName(show);

  // Clean up message listener on unmount
  useEffect(() => {
    return () => {
      if (callbackListenerRef.current) {
        window.removeEventListener('message', callbackListenerRef.current);
      }
    };
  }, []);

  // --- Spotify Flow ---

  const startSpotifyAuth = useCallback(async () => {
    setPlatform('spotify');
    setStep('authenticating');
    setError(null);

    try {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = crypto.randomUUID();

      storeCodeVerifier(codeVerifier);
      storePlaylistContext(show);

      const authUrl = buildSpotifyAuthUrl(codeChallenge, state);

      // Open popup for Spotify auth
      const popup = window.open(authUrl, 'spotify-auth', 'width=500,height=700,scrollbars=yes');

      if (!popup || popup.closed) {
        // Popup blocked — fall back to redirect
        window.location.href = authUrl;
        return;
      }

      // Listen for the callback message from the popup
      const handleMessage = async (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== 'spotify-callback') return;

        window.removeEventListener('message', handleMessage);
        callbackListenerRef.current = null;

        if (event.data.error) {
          setError(event.data.error === 'access_denied'
            ? 'You cancelled the Spotify login.'
            : `Spotify error: ${event.data.error}`);
          setStep('error');
          return;
        }

        if (event.data.code) {
          try {
            const codeVerifier = getCodeVerifier();
            await exchangeCodeForTokens(event.data.code, codeVerifier);
            await createSpotifyPlaylistFlow();
          } catch (err) {
            setError(err.message || 'Failed to connect to Spotify.');
            setStep('error');
          }
        }
      };

      callbackListenerRef.current = handleMessage;
      window.addEventListener('message', handleMessage);
    } catch (err) {
      setError(err.message || 'Failed to start Spotify authentication.');
      setStep('error');
    }
  }, [show]);

  const createSpotifyPlaylistFlow = useCallback(async () => {
    setStep('searching');
    const matches = [];
    const unmatched = [];
    setProgress({ current: 0, total: songs.length, matches: [] });

    try {
      // Get user ID
      const user = await getSpotifyUser();

      // Search for each song
      for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        const query = buildSearchQuery(song, show.artist);

        let searchResult = null;
        let retries = 0;

        while (retries < 3) {
          try {
            searchResult = await searchSpotifyTrack(query);
            if (searchResult.rateLimited) {
              await delay((searchResult.retryAfter || 5) * 1000);
              retries++;
              continue;
            }
            break;
          } catch (err) {
            retries++;
            if (retries >= 3) break;
            await delay(1000);
          }
        }

        const tracks = searchResult?.tracks || [];
        const bestMatch = findBestMatch(song.name, tracks, song.cover || show.artist);

        const matchEntry = {
          songName: song.name,
          matched: !!bestMatch,
          trackUri: bestMatch?.uri || null,
          trackName: bestMatch?.name || null,
          trackArtist: bestMatch?.artist || null,
        };

        if (bestMatch) {
          matches.push(matchEntry);
        } else {
          unmatched.push(matchEntry);
        }

        setProgress({
          current: i + 1,
          total: songs.length,
          matches: [...matches, ...unmatched],
        });

        // Small delay between requests to respect rate limits
        if (i < songs.length - 1) await delay(200);
      }

      // Create the playlist
      setStep('creating');
      const trackUris = matches.map(m => m.trackUri).filter(Boolean);
      const description = buildPlaylistDescription(show);

      const playlist = await createSpotifyPlaylist(user.id, playlistName, description);

      if (!playlist?.id) {
        throw new Error('Failed to create playlist — no playlist ID returned from Spotify.');
      }

      if (trackUris.length > 0) {
        await addTracksToPlaylist(playlist.id, trackUris);
      }

      setResult({
        platform: 'spotify',
        playlistName,
        playlistUrl: playlist.externalUrl,
        matched: matches.length,
        total: songs.length,
        unmatched: unmatched.map(u => u.songName),
      });
      setStep('results');
    } catch (err) {
      setError(err.message || 'Failed to create Spotify playlist.');
      setStep('error');
    }
  }, [show, songs, playlistName]);

  // --- Apple Music Flow ---

  const startAppleMusicAuth = useCallback(async () => {
    setPlatform('apple');
    setStep('authenticating');
    setError(null);

    try {
      // Dynamically import Apple Music helpers
      const appleMusic = await import('@/lib/appleMusic');
      await appleMusic.loadMusicKit();

      // Get developer token from server
      const tokenRes = await fetch('/.netlify/functions/apple-music-token');
      if (!tokenRes.ok) throw new Error('Failed to get Apple Music developer token');
      const { token: developerToken } = await tokenRes.json();

      // Initialize and authorize
      const music = await appleMusic.initMusicKit(developerToken);

      // Search and create playlist
      setStep('searching');
      const matches = [];
      const unmatched = [];
      setProgress({ current: 0, total: songs.length, matches: [] });

      for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        const query = buildAppleMusicSearchQuery(song, show.artist);

        try {
          const tracks = await appleMusic.searchTrack(music, query);
          const bestMatch = findBestMatch(song.name, tracks, song.cover || show.artist);

          const matchEntry = {
            songName: song.name,
            matched: !!bestMatch,
            trackId: bestMatch?.id || null,
            trackName: bestMatch?.name || null,
            trackArtist: bestMatch?.artist || null,
          };

          if (bestMatch) {
            matches.push(matchEntry);
          } else {
            unmatched.push(matchEntry);
          }
        } catch {
          unmatched.push({ songName: song.name, matched: false });
        }

        setProgress({
          current: i + 1,
          total: songs.length,
          matches: [...matches, ...unmatched],
        });

        if (i < songs.length - 1) await delay(300);
      }

      // Create playlist
      setStep('creating');
      const trackIds = matches.map(m => m.trackId).filter(Boolean);
      const description = buildPlaylistDescription(show);

      const playlistResult = await appleMusic.createPlaylist(music, playlistName, description, trackIds);

      setResult({
        platform: 'apple',
        playlistName,
        playlistUrl: null, // Apple Music doesn't return a web URL easily
        matched: matches.length,
        total: songs.length,
        unmatched: unmatched.map(u => u.songName),
      });
      setStep('results');
    } catch (err) {
      const msg = err.message || 'Failed to connect to Apple Music.';
      setError(msg.includes('cancelled') || msg.includes('denied')
        ? 'You cancelled the Apple Music login.'
        : msg);
      setStep('error');
    }
  }, [show, songs, playlistName]);

  // --- Retry ---

  const handleRetry = () => {
    setError(null);
    setResult(null);
    setProgress({ current: 0, total: 0, matches: [] });
    setStep('select');
    clearSpotifySession();
  };

  // --- Render ---

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Create Playlist</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {/* Platform Select */}
          {step === 'select' && (
            <>
              {/* Show info */}
              <div className="bg-white/5 rounded-xl p-4 mb-5">
                <div className="text-sm font-semibold text-white">{show.artist}</div>
                <div className="text-xs text-white/50 mt-1">
                  {show.venue}{show.city ? `, ${show.city}` : ''} &middot; {songs.length} songs
                </div>
              </div>

              {/* Platform buttons */}
              <div className="space-y-3">
                <button
                  onClick={startSpotifyAuth}
                  disabled={!process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-[#1DB954]/10 hover:border-[#1DB954]/30 transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${SPOTIFY_GREEN}20` }}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill={SPOTIFY_GREEN}>
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-semibold text-white group-hover:text-[#1DB954] transition-colors">Spotify</div>
                    <div className="text-xs text-white/40">Create playlist on Spotify</div>
                  </div>
                </button>

                <button
                  onClick={startAppleMusicAuth}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
                    <Music className="w-5 h-5 text-rose-400" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-semibold text-white group-hover:text-rose-400 transition-colors">Apple Music</div>
                    <div className="text-xs text-white/40">Add to your Apple Music library</div>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Authenticating */}
          {step === 'authenticating' && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: platform === 'spotify' ? `${SPOTIFY_GREEN}20` : 'rgba(244,63,94,0.15)' }}>
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: platform === 'spotify' ? SPOTIFY_GREEN : '#fb7185' }} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Connecting to {platform === 'spotify' ? 'Spotify' : 'Apple Music'}...
              </h3>
              <p className="text-xs text-white/40">Complete the login in the popup window</p>
            </div>
          )}

          {/* Searching / Matching Songs */}
          {step === 'searching' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Matching songs...</h3>
                <span className="text-xs text-white/50">{progress.current} of {progress.total}</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                    backgroundColor: platform === 'spotify' ? SPOTIFY_GREEN : '#fb7185',
                  }}
                />
              </div>

              {/* Live match list */}
              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {progress.matches.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {m.matched ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    )}
                    <span className={m.matched ? 'text-white/70' : 'text-white/40'}>
                      {m.songName}
                    </span>
                    {m.matched && m.trackArtist && (
                      <span className="text-white/30 ml-auto truncate max-w-[120px]">
                        {m.trackArtist}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Creating playlist */}
          {step === 'creating' && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: platform === 'spotify' ? SPOTIFY_GREEN : '#fb7185' }} />
              <h3 className="text-sm font-semibold text-white">Creating playlist...</h3>
            </div>
          )}

          {/* Results */}
          {step === 'results' && result && (
            <div>
              {/* Success banner */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-4 text-center">
                <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white mb-1">
                  Added {result.matched} of {result.total} songs
                </h3>
                <p className="text-xs text-white/50">{result.playlistName}</p>
              </div>

              {/* Open in Spotify/Apple Music */}
              {result.playlistUrl && (
                <a
                  href={result.playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm text-white transition-colors mb-3"
                  style={{
                    backgroundColor: platform === 'spotify' ? SPOTIFY_GREEN : '#fb7185',
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in {platform === 'spotify' ? 'Spotify' : 'Apple Music'}
                </a>
              )}

              {!result.playlistUrl && result.platform === 'apple' && (
                <div className="text-center text-xs text-white/40 mb-3">
                  Open Apple Music to find your new playlist in your library.
                </div>
              )}

              {/* Unmatched songs */}
              {result.unmatched.length > 0 && (
                <div className="bg-white/5 rounded-xl border border-white/10">
                  <button
                    onClick={() => setUnmatchedOpen(!unmatchedOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-amber-400"
                  >
                    <span>{result.unmatched.length} song{result.unmatched.length !== 1 ? 's' : ''} not found</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${unmatchedOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {unmatchedOpen && (
                    <div className="px-4 pb-3 space-y-1">
                      {result.unmatched.map((name, i) => (
                        <div key={i} className="text-xs text-white/40 flex items-center gap-2">
                          <AlertTriangle className="w-3 h-3 text-amber-400/50 flex-shrink-0" />
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Done button */}
              <button
                onClick={onClose}
                className="w-full mt-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="text-center py-6">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white mb-2">Something went wrong</h3>
              <p className="text-xs text-white/50 mb-5">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlaylistCreatorModal;
