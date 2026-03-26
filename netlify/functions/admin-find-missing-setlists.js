/**
 * admin-find-missing-setlists — Admin-only endpoint that scans users for shows
 * missing setlists, cross-references with other users who have the same show
 * (from setlist.fm), and optionally auto-populates them.
 *
 * POST body:
 *   {
 *     userId?: string,         // scan a single user (omit to scan all)
 *     autoPopulate?: boolean,  // auto-populate matches (default false)
 *     limit?: number,          // max users to scan (default 50)
 *     offset?: number,         // pagination offset (default 0)
 *   }
 *
 * Auth: Authorization: Bearer {idToken} — admin only
 *
 * Response:
 *   {
 *     success: boolean,
 *     usersScanned: number,
 *     totalShowsScanned: number,
 *     showsMissingSetlists: number,
 *     matchesFoundFromOtherUsers: number,
 *     matchesFoundFromSetlistFm: number,
 *     populatedCount: number,
 *     results: Array<{
 *       userId: string,
 *       userEmail: string,
 *       showId: string,
 *       artist: string,
 *       venue: string,
 *       date: string,
 *       matchSource: 'other_user' | 'setlist_fm' | 'none',
 *       matchSetlistfmId?: string,
 *       songCount?: number,
 *       populated: boolean,
 *       error?: string,
 *     }>,
 *     errors: string[],
 *   }
 */

const https = require('https');

const ADMIN_EMAILS = ['phillip.leonard@gmail.com'];
const SETLISTFM_API_KEY = process.env.SETLISTFM_API_KEY || 'VmDr8STg4UbyNE7Jgiubx2D_ojbliDuoYMgQ';
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Firebase init ───────────────────────────────────────────────────

function initFirebase() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (getApps().length > 0) return;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!json || !projectId) throw new Error('Firebase env vars not configured');
  initializeApp({ credential: cert(JSON.parse(json)), projectId });
}

async function verifyAdmin(token) {
  initFirebase();
  const { getAuth } = require('firebase-admin/auth');
  const decoded = await getAuth().verifyIdToken(token);
  if (!ADMIN_EMAILS.includes(decoded.email)) throw new Error('Forbidden');
  return decoded;
}

// ── Setlist.fm API ──────────────────────────────────────────────────

function fetchFromSetlistFm(params) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.setlist.fm',
      path: `/rest/1.0/search/setlists?${params.toString()}`,
      method: 'GET',
      headers: {
        'x-api-key': SETLISTFM_API_KEY,
        Accept: 'application/json',
        'User-Agent': 'MySetlists/3.8',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// Search setlist.fm for a show by artist + date, with fallback strategies
async function searchSetlistFm(artist, date) {
  if (!artist || !date) return null;
  const year = date.split('-')[0];

  const searchVariants = [artist];
  if (artist.includes('&')) searchVariants.push(artist.replace(/&/g, 'and'));
  if (artist.toLowerCase().startsWith('the ')) searchVariants.push(artist.substring(4));
  else searchVariants.push('The ' + artist);

  for (const searchArtist of searchVariants) {
    for (let page = 1; page <= 2; page++) {
      try {
        const params = new URLSearchParams({ artistName: searchArtist, year, p: String(page) });
        const { statusCode, data } = await fetchFromSetlistFm(params);

        if (statusCode === 429) {
          // Rate limited — wait and retry once
          await new Promise((r) => setTimeout(r, 2000));
          const retry = await fetchFromSetlistFm(params);
          if (retry.statusCode !== 200 || !retry.data.setlist) continue;
          const retryMatch = findDateMatch(retry.data.setlist, date);
          if (retryMatch) return retryMatch;
          continue;
        }

        if (statusCode !== 200 || !data.setlist || data.setlist.length === 0) break;

        const match = findDateMatch(data.setlist, date);
        if (match) return match;
        if (data.setlist.length < 20) break;
      } catch (err) {
        console.warn(`[SETLIST.FM] Error searching "${searchArtist}":`, err.message);
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    // Wait between artist variants to respect rate limits
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

function findDateMatch(setlists, targetDate) {
  return setlists.find((s) => {
    if (!s.eventDate) return false;
    const parts = s.eventDate.split('-');
    if (parts.length !== 3) return false;
    const formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
    return formatted === targetDate;
  }) || null;
}

// ── Extract songs from setlist.fm match ─────────────────────────────

function extractSongs(match) {
  const songs = [];
  let setIndex = 0;
  if (match.sets && match.sets.set) {
    match.sets.set.forEach((set) => {
      if (set.song) {
        set.song.forEach((song, songIdx) => {
          songs.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            name: song.name.trim(),
            cover: song.cover ? `${song.cover.name} cover` : null,
            setBreak:
              setIndex > 0 && songIdx === 0
                ? set.encore
                  ? `Encore${setIndex > 1 ? ` ${setIndex}` : ''}`
                  : `Set ${setIndex + 1}`
                : setIndex === 0 && songIdx === 0
                  ? 'Main Set'
                  : null,
          });
        });
      }
      setIndex++;
    });
  }
  return songs;
}

// ── Build a normalized key for a show (for cross-referencing) ───────

function showKey(artist, date) {
  return `${(artist || '').toLowerCase().trim()}|${(date || '').trim()}`;
}

// ── Handler ─────────────────────────────────────────────────────────

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = (event.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    await verifyAdmin(token);
  } catch {
    return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const { getFirestore } = require('firebase-admin/firestore');
  const db = getFirestore();

  const body = JSON.parse(event.body || '{}');
  const { userId, autoPopulate = false, limit = 50, offset = 0 } = body;

  try {
    // ─── Phase 1: Build a lookup of all shows WITH setlists ──────────
    // This lets us cross-reference: if User A has Artist+Date with setlist,
    // and User B has the same Artist+Date WITHOUT setlist, we can copy it.
    console.log('[SCAN] Phase 1: Building setlist lookup from all users...');

    const setlistLookup = {}; // key → { songs, setlistfmId, tour, donorUserId }
    const usersSnap = await db.collection('userProfiles').get();
    const allUserDocs = usersSnap.docs;

    for (const userDoc of allUserDocs) {
      const uid = userDoc.id;
      const showsSnap = await db.collection('users').doc(uid).collection('shows').get();
      for (const showDoc of showsSnap.docs) {
        const show = showDoc.data();
        if (show.setlist && show.setlist.length > 0) {
          const key = showKey(show.artist, show.date);
          if (!setlistLookup[key]) {
            setlistLookup[key] = {
              songs: show.setlist,
              setlistfmId: show.setlistfmId || null,
              tour: show.tour || null,
              donorUserId: uid,
            };
          }
        }
      }
    }

    console.log(`[SCAN] Phase 1 complete: ${Object.keys(setlistLookup).length} unique shows with setlists in lookup`);

    // ─── Phase 2: Find shows missing setlists ────────────────────────
    console.log('[SCAN] Phase 2: Finding shows missing setlists...');

    let targetUsers;
    if (userId) {
      const userDoc = allUserDocs.find((d) => d.id === userId);
      targetUsers = userDoc ? [userDoc] : [];
    } else {
      targetUsers = allUserDocs.slice(offset, offset + limit);
    }

    let usersScanned = 0;
    let totalShowsScanned = 0;
    let showsMissingSetlists = 0;
    let matchesFoundFromOtherUsers = 0;
    let matchesFoundFromSetlistFm = 0;
    let populatedCount = 0;
    const results = [];
    const errors = [];
    let setlistFmCallCount = 0;

    for (const userDoc of targetUsers) {
      const uid = userDoc.id;
      const userEmail = userDoc.data().email || 'unknown';
      const displayName = userDoc.data().displayName || userEmail;
      usersScanned++;

      const showsSnap = await db.collection('users').doc(uid).collection('shows').get();
      if (showsSnap.empty) continue;

      for (const showDoc of showsSnap.docs) {
        const show = { id: showDoc.id, ...showDoc.data() };
        totalShowsScanned++;

        // Skip shows that already have setlists
        if (show.setlist && show.setlist.length > 0) continue;
        showsMissingSetlists++;

        const key = showKey(show.artist, show.date);
        let matchSource = 'none';
        let matchData = null;

        // Strategy 1: Check if another user has this show with a setlist
        if (setlistLookup[key]) {
          matchSource = 'other_user';
          matchData = setlistLookup[key];
          matchesFoundFromOtherUsers++;
        }

        // Strategy 2: Search setlist.fm (only if no cross-reference found)
        if (!matchData && setlistFmCallCount < 100) {
          try {
            const sfmMatch = await searchSetlistFm(show.artist, show.date);
            setlistFmCallCount++;
            if (sfmMatch) {
              const songs = extractSongs(sfmMatch);
              if (songs.length > 0) {
                matchSource = 'setlist_fm';
                matchData = {
                  songs,
                  setlistfmId: sfmMatch.id,
                  tour: sfmMatch.tour ? sfmMatch.tour.name : null,
                };
                matchesFoundFromSetlistFm++;

                // Also add to lookup for future cross-references
                setlistLookup[key] = { ...matchData, donorUserId: 'setlist.fm' };
              }
            }
          } catch (err) {
            errors.push(`Setlist.fm error for ${show.artist} (${show.date}): ${err.message}`);
          }
        }

        const result = {
          userId: uid,
          userEmail: displayName,
          showId: show.id,
          artist: show.artist || 'Unknown',
          venue: show.venue || 'Unknown',
          date: show.date || 'Unknown',
          matchSource,
          matchSetlistfmId: matchData?.setlistfmId || null,
          songCount: matchData?.songs?.length || 0,
          tour: matchData?.tour || null,
          populated: false,
          error: null,
        };

        // Auto-populate if requested and we have a match
        if (autoPopulate && matchData && matchData.songs.length > 0) {
          try {
            const updates = {
              setlist: matchData.songs,
              isManual: false,
              populatedAt: new Date().toISOString(),
              populatedFrom: matchSource === 'other_user' ? 'admin-cross-reference' : 'admin-setlist-fm',
            };
            if (matchData.setlistfmId) updates.setlistfmId = matchData.setlistfmId;
            if (matchData.tour) updates.tour = matchData.tour;

            await db.collection('users').doc(uid).collection('shows').doc(show.id).update(updates);
            result.populated = true;
            populatedCount++;
          } catch (err) {
            result.error = `Failed to populate: ${err.message}`;
            errors.push(`Populate error for ${uid}/${show.id}: ${err.message}`);
          }
        }

        results.push(result);
      }
    }

    console.log(`[SCAN] Complete: ${usersScanned} users, ${showsMissingSetlists} missing, ${matchesFoundFromOtherUsers} cross-ref, ${matchesFoundFromSetlistFm} from SFM, ${populatedCount} populated`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        usersScanned,
        totalUsersInSystem: allUserDocs.length,
        totalShowsScanned,
        showsMissingSetlists,
        matchesFoundFromOtherUsers,
        matchesFoundFromSetlistFm,
        populatedCount,
        setlistFmCallsUsed: setlistFmCallCount,
        results,
        errors,
      }),
    };
  } catch (err) {
    console.error('[SCAN] Fatal error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
