/**
 * Apple Music MusicKit JS helpers.
 * Lazy-loads MusicKit JS only when needed.
 */

let musicKitLoaded = false;

/**
 * Dynamically load the MusicKit JS library.
 * Waits for the 'musickitloaded' event which fires when MusicKit is ready.
 */
export function loadMusicKit() {
  if (musicKitLoaded) return Promise.resolve();
  if (typeof window === 'undefined') return Promise.reject(new Error('MusicKit requires a browser'));

  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.MusicKit) {
      musicKitLoaded = true;
      resolve();
      return;
    }

    // MusicKit JS fires 'musickitloaded' on document when ready
    const onReady = () => {
      document.removeEventListener('musickitloaded', onReady);
      musicKitLoaded = true;
      resolve();
    };
    document.addEventListener('musickitloaded', onReady);

    const script = document.createElement('script');
    script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      document.removeEventListener('musickitloaded', onReady);
      reject(new Error('Failed to load MusicKit JS'));
    };

    document.head.appendChild(script);

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!musicKitLoaded) {
        document.removeEventListener('musickitloaded', onReady);
        // Check one more time if MusicKit loaded without the event
        if (window.MusicKit) {
          musicKitLoaded = true;
          resolve();
        } else {
          reject(new Error('MusicKit JS timed out loading'));
        }
      }
    }, 15000);
  });
}

/**
 * Initialize MusicKit with a developer token and authorize the user.
 * Returns the MusicKit instance.
 */
export async function initMusicKit(developerToken) {
  if (!window.MusicKit) {
    throw new Error('MusicKit JS is not loaded');
  }

  const music = await window.MusicKit.configure({
    developerToken,
    app: {
      name: 'MySetlists',
      build: '2.2.1',
    },
  });

  // Use the returned instance or get it
  const instance = music || window.MusicKit.getInstance();

  // Authorize (prompts Apple ID login popup)
  try {
    await instance.authorize();
  } catch (err) {
    throw new Error('Apple Music authorization cancelled or failed');
  }

  return instance;
}

/**
 * Search Apple Music catalog for a track.
 * Returns an array of track objects matching the format expected by findBestMatch.
 */
export async function searchTrack(music, query) {
  try {
    const result = await music.api.music(`/v1/catalog/us/search`, {
      term: query,
      types: 'songs',
      limit: 5,
    });

    const songs = result?.data?.results?.songs?.data || [];

    return songs.map(song => ({
      id: song.id,
      name: song.attributes?.name || '',
      artist: song.attributes?.artistName || '',
      album: song.attributes?.albumName || '',
      uri: song.id, // Use ID as the identifier
    }));
  } catch (err) {
    console.error('Apple Music search error:', err);
    return [];
  }
}

/**
 * Configure MusicKit for catalog-only access (search, artist songs) without
 * prompting the user to sign in — `authorize()` is only required for
 * user-library endpoints like creating playlists, not for public catalog reads.
 */
export async function configureMusicKitCatalog(developerToken) {
  if (!window.MusicKit) {
    throw new Error('MusicKit JS is not loaded');
  }
  const music = await window.MusicKit.configure({
    developerToken,
    app: {
      name: 'MySetlists',
      build: '2.2.1',
    },
  });
  return music || window.MusicKit.getInstance();
}

/**
 * Search the Apple Music catalog for artists matching a name.
 * Returns an array of { id, name } candidates, best matches first.
 */
export async function searchCatalogArtists(music, name) {
  try {
    const result = await music.api.music('/v1/catalog/us/search', {
      term: name,
      types: 'artists',
      limit: 10,
    });
    const artists = result?.data?.results?.artists?.data || [];
    return artists.map(a => ({ id: a.id, name: a.attributes?.name || '' }));
  } catch (err) {
    console.error('Apple Music artist search error:', err);
    return [];
  }
}

/**
 * Fetch every song in an Apple Music artist's catalog, paginating through
 * the artist->songs relationship. Capped to keep large catalogs bounded.
 */
export async function getArtistCatalogSongs(music, artistId, { maxSongs = 500 } = {}) {
  const songs = [];
  let offset = 0;
  const limit = 100;

  while (songs.length < maxSongs) {
    let page;
    try {
      page = await music.api.music(`/v1/catalog/us/artists/${artistId}/songs`, {
        limit,
        offset,
      });
    } catch (err) {
      // Apple returns 204/empty once the relationship is exhausted
      break;
    }

    const items = page?.data?.data || [];
    if (items.length === 0) break;

    items.forEach(song => {
      songs.push({
        id: song.id,
        name: song.attributes?.name || '',
        album: song.attributes?.albumName || '',
      });
    });

    if (items.length < limit) break;
    offset += limit;
  }

  return songs.slice(0, maxSongs);
}

/**
 * Create a playlist in the user's Apple Music library and add tracks.
 */
export async function createPlaylist(music, name, description, trackIds) {
  try {
    // Build the track relationships
    const trackData = trackIds.map(id => ({
      id,
      type: 'songs',
    }));

    const response = await music.api.music('/v1/me/library/playlists', {}, {
      fetchOptions: {
        method: 'POST',
        body: JSON.stringify({
          attributes: {
            name,
            description,
          },
          relationships: {
            tracks: {
              data: trackData,
            },
          },
        }),
      },
    });

    const playlist = response?.data?.data?.[0];
    return {
      id: playlist?.id || null,
      name: playlist?.attributes?.name || name,
    };
  } catch (err) {
    console.error('Apple Music create playlist error:', err);
    throw new Error('Failed to create Apple Music playlist');
  }
}
