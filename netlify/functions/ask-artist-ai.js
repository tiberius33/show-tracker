const https = require('https');

const SETLISTFM_API_KEY = process.env.SETLISTFM_API_KEY || 'VmDr8STg4UbyNE7Jgiubx2D_ojbliDuoYMgQ';

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function makeAnthropicRequest(apiKey, requestBody) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(requestBody);
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error('Failed to parse Anthropic response'));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function fetchSetlistFm(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.setlist.fm',
      path,
      method: 'GET',
      headers: {
        'x-api-key': SETLISTFM_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'ShowTrackerApp/1.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(new Error('Failed to parse setlist.fm response'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Setlist.fm helpers
// ---------------------------------------------------------------------------

function parseSetlistSongs(setlist) {
  const songs = [];
  for (const set of (setlist.sets?.set || [])) {
    for (const song of (set.song || [])) {
      if (song.name) songs.push(song.name);
    }
  }
  return songs;
}

async function fetchArtistSetlists(mbid, artistName, pages = 5) {
  const identifier = mbid
    ? `artistMbid=${encodeURIComponent(mbid)}`
    : `artistName=${encodeURIComponent(artistName)}`;

  const allSetlists = [];
  for (let page = 1; page <= pages; page++) {
    try {
      const { statusCode, data } = await fetchSetlistFm(
        `/rest/1.0/search/setlists?${identifier}&p=${page}`
      );
      if (statusCode !== 200 || !data.setlist) break;
      allSetlists.push(...data.setlist);
      // Stop early if we've fetched everything
      const total = data.total || 0;
      if (allSetlists.length >= total) break;
      // Respect rate limit (2 req/sec)
      if (page < pages) await new Promise(r => setTimeout(r, 550));
    } catch {
      break;
    }
  }
  return allSetlists;
}

function calculateSongFrequencies(setlists) {
  const counts = {};
  const lastPlayed = {};
  const venues = {};

  for (const sl of setlists) {
    const date = sl.eventDate || '';
    const venueName = sl.venue?.name || '';
    const songs = parseSetlistSongs(sl);
    for (const song of songs) {
      counts[song] = (counts[song] || 0) + 1;
      if (!lastPlayed[song] || date > lastPlayed[song]) lastPlayed[song] = date;
      if (!venues[song]) venues[song] = {};
      venues[song][venueName] = (venues[song][venueName] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([song, count]) => ({
      song,
      count,
      lastPlayed: lastPlayed[song] || null,
      topVenue: Object.entries(venues[song] || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    }));
}

function searchSongInSetlists(setlists, songName) {
  const lower = songName.toLowerCase();
  const results = [];
  for (const sl of setlists) {
    const songs = parseSetlistSongs(sl);
    const match = songs.find(s => s.toLowerCase().includes(lower));
    if (match) {
      results.push({
        date: sl.eventDate || '',
        venue: sl.venue?.name || '',
        city: sl.venue?.city?.name || '',
        country: sl.venue?.city?.country?.name || '',
        tourName: sl.tour?.name || null,
        songName: match
      });
    }
  }
  return results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function filterSetlistsByVenue(setlists, venueName) {
  const lower = venueName.toLowerCase();
  return setlists.filter(sl =>
    (sl.venue?.name || '').toLowerCase().includes(lower) ||
    (sl.venue?.city?.name || '').toLowerCase().includes(lower)
  );
}

// ---------------------------------------------------------------------------
// User history helpers (existing functionality)
// ---------------------------------------------------------------------------

function buildShowHistoryContext(userShows, artistName) {
  if (!userShows || userShows.length === 0) {
    return `The user has not seen ${artistName} live yet.`;
  }
  const sorted = [...userShows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const lines = [`The user has seen ${artistName} ${userShows.length} time(s) live:`];
  for (const show of sorted) {
    const venue = show.venue || 'Unknown venue';
    const city = show.city ? `, ${show.city}` : '';
    lines.push(`- ${show.date || 'Unknown date'}: ${venue}${city}`);
    if (show.setlist && show.setlist.length > 0) {
      const songs = show.setlist.map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean);
      if (songs.length > 0) lines.push(`  Setlist: ${songs.join(', ')}`);
    }
  }
  const songCounts = {};
  for (const show of userShows) {
    for (const song of (show.setlist || [])) {
      const name = typeof song === 'string' ? song : song.name;
      if (name) songCounts[name] = (songCounts[name] || 0) + 1;
    }
  }
  const topSongs = Object.entries(songCounts).sort((a, b) => b[1] - a[1]).slice(0, 25);
  if (topSongs.length > 0) {
    lines.push(`\nSongs the user has personally seen performed (with frequency):`);
    for (const [name, count] of topSongs) lines.push(`- "${name}": ${count} time(s)`);
  }
  return lines.join('\n');
}

function checkUserHistory(userShows, songName) {
  if (!userShows || userShows.length === 0) {
    return { seen: false, times: 0, message: 'User has no show history for this artist.' };
  }
  const lower = songName.toLowerCase();
  const occurrences = [];
  for (const show of userShows) {
    for (const song of (show.setlist || [])) {
      const name = typeof song === 'string' ? song : song.name;
      if (name && name.toLowerCase().includes(lower)) {
        occurrences.push({ date: show.date, venue: show.venue, city: show.city || '', songName: name });
      }
    }
  }
  if (occurrences.length === 0) {
    return { seen: false, times: 0, message: `No record of "${songName}" in the user's show history.` };
  }
  return { seen: true, times: occurrences.length, occurrences: occurrences.sort((a, b) => (b.date || '').localeCompare(a.date || '')) };
}

function getUserTopSongs(userShows) {
  if (!userShows || userShows.length === 0) return { songs: [], totalShows: 0 };
  const songCounts = {};
  for (const show of userShows) {
    for (const song of (show.setlist || [])) {
      const name = typeof song === 'string' ? song : song.name;
      if (name) songCounts[name] = (songCounts[name] || 0) + 1;
    }
  }
  const songs = Object.entries(songCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));
  return { songs, totalShows: userShows.length };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'get_recent_setlists',
    description: "Fetch the artist's recent shows from setlist.fm. Returns setlists with dates, venues, and songs. Use this to answer questions about most-played songs, tour history, venue history, or any question requiring real setlist data. Fetches up to ~100 shows (5 pages).",
    input_schema: {
      type: 'object',
      properties: {
        page_count: {
          type: 'number',
          description: 'Number of pages to fetch (each page ~20 shows). Default 5, max 8. Use more pages for "all-time" questions.'
        }
      },
      required: []
    }
  },
  {
    name: 'search_song_history',
    description: "Search for all performances of a specific song across the artist's recent setlists. Use this for 'when did they last play X', 'how many times have they played X', or 'where do they play X most'. Requires get_recent_setlists to have been called first — pass the setlists count to confirm data is loaded.",
    input_schema: {
      type: 'object',
      properties: {
        song_name: { type: 'string', description: 'Song name to search for (partial match works)' },
        page_count: { type: 'number', description: 'Pages to fetch if setlists not yet loaded. Default 5.' }
      },
      required: ['song_name']
    }
  },
  {
    name: 'calculate_song_stats',
    description: "Calculate play frequency for all songs across the artist's recent setlists. Returns top songs sorted by play count. Use for 'most played song', 'rarest songs', 'songs they play every show'. Fetches setlists automatically.",
    input_schema: {
      type: 'object',
      properties: {
        page_count: { type: 'number', description: 'Pages to fetch. Default 5 (~100 shows).' },
        top_n: { type: 'number', description: 'How many top songs to return. Default 20.' }
      },
      required: []
    }
  },
  {
    name: 'get_venue_stats',
    description: "Get all shows the artist has played at a specific venue or city. Returns setlists from that location with songs played.",
    input_schema: {
      type: 'object',
      properties: {
        venue_name: { type: 'string', description: 'Venue name or city name to filter by' },
        page_count: { type: 'number', description: 'Pages to fetch. Default 5.' }
      },
      required: ['venue_name']
    }
  },
  {
    name: 'check_user_history',
    description: "Check whether the user has personally seen a specific song performed live at their own shows.",
    input_schema: {
      type: 'object',
      properties: {
        song_name: { type: 'string', description: 'Name of the song to look up' }
      },
      required: ['song_name']
    }
  },
  {
    name: 'get_user_top_songs',
    description: "Get the songs the user has seen most often across all their own shows with this artist.",
    input_schema: { type: 'object', properties: {}, required: [] }
  }
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(toolName, toolInput, userShows, mbid, artistName) {
  if (toolName === 'check_user_history') {
    return checkUserHistory(userShows, toolInput.song_name);
  }

  if (toolName === 'get_user_top_songs') {
    return getUserTopSongs(userShows);
  }

  if (toolName === 'get_recent_setlists') {
    const pages = Math.min(toolInput.page_count || 5, 8);
    const setlists = await fetchArtistSetlists(mbid, artistName, pages);
    if (setlists.length === 0) {
      return { error: 'No setlists found for this artist on setlist.fm.', showCount: 0 };
    }
    // Return a summarized version to avoid huge payloads
    return {
      showCount: setlists.length,
      pagesFetched: pages,
      dateRange: {
        earliest: setlists[setlists.length - 1]?.eventDate || null,
        latest: setlists[0]?.eventDate || null
      },
      shows: setlists.slice(0, 30).map(sl => ({
        date: sl.eventDate,
        venue: sl.venue?.name,
        city: sl.venue?.city?.name,
        country: sl.venue?.city?.country?.name,
        tour: sl.tour?.name || null,
        songs: parseSetlistSongs(sl)
      })),
      note: setlists.length > 30 ? `Showing 30 of ${setlists.length} shows. Use calculate_song_stats for full frequency analysis.` : undefined
    };
  }

  if (toolName === 'search_song_history') {
    const pages = Math.min(toolInput.page_count || 5, 8);
    const setlists = await fetchArtistSetlists(mbid, artistName, pages);
    if (setlists.length === 0) {
      return { error: 'No setlists found.', performances: [] };
    }
    const performances = searchSongInSetlists(setlists, toolInput.song_name);
    return {
      songQueried: toolInput.song_name,
      totalPerformances: performances.length,
      showsSearched: setlists.length,
      dateRange: {
        earliest: setlists[setlists.length - 1]?.eventDate || null,
        latest: setlists[0]?.eventDate || null
      },
      performances: performances.slice(0, 30),
      note: `Based on ${setlists.length} recent shows from setlist.fm. Historical data may extend further back.`
    };
  }

  if (toolName === 'calculate_song_stats') {
    const pages = Math.min(toolInput.page_count || 5, 8);
    const topN = toolInput.top_n || 20;
    const setlists = await fetchArtistSetlists(mbid, artistName, pages);
    if (setlists.length === 0) {
      return { error: 'No setlists found.', songs: [] };
    }
    const frequencies = calculateSongFrequencies(setlists);
    return {
      showsAnalyzed: setlists.length,
      dateRange: {
        earliest: setlists[setlists.length - 1]?.eventDate || null,
        latest: setlists[0]?.eventDate || null
      },
      topSongs: frequencies.slice(0, topN),
      rarestSongs: frequencies.filter(s => s.count === 1).slice(0, 10),
      totalUniqueSongs: frequencies.length,
      note: `Based on ${setlists.length} shows from setlist.fm. This reflects recent touring history.`
    };
  }

  if (toolName === 'get_venue_stats') {
    const pages = Math.min(toolInput.page_count || 5, 8);
    const setlists = await fetchArtistSetlists(mbid, artistName, pages);
    if (setlists.length === 0) {
      return { error: 'No setlists found.', shows: [] };
    }
    const venueShows = filterSetlistsByVenue(setlists, toolInput.venue_name);
    if (venueShows.length === 0) {
      return {
        venueQueried: toolInput.venue_name,
        showsFound: 0,
        message: `No shows found at "${toolInput.venue_name}" in the ${setlists.length} most recent setlists.`
      };
    }
    const songFreqs = calculateSongFrequencies(venueShows);
    return {
      venueQueried: toolInput.venue_name,
      showsFound: venueShows.length,
      shows: venueShows.map(sl => ({
        date: sl.eventDate,
        venue: sl.venue?.name,
        city: sl.venue?.city?.name,
        songs: parseSetlistSongs(sl)
      })),
      topSongsAtVenue: songFreqs.slice(0, 15)
    };
  }

  return { error: `Unknown tool: ${toolName}` };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { artistName, mbid, userQuestion, conversationHistory = [], userShows = [] } = body;

  if (!artistName || !userQuestion) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'artistName and userQuestion are required' }) };
  }

  const showContext = buildShowHistoryContext(userShows, artistName);

  const systemPrompt = `You are an enthusiastic concert data assistant specializing in ${artistName}. You have access to setlist.fm data covering their recent touring history, and you can also reference the user's personal show history.

USER'S PERSONAL SHOW HISTORY:
${showContext}

CAPABILITIES:
- Answer questions about ${artistName}'s most-played songs, rarest songs, tour history, venue statistics
- Look up when they last played a specific song
- Find how many times they've played a song
- Show what songs they play at specific venues
- Reference the user's personal concert history when asked

GUIDELINES:
- Always use tools to fetch real setlist.fm data for factual questions about play counts, last performances, venue history, etc.
- Be conversational, warm, and concise (2-4 sentences typically)
- Always mention how many shows the data is based on (e.g. "Based on their 98 most recent shows...")
- Note that data reflects recent touring history, not necessarily all-time stats
- Reference specific dates, venues, and songs when you have them
- If asked to compare the artist's history with the user's personal attendance, blend both data sources
- For questions about the user's own show experiences, use check_user_history or get_user_top_songs`;

  const messages = [
    ...conversationHistory.slice(-8),
    { role: 'user', content: userQuestion }
  ];

  try {
    let currentMessages = messages;
    let apiResponse;

    // Allow up to 4 rounds of tool use (some questions need fetch + analyze)
    for (let round = 0; round < 4; round++) {
      const response = await makeAnthropicRequest(apiKey, {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: systemPrompt,
        tools: TOOLS,
        messages: currentMessages
      });

      if (response.statusCode !== 200) {
        return { statusCode: response.statusCode, headers, body: JSON.stringify({ error: 'AI service error', details: response.body }) };
      }

      apiResponse = response.body;

      if (apiResponse.stop_reason !== 'tool_use') break;

      const toolUseBlocks = apiResponse.content.filter(c => c.type === 'tool_use');
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          const result = await executeTool(toolUse.name, toolUse.input, userShows, mbid, artistName);
          return { type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) };
        })
      );

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: apiResponse.content },
        { role: 'user', content: toolResults }
      ];
    }

    const answer = (apiResponse?.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    return { statusCode: 200, headers, body: JSON.stringify({ answer }) };

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Request failed', details: error.message }) };
  }
};
